# AGENTS.md — IT Stock Manager

Règles de travail pour tout agent intervenant sur ce dépôt. À lire avant toute modification.

## Le projet

Application interne de **gestion de parc informatique** (IT Asset Management) : équipements, affectations aux employés, stock, maintenance, licences.

État actuel : ancien monolithe Express restructuré en `backend/` (Express + Prisma + PostgreSQL 16, port 3001) et `frontend/` (React 19 + Vite + Tailwind 4, port 3000). Le domaine métier du parc IT reste **à construire**.

Deux documents font référence, à lire à la demande — ne les charge pas intégralement en contexte :

- `docs/01-architecture.md` — architecture cible, modèle de données à 31 tables, matrice RBAC, flux métier
- `docs/02-plan-convergence.md` — **le plan de travail** : 12 chantiers ordonnés, correspondance existant/cible, points de vigilance

Avant de commencer un chantier, lis la section correspondante de `02-plan-convergence.md`. L'ordre des chantiers n'est pas négociable : il est justifié en §4.1.

## Commandes

```bash
npm run install:all        # installe racine + backend + frontend
npm run dev                # backend (tsx watch) + frontend (Vite) ensemble
npm run build              # build de production
npm start                  # production, le backend sert le SPA
npm run db:migrate         # prisma migrate dev
npm run db:seed            # jeu de démonstration

cd backend  && npx tsc --noEmit     # typecheck backend
cd frontend && npx tsc --noEmit     # typecheck frontend
```

Configuration dans `backend/.env` (modèle : `backend/.env.example`). **Aucun secret réel ne doit être committé.**

## Architecture — la règle d'or

```text
route (HTTP) → service (métier) → Prisma (données)
```

- Une route ne contient **jamais** de logique métier ni d'appel Prisma direct. Elle valide, appelle un service, formate la réponse.
- Un service ne connaît **jamais** `req`/`res`.
- Signature systématique : `service(contexte, donnees)` où `contexte = { utilisateur, permissions, adresseIp }`. Un service sans contexte ne doit pas exister.

## Règles non négociables

1. **Permissions côté serveur.** `exigerPermission('module.action')` sur chaque route mutante. Masquer un bouton dans l'interface n'est pas un contrôle d'accès.
2. **Audit dans la transaction.** Toute création, modification, suppression, affectation, retour, transfert ou import écrit dans `JournalAudit` **à l'intérieur du même `$transaction`** que l'opération. Si l'audit échoue, l'opération est annulée.
3. **L'historique ne se supprime ni ne se modifie jamais.** `MouvementStock`, `Affectation`, `Maintenance`, `JournalAudit`, `LigneInventaire` sont en écriture seule. Une erreur se corrige par un mouvement inverse d'AJUSTEMENT, jamais par un UPDATE.
4. **L'argent est en `Decimal @db.Decimal(12,2)`**, jamais en `Float`. La conversion en nombre JSON se fait dans le sérialiseur unique de `lib/serialisation.ts`, pas en changeant le type en base.
5. **Les dates sont en `DateTime`**, jamais en `String`. Le formatage français se fait à l'affichage (`date-fns`, locale `fr`).
6. **Suppression = soft delete** (`supprimeLe`) sur les entités métier, avec FK `onDelete: Restrict`. Ne retire jamais une clé étrangère pour « protéger » un historique : c'est le soft delete qui le protège.
7. **TypeScript strict.** Pas de `any` sans justification écrite en commentaire. Pas de `@ts-ignore`.
8. **Validation serveur systématique** (Zod) à la frontière HTTP, même si le formulaire valide déjà côté client.
9. **Transactions et verrous** sur les opérations concurrentes : affectation, sortie de stock, ajustement. Un `SELECT … FOR UPDATE` sur l'équipement avant de l'affecter.
10. **Ne jamais prétendre qu'une fonctionnalité marche sans l'avoir exécutée.** Si tu n'as pas pu tester, dis-le explicitement.

## Conventions de nommage

- **Tout en français** : modèles Prisma (`Equipement`, `Employe`, `MouvementStock`), champs (`numeroInventaire`, `dateFinGarantie`), services, variables, libellés d'interface.
- **Trois exceptions** : les modèles d'authentification hérités (`User`, `Session`) gardent leur nom anglais avec `@@map` vers des tables françaises ; les **valeurs d'enums restent en anglais** (`AVAILABLE`, `ASSIGNED`, `IN_PROGRESS`, `CRITICAL`) — le français passe par `lib/libelles.ts` ; les mots-clés de framework.
- Tables PostgreSQL en `snake_case` via `@@map` / `@map`.
- Clés primaires : `id String @id @default(uuid())` + `reference String @unique` pour l'identifiant métier lisible (`STK-001`, `AFF-2026-001`).

## Format des réponses API — ne pas changer

Le frontend en dépend :

```jsonc
{ "status": "ok", "data": … }        // lecture
{ "message": "…", "data": … }        // mutation
{ "error": "…" }                     // erreur, avec le code HTTP correct
```

Codes utilisés : 200, 201, 400, 401, 403, 404, 409 (conflit métier), 422 (validation), 429, 500. Les messages d'erreur sont **en français et destinés à l'utilisateur final**.

### Langue des clés — décision du 22 août

**Les clés des réponses API sont en français**, comme le modèle de données : `utilisateurs`, `societes`, `articles`, `mouvements`, `affectations`, `creeLe`, `modifieLe`, `derniereConnexion`.

La traduction vers l'anglais mise en place au chantier 1 dans `lib/serialisation.ts` (`creeLe → createdAt`, `derniereConnexion → lastLogin`) était une cale de compatibilité pour le frontend hérité. Elle est **supprimée**, pas étendue : le frontend est adapté dans le même commit que le renommage.

Règle pour la suite : **aucune traduction de nom de champ à la frontière HTTP.** Le sérialiseur convertit les types (`Decimal → number`, `Date → ISO`) et filtre les champs internes ; il ne renomme rien. Un nouvel endpoint expose les noms du modèle, tels quels.

## Périmètre supprimé

Les modules **achats** — `BonCommande`, `LigneCommande`, `Budget`, `AppelOffres`, `Offre`, `ia.service.ts` et le client Gemini — ont été **retirés du dépôt**. L'application couvre exclusivement la gestion de parc informatique : équipements, affectations, stock, maintenance, licences.

- Ne les réintroduis pas, même partiellement.
- Ne recrée pas de notion de commande, de budget ou d'appel d'offres.
- Si un besoin d'achat réapparaît, il fait l'objet d'une décision explicite, pas d'un ajout opportuniste.

Le module **Fournisseurs** a lui aussi été supprimé (décision du 22 août). L'information fournisseur survit sous forme d'un **champ texte `fournisseur`** sur `Equipement`, `Licence` et `Maintenance` — assez pour faire jouer une garantie ou rappeler un réparateur, sans module à maintenir. Ne recrée pas de table `Fournisseur`.

L'entrée en stock se fait par l'écran « Réception » prévu au chantier 7, et manuellement en attendant.

## Modèle de rattachement — deux décisions structurantes

**Le matériel s'affecte à un `Employe`, jamais à un `Utilisateur`.** Un `Employe` est une personne physique (matricule, département, société) qui n'a pas besoin de compte : dans un parc IT, la plupart des porteurs de matériel ne se connectent jamais à l'application. Un `Utilisateur` est un compte de connexion, éventuellement relié à un employé par `employeId`.

**`Societe` est une étiquette avec filtres, pas un cloisonnement.** Utilisateurs, employés et équipements portent un `societeId` ; tout le monde voit tout, les listes se filtrent par société. Le filtrage passe par la couche service, ce qui laisse la porte ouverte à un cloisonnement strict plus tard sans réécrire les écrans. N'introduis pas de filtrage implicite par société tant que la décision n'a pas changé.

## Avant de dire qu'un chantier est terminé

- [ ] `npx tsc --noEmit` passe dans `backend/` **et** `frontend/`
- [ ] `npm run build` passe
- [ ] La migration Prisma est appliquée et le seed régénéré sans erreur
- [ ] Les routes existantes répondent toujours (contrôle de non-régression sur `GET /api/data`)
- [ ] Les nouvelles routes mutantes renvoient 401 sans session et 403 sans permission — vérifié, pas supposé
- [ ] Les critères « Fini quand » du chantier concerné dans `docs/02-plan-convergence.md` sont remplis

## Ce qu'il ne faut pas faire

- Commencer par les écrans. Les chantiers 1 à 3 (types de données, authentification, audit) ne se rattrapent pas une fois les données réelles saisies.
- Laisser deux systèmes de permissions coexister. L'ancienne matrice de `utilisateurs.service.ts` est **remplacée**, pas complétée.
- Migrer les données sans fichier de revue validé à la main (voir la scission `ArticleStock` en §2.2 du plan).
- Ajouter une dépendance sans nécessité claire.
- Créer des fonctionnalités non demandées pour « faire complet ».
