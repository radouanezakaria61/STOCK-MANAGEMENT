# Rapport d'audit complet — STOCK-MANAGEMENT (Gestion de Parc Informatique)

**Date de l'audit :** 22 août 2026
**Périmètre audité :** backend (Express + Prisma + PostgreSQL), frontend (React 19 + Vite + Tailwind 4), schéma de données, sécurité, conformité au plan `docs/02-plan-convergence.md` et aux règles `AGENTS.md`.

---

## 1. Vue d'ensemble

| Élément | Constat |
|---|---|
| Taille | ~11 500 lignes TS/TSX (35 fichiers source), 5 migrations Prisma |
| Typecheck | ✅ `tsc --noEmit` passe sur backend ET frontend (0 erreur) |
| État git | ⚠️ Chantier 3 en cours : ~13 fichiers modifiés + ~10 non suivis **non commités** |
| Tests automatisés | ❌ Aucun test Vitest/Playwright. Seul `backend/scripts/verifier-non-regression.ts` (48 contrôles) |
| Avancement du plan | Chantiers 0→3 quasi terminés. Chantiers 4 à 11 (référentiels, équipements, affectations refondues, maintenance, licences, rapports, tests/Docker) **non commencés** |

### Points forts remarquables

Le socle existant est d'une qualité nettement supérieure à la moyenne :

1. **Architecture respectée** : la règle « route → service → Prisma » est tenue partout ; aucun appel Prisma dans les routes.
2. **Authentification solide** : Argon2id (paramètres OWASP), jetons de session aléatoires 48 octets stockés uniquement en SHA-256, expiration glissante avec plafond absolu, révocation immédiate des sessions (désactivation, changement de mdp), hash leurre anti-énumération de comptes, temporisation croissante anti-bruteforce (30 s → 4 min), messages d'échec uniformes.
3. **RBAC serveur effectif** : `exigerPermission()` sur chaque route mutante ; plus aucune route anonyme hors login.
4. **Intégrité transactionnelle exemplaire** : verrou consultatif (`pg_advisory_xact_lock`) pour les références, `SELECT … FOR UPDATE` avant toute écriture de quantité, relecture post-verrouillage, audit écrit **dans la même transaction**, machine à états pour les statuts matériel.
5. **Soft delete globalisé** via extension Prisma (y compris le correctif `findUnique`, point critique hérité du chantier 1 — corrigé).
6. **Idempotence serveur** (`X-Cle-Idempotence`) scopée méthode+chemin, avec détection de conflit de contenu.
7. **Journal d'audit immuable** garanti aussi côté PostgreSQL (trigger).
8. **Zod systématique** à la frontière HTTP, messages d'erreur en français, codes HTTP corrects (409/422/429).
9. `.env` correctement ignoré par git (seuls les `.env.example` sont versionnés).

---

## 2. Problèmes à corriger (par priorité)

### 🔴 P1 — À faire immédiatement

**P1.1 — Commiter le travail en cours (chantier 3).**
Environ 23 fichiers modifiés/créés ne sont pas commités (audit transactionnel, idempotence, machine à états, notifications, 4 migrations). Un incident disque ou une manipulation erronée ferait perdre plusieurs chantiers. *Action : revue puis commit découpé par thème (lib/middleware/services/migrations).* 

**P1.2 — Sur-exposition de données sur les routes de lecture.**
- `GET /api/data` renvoie **tout** (toutes les sociétés, utilisateurs, articles, mouvements, affectations) à **tout utilisateur authentifié**, quel que soit son rôle. Un simple EMPLOYEE récupère l'annuaire complet.
- `GET /api/users` n'exige aucune permission (seulement l'authentification) : tout utilisateur connecté liste tous les comptes avec email, département, rôle, dernière connexion.
- Les modèles `Utilisateur` sont sérialisés entiers : vérifier que `motDePasseHash` et autres champs internes sont bien filtrés par `lib/serialisation.ts` (liste blanche à confirmer, pas une liste noire).
*Action : exiger des permissions de lecture différenciées (ex. `utilisateurs.lire`), restreindre `/api/data` aux champs réellement nécessaires au dashboard, liste blanche explicite dans le sérialiseur.*

**P1.3 — `simPin` / `simPuk` stockés en clair.**
Les codes PIN/PUK des cartes SIM sont des secrets. Le plan prévoit déjà le chiffrement AES-256-GCM pour les clés de licence (chantier 9) : appliquer le même mécanisme dès maintenant à PIN/PUK, avec permission dédiée pour la lecture et audit de chaque lecture.

**P1.4 — Aucun test automatisé.**
Le critère d'acceptation du chantier 2b (« test automatisé, pas vérification manuelle ») n'est pas rempli : il n'y a ni Vitest ni Playwright dans le dépôt. Le script de non-régression manuel ne protège pas contre les régressions futures. *Action : mettre en place Vitest sur les services critiques (affectations concurrentes, mouvements de stock, permissions, limiteur de connexion) avant le chantier 4.*

### 🟠 P2 — Corrections importantes

**P2.1 — Limiteur de connexion en mémoire uniquement.**
La `Map` de tentatives (middleware/auth.ts) est perdue à chaque redémarrage et n'est pas partagée entre instances. En production multi-processus (PM2 cluster), la protection devient inefficace. *Action : persister en base (table dédiée) ou Redis.*

**P2.2 — Purge des sessions expirées absente.**
Les sessions ne sont supprimées que paresseusement quand leur cookie se présente. Une session jamais rejouée reste en base indéfiniment → croissance illimitée de la table `sessions`. *Action : tâche périodique (cron node-cron ou job SQL) supprimant `expire_le < now()`.*

**P2.3 — Génération de références non scalable et fragiles.**
- `prochaineReference` (affectations) charge **toutes** les références de toutes les affectations puis filtre en JS : OK aujourd'hui, O(n) à chaque création demain.
- `nouvelleReferenceMouvement` utilise `count()+1` avec le format `MVT-00${n}` : cassera visuellement au-delà de 999 (`MVT-001000`) et dépend du fait qu'aucun mouvement n'est jamais supprimé (vrai par règle métier, mais fragile si la règle change).
*Action : séquence PostgreSQL dédiée (`CREATE SEQUENCE`) ou table compteur par année, format `padStart(4)`.*

**P2.4 — Absence totale de pagination.**
Toutes les listes (`/api/stock`, `/api/assignments`, `/api/users`, `/api/data`) renvoient l'intégralité sans limite. Avec quelques milliers d'équipements, le dashboard et les écrans deviendront inutilisables. Le plan le prévoit au chantier 5 (« pagination serveur, recherche pg_trgm ») mais le problème concernera aussi users/affectations. *Action : paginer dès maintenant les endpoints qui grossiront (mouvements, affectations).*

**P2.5 — Recherche stock en mémoire.**
`rechercherStock` charge toute la table puis filtre en JavaScript. À migrer vers un `WHERE` Prisma / index trigram (déjà prévu chantier 5).

**P2.6 — CSP désactivée.**
`helmet({ contentSecurityPolicy: false })`. Le durcissement est planifié (« phase 41+ ») mais c'est une porte ouverte XSS tant qu'elle dure. *Action : poser dès maintenant une CSP minimaliste compatible Vite build (`default-src 'self'`), même imparfaite, plutôt que rien.*

**P2.7 — Arithmétique monétaire en float côté application.**
`totalValueMAD = qty * unitPrice` où `unitPrice = parseFloat(...)` : le calcul se fait en flottant avant stockage Decimal(12,2). Risque d'erreurs d'arrondi à la centime. *Action : utiliser `Prisma.Decimal` pour le calcul (`qty × prix` en Decimal) et parser le prix depuis la chaîne, pas via parseFloat.*

### 🟡 P3 — Améliorations recommandées

**P3.1 — Consultation du journal d'audit manquante.**
Le journal s'écrit bien, mais aucune route ni écran ne permet de le consulter ; la permission `audit.consulter` existe dans le RBAC mais n'est utilisée nulle part. C'est un livrable explicite du chantier 3 (« écran filtrable réservé SUPER_ADMIN/AUDITOR »).

**P3.2 — `assignedTo` en JSON dénormalisé sur ArticleStock.**
Champ `Json` redondant avec les affectations ; risque de divergence. Le plan de scission `ArticleStock → Equipement` (§2.2) doit le supprimer.

**P3.3 — `LigneAffectation.stockItemId` sans clé étrangère.**
Commenté « FK propre au chantier 6 » — à ne pas oublier : sans FK, un article hard-supprimé (si cela arrivait) laisserait des lignes orphelines silencieuses.

**P3.4 — Numéro de série par défaut faible.**
`serialNumber: SN-${Date.now().slice(-6)}` : collisions possibles et valeur trompeuse (ce n'est pas un numéro de série réel). Préférer null obligatoire ou référence interne clairement étiquetée.

**P3.5 — Frontend : composants monolithiques.**
`MaterialAssignmentModule.tsx` fait 2 689 lignes, `ITStockManagement.tsx` 872. Appels `fetch` dispersés sans couche client API commune (gestion d'erreur, headers idempotence, gestion 401 dupliquée partout). *Action : extraire un `lib/api.ts` (wrapper fetch : JSON, erreurs FR, en-tête idempotence auto, redirection login sur 401) et découper les gros composants.*

**P3.6 — Perte du téléphone dans `versAppUser`.**
`App.tsx` mappe `phone: ""` en dur alors que le profil serveur contient le département mais pas le téléphone : ajouter `phone` au profil `/auth/me`.

**P3.7 — Comptes de démonstration.**
Bien conditionnés par `AUTORISER_SEED_DEMO`, mais ajouter un garde-fou : refuser le seed si `NODE_ENV=production`, même si la variable est positionnée.

**P3.8 — Pas de CI.**
Aucun pipeline lançant les deux `tsc --noEmit`, les migrations sur base temporaire et les futurs tests (prévu chantier 11). Même un simple GitHub Actions de 20 lignes vaut mieux que rien dès maintenant.

**P3.9 — Sauvegarde base non outillée.**
Le chantier 0 exige un `pg_dump` restaurable : vérifier qu'un script de sauvegarde planifié existe réellement (aucun script trouvé dans `backend/scripts` hormis la non-régression).

---

## 3. Écarts par rapport au plan de convergence

| Chantier | État | Commentaire |
|---|---|---|
| 0 — Gel périmètre | ✅ | Modules achats retirés |
| 1 — Fondations données | ✅ | UUID+reference, Decimal, DateTime, soft delete, sérialiseur |
| 2a — Sociétés / nettoyage | ✅ | |
| 2b — Auth + RBAC | ✅ | Livré, écarts documentés et assumés |
| 3 — Audit + notifications | 🔶 ~90 % | Écriture transactionnelle OK, notifications OK ; **manque écran/route de consultation du journal (audit.consulter)** + commit |
| 4 — Référentiels & Employés | ❌ | Non commencé — **prérequis de tout le reste** |
| 5 — Équipements | ❌ | Le cœur du produit (scission ArticleStock → Equipement, QR codes) |
| 6 — Affectations refondues | ❌ | L'actuel fonctionne mais reste sur l'ancien modèle (bénéficiaire texte, pas d'Employe) |
| 7-9 — Stock/Maintenance/Licences | ❌ | Modèles Maintenance/Licence présents en germe dans le schéma seulement |
| 10 — Dashboard/rapports | ❌ | Dashboard actuel = agrégat brut envoyé au frontend |
| 11 — Tests/Docker/CI | ❌ | **Risque projet n°1** |

---

## 4. Plan d'action recommandé (ordre conseillé)

1. **Semaine 1** : committer le chantier 3 (P1.1) · compléter l'écran de consultation du journal d'audit (P3.1) · corriger les permissions de lecture et le sérialiseur liste blanche (P1.2) · chiffrer PIN/PUK (P1.3).
2. **Semaine 2** : mise en place Vitest + premiers tests sur affectations/mouvements/permissions (P1.4) · CI minimale (typechecks + migrations) (P3.8) · purge sessions (P2.2) · CSP minimale (P2.6).
3. **Semaine 3** : persistance du limiteur de connexion (P2.1) · séquences de références (P2.3) · pagination sur mouvements/affectations (P2.4) · Decimal pour la valeur totale (P2.7).
4. **Ensuite** : reprendre le plan — chantier 4 (Référentiels/Employés) puis 5 (Équipements), en intégrant nativement ce qui précède (pagination, recherche trigram, tests).

---

## 5. Conclusion

Le projet est sur de très bons rails : la fondation technique (données, auth, audit, concurrence) est remarquablement rigoureuse et conforme aux règles AGENTS.md. Les vrais risques ne sont pas dans le code existant mais dans **ce qui manque** : aucun test automatisé, un travail conséquent non commité, des routes de lecture trop ouvertes, et les deux tiers du domaine métier (équipements, employés, maintenance, licences) restant à construire. Corriger les points P1 avant de démarrer le chantier 4 évitera de payer ces dettes quand la base contiendra des données réelles.

*Rapport généré automatiquement lors de l'audit du 22/08/2026. Vérifications exécutées réellement : lecture intégrale des sources backend/frontend, `tsc --noEmit` backend et frontend (passent), inspection git status/log, analyse du schéma Prisma et des 5 migrations.*
