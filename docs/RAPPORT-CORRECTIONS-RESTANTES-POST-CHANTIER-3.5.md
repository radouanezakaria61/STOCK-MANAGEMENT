# Rapport — Corrections restantes après chantier 3.5

**Date** : 23 août 2026
**Branche** : `convergence-parc-it` (dépôt local, aucun push effectué)
**Cahier des charges** : `Prompt_Corrections_Restantes_Apres_Chantier_3_5.md`
**Commits de la session** :

| Commit | Objet |
|---|---|
| `e4e3352` | test: suite Vitest (97 contrôles) + durcissement versDate + correctif M5 ré-appliqué |
| `e3b250e` | feat: pagination serveur des listes + sortie de /api/data + DTO utilisateur allowlist |
| `63883ee` | feat: identifiant de requête X-Requete-Id propagé aux journaux serveur |
| `d03020e` | chore: ESLint flat config backend (priorité 5) + analyse CSP style-src consolidée (priorité 9) |
| `050b5c0` | refactor: jsPDF en import dynamique + extraction des fiches imprimables (priorité 7) |
| `9dfe2a9` | ci: workflow GitHub Actions préparé (priorité 4) |

---

## 1. Tableau des priorités

| # | Priorité | Statut | Livrables principaux | Validation |
|---|---|---|---|---|
| 1 | Socle de tests Vitest | ✅ Fait | `backend/vitest.config.ts`, 12 fichiers de tests (**110 contrôles verts**) : lib purs (dates/références, TRUST_PROXY M4, chiffrement AES-GCM, machine à états, Zod, sérialiseur), intégrations en base (RBAC matrice seed, notifications A/B, invariants stock, immutabilité journal, pagination) | `npm test` → 12 fichiers, 110/110 |
| 2 | Pagination serveur | ✅ Fait | `lib/pagination.ts` (contrat `{items, pagination:{page,limite,total,pages}}`, plafond 200), GET `/api/users`, `/api/stock`, `/api/assignments`, `/api/notifications` paginés ; **nouveau GET `/api/mouvements`** (`parc.consulter`) ; `listerStock` scindé articles/mouvements | Tests dédiés + phase1 + non-régression |
| 3 | Réduction dépendance à `/api/data` | ✅ Fait (choix documenté §2) | `App.tsx` : `fetchSourcingData(permissions?)` = chargement parallèle ciblé (`?page=1&limite=200`), annuaire conditionné à `utilisateurs.consulter` ; JournalAuditModule et verifier-phase1 adaptés au nouveau format | tsc frontend + build + phase1 |
| 4 | CI préparée | ✅ Fait | `.github/workflows/ci.yml` : PostgreSQL 16 jetable, npm ci ×2, prisma generate/validate/migrate deploy, typecheck ×2, ESLint, Vitest, builds backend+frontend, clé AES éphémère par exécution | Workflow committé (voir limite L4) |
| 5 | ESLint progressif backend | ✅ Fait | Flat config typescript-eslint : `no-unused-vars` en erreur, `no-explicit-any` en avertissement (usages documentés des scripts verify) ; 3 éléments morts supprimés | `npm run lint` → **0 erreur**, 41 avertissements |
| 6 | Identifiant de requête dans les logs | ✅ Fait | `journal-serveur.ts` : AsyncLocalStorage + middleware `X-Requete-Id` (honore un identifiant fourni s'il est sain, sinon UUID) ; suffixe `[req:<id>]` sur chaque ligne de log | 5 tests unitaires + sonde live (en-tête présent sur `/api/health`) |
| 7 | Décomposition prudente MaterialAssignmentModule | ✅ Fait | **jsPDF en import dynamique** (chunk séparé de 390 ko, bundle principal 500→227 ko, plus d'avertissement Vite) ; modales 3 et 4 extraites vers `components/affectations/FicheImpression{Affectation,Restitution}.tsx` ; module 2 681 → 1 884 lignes | tsc frontend + `npm run build` |
| 8 | DTOs allowlist côté serveur | ✅ Fait | `dtoUtilisateur` : liste blanche explicite (jamais `motDePasseHash`, `tokenHash`, `supprimeLe`, horodatages internes) sur GET `/api/users` | Assertions négatives dans `pagination.test.ts` |
| 9 | Analyse CSP `style-src` | ✅ Fait (choix documenté §2) | Build prod audité : 0 `<style>`/`<script>` inline, CSS extrait ; `'unsafe-inline'` **maintenu** pour les seuls attributs `style` React dynamiques, justification précise en commentaire `app.ts` | Inventaire réel du bundle |

## 2. Décisions documentées

### P9 — CSP : maintien justifié de `'unsafe-inline'` sur `style-src`
Le build de production ne contient **aucun** `<style>` ni `<script>` inline (CSS extrait vers `assets/*.css`). La seule consommation restante est celle des **attributs `style=` calculés par React** (barres de progression `${pct}%`, options `contentStyle` de Recharts), que la CSP bloque sans `'unsafe-inline'`. `'unsafe-hashes'` ne peut pas couvrir des valeurs dynamiques (le hachage porte sur le littéral de l'attribut). Le vecteur réel (injection de script) reste fermé par `script-src 'self'`. Décision : maintien, documenté en tête de la politique dans `backend/src/app.ts`.

### P3 — `/api/data` conservé pour les scripts
L'endpoint n'est plus consommé par l'interface (remplacé par les fetches ciblés paginés) mais reste **monté et intact** : `scripts/verifier-non-regression.ts` lit ses clés. Il est marqué déprécié pour l'UI en commentaire de route. Suppression différée à la migration des scripts.

## 3. Bugs réels trouvés et corrigés pendant les travaux

1. **`versDate()` acceptait les dates impossibles** (`2026-02-30` basculait silencieusement au 2 mars, parsing V8 tolérant). Corrigé dans `lib/ids.ts` par relecture UTC des composants → erreur métier `DATE_INVALIDE`. Couvert par tests.
2. **Régression M5** introduite par la fusion externe `691e5f5` (retour d'un `id` généré localement à la place de `crypto.randomUUID()`) : correctif ré-appliqué et committé dans `e4e3352`.
3. Trois imports/fonctions mortes détectés par ESLint et supprimés (`estDateSeule`, `prismaSansFiltre`, `NextFunction`).

## 4. Limites connues

- **L1 — Plafond de pagination à 200/page** : l'annuaire utilisateurs charge jusqu'à 200 comptes ; au-delà, il faudra une vraie pagination UI (hors périmètre « corrections »).
- **L2 — `/api/data` toujours monté** pour les scripts tsx ; à retirer quand ils seront migrés.
- **L3 — Export PDF non cliqué en conditions réelles** : le déplacement des fiches est mécanique (JSX inchangé), validé par tsc + build, mais aucune interaction navigateur n'a été jouée sur le bouton « Exporter PDF ».
- **L4 — CI inactive** tant qu'aucun remote GitHub n'est connecté (note en tête du workflow) ; elle s'activera au premier push.
- **L5 — 41 avertissements ESLint** résiduels (`any` documentés des scripts de vérification) ; durcissement progressif prévu.

## 5. Validation finale (exécutée le 23/08/2026)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (backend) | ✅ 0 erreur |
| `npx tsc --noEmit` (frontend) | ✅ 0 erreur |
| `npm run lint` (backend) | ✅ 0 erreur / 41 warnings |
| `npm run build` (racine : backend + frontend) | ✅ succès, plus aucun avertissement de chunk |
| `prisma migrate status` | ✅ schéma à jour (8 migrations) |
| `npm test` (Vitest, backend) | ✅ **12 fichiers, 110/110** |
| `scripts/verifier-non-regression.ts` | ✅ TOUS LES CONTRÔLES PASSENT |
| `scripts/verifier-phase1.ts` | ✅ TOUS LES CONTRÔLES PASSENT |
| `scripts/probe-concurrence.ts` | ✅ TOUS LES CONTRÔLES PASSENT (0 incohérence stock, audit sans donnée sensible) |
| Sonde live | ✅ `/api/health` 200, en-tête `X-Requete-Id` présent, CSP stricte active |

Aucune régression critique détectée.

## 6. Verdict

> **`PRÊTE POUR AUDIT FINAL DE PRODUCTION INTERNE/VPN`**

Toutes les corrections demandées sont livrées et validées sans régression. Le palier suivant (`PRÊTE POUR PRODUCTION INTERNE/VPN`) suppose de lever les limites L1–L3 et de jouer un audit final complet (revue manuelle des écrans, exports PDF cliqués, parcours RBAC bout-en-bout avec les comptes réels).

---
*Rapport généré automatiquement à l'issue de la session de corrections. Aucun push n'a été effectué.*
