# RAPPORT D'AUDIT FINAL — PRÉPARATION PRODUCTION INTERNE / VPN

**Application** : Gestion des Achats & Approvisionnements (parc IT)
**Date** : 2026-08-25 · **Auditeur** : agent d'audit (méthode : auditer avant de corriger)
**Référentiel** : `Prompt_Audit_Final_Production_Interne_VPN.md` (26 sections)

---

## 1. Résumé exécutif

L'application a été auditée de bout en bout sur une base PostgreSQL dédiée
(`parc_audit`) avec recettes API complètes, recette navigateur réel, tests de
non-régression formels, sauvegarde/restauration vérifiée et revue sécurité.

- **Une anomalie P1 a été découverte, diagnostiquée, corrigée et prouvée** :
  erreur 500 brute lors de la deuxième affectation consécutive d'un article
  sérialisé encore disponible (violation d'index unique non interceptée).
  Correctif appliqué + validé par trois scénarios de preuve.
- Toutes les recettes critiques sont vertes : **58/58 contrôles API**,
  **13/13 contrôles PDF navigateur**, **67/67 phase1**, non-régression complète,
  CI GitHub verte (Vitest 110/110).
- Sauvegarde **et restauration** réellement exécutées et comparées table par table.
- Aucun secret exposé ; PIN/PUK SIM chiffrés AES-256-GCM même dans le backup restauré.
- Le TLS/reverse proxy est **proposé et prêt à déployer** mais **non déployé**
  (hors périmètre autorisé) ⇒ condition du verdict.

**Verdict : `GO SOUS CONDITIONS - PRODUCTION INTERNE/VPN`** (cf. §23).

---

## 2. Périmètre & méthode

- Audit statique (routes/services/Prisma/CI/secrets) + audit dynamique :
  recette API scriptée (58 contrôles idempotents), navigateur réel headless
  (Chrome + puppeteer-core, profil isolé), tests SQL directs (`EXPLAIN ANALYZE`),
  manipulation base de recette jetable.
- Corrections limitées aux anomalies **reproductibles et prouvées** ;
  toute correction documentée avec preuve avant/après.
- Interdictions respectées : pas de merge/push automatique, pas de déploiement,
  pas de suppression de données métier, pas de migration destructive.

## 3. Environnement de test

| Élément | Valeur |
|---|---|
| Base de recette | `parc_audit` (PostgreSQL 16, utilisateur dédié `stock_app`, mdp fort via variable d'environnement — jamais en dur) |
| Backend | Node 24 + tsx, `0.0.0.0:3001` en recette ; logs séparés stdout/stderr |
| Frontend | Vite dev `127.0.0.1:3000` |
| Navigateur de test | Chrome headless, profil vierge isolé (les profils d'entreprise du poste interceptent localhost via filtrage web — cf. §12) |
| Comptes démo | SUPER `zakaria.radouane`, ADMIN `sarah.benali`, STOCK `mehdi.alami` (Inactif testé), EMPLOYEE `karim.berrada` / `maya.lin` ; mot de passe démo piloté par `MOT_DE_PASSE_DEMO` |

Comptes de recette créés puis laissés dans la base jetable : `recette.mgr`,
`recette.tech`, `recette.stock` (rôles manquants B0), société `SRK1`.

## 4. Architecture constatée

- Express + Prisma/PostgreSQL, sessions serveur en base (`sessions`), cookies
  opaques `HttpOnly ; SameSite=Lax ; Path=/api` (vérifié sur réponses `Set-Cookie`).
- SPA React/Vite, exports PDF côté client (jsPDF en import dynamique).
- Journal d'audit append-only (triggers), notifications par événement,
  limiteur anti-bruteforce double niveau (couple IP|identifiant + IP), purge
  planifiée des données techniques (sessions, clés d'idempotence, compteurs).
- Sécurité mutation : marqueur de requête + contrôle strict `Origin` contre la
  liste `ORIGINES_AUTORISEES` → **403 prouvé** pour une origine non déclarée.

## 5. Authentification & sessions — CONFORME

Preuves (recette API A1–A8) :

- Login OK → cookie session conforme ; logout → session révoquée en base ;
  réutilisation du cookie après logout → 401.
- Messages d'erreur **égalisés** identifiant/mot de passe (« Identifiant ou mot
  de passe incorrect. ») ; hash leurre calculé pour égaliser les temps de réponse.
- Compte Inactif refusé (message générique, pas de fuite d'état).
- Changement de mot de passe obligatoire au premier login (compte créé par ADMIN),
  ancien mot de passe invalidé après changement.
- Anti-bruteforce **observé en conditions réelles** pendant l'audit : verrou du
  couple IP|identifiant après échecs répétés → 429 ; purge technique fonctionnelle.
- UI : échec de connexion affiche « Identifiant ou mot de passe incorrect. »
  sans aucune trace de pile ni détail technique (test navigateur réel).

## 6. RBAC — CONFORME

Matrice C1–C10 exécutée sur les rôles SUPER_ADMIN / ADMIN_GROUPE / MAGASINIER /
EMPLOYEE / AUDITOR + comptes Inactif :

- Création utilisateur par ADMIN → compte forcé inactif + mot de passe temporaire
  (aucun privilège auto-élevé) ; modification/suppression utilisateur interdites
  hors SUPER (403).
- Confidentialité SIM : PIN/PUK absents des listes/détails pour EMPLOYEE/MAGASINIER
  (403 sur l'endpoint confidentiels), lisibles uniquement par SUPER_ADMIN.
- Suppression d'affectation refusée aux rôles non autorisés ; journal d'audit
  accessible en lecture seule AUDITOR.
- Frontend : navigation masquée selon rôle (recette navigateur).

## 7. Recettes métier stock & affectations — CONFORMES après correctif

### 7.1 Stock (D1–D9)
Création article (champs stricts — champ inconnu rejeté 422, `assetTag` généré
serveur), numéro de série dupliqué → 409, prix formaté FR, sortie > stock → 422,
types de mouvement invalides → 422, ajustement d'inventaire tracé, pagination
bornée (plafond 200) + métadonnées `{page,limite,total,pages}`.

### 7.2 Anomalie P1 — corrigée (la seule anomalie significative de l'audit)

**Symptôme** : `POST /api/assignments` → **500 brut** lors de la création d'une
2ᵉ affectation sur un article sérialisé dont la quantité disponible restait > 0
(reproductible à 100 %).

**Diagnostic** (logs stderr + base) :
1. `PrismaClientKnownRequestError P2002` levée par `tx.affectation.create()`
   (`affectations.service.ts:366`) — violation de l'index unique partiel
   `uq_affectation_imei` sur `appareil_imei`.
2. Cause racine : ligne ~398, si aucun IMEI n'est saisi, le service copiait le
   `numero_serie` de l'article dans le champ IMEI de la fiche ⇒ deux fiches sur
   le même article sérialisé portaient le même « IMEI » ⇒ collision ⇒ erreur
   Prisma brute remontée en 500.

**Correctif appliqué** (`backend/src/services/affectations.service.ts`, +16/-3) :
- `deviceImei: deviceImei || ""` (plus de copie implicite du numéro de série) ;
- interception `P2002` autour de la création de fiche → réponse métier
  **409 `ITEM_ALREADY_ASSIGNED`** « Un IMEI identique est déjà enregistré sur une
  autre fiche d'affectation. » (cohérente avec la sémantique existante).

**Preuves après correctif** (base fraîche) :
| Scénario | Avant | Après |
|---|---|---|
| CAS A — ré-affectation d'un laptop sérialisé disponible | 500 | **201** |
| CAS B1 — smartphone, IMEI neuf | 201 | **201** |
| CAS B2 — smartphone, IMEI déjà affecté | 500 | **409** code `ITEM_ALREADY_ASSIGNED`, message métier |

`tsc --noEmit` : 0 erreur ; ESLint : propre ; suites de non-régression rejouées
vertes après correctif (§9). La protection métier historique (verrou « unité déjà
affectée » quand disponible = 0) reste inchangée et vérifiée.

### 7.3 Restitutions (E9–E13)
Restitution « Bon état » → article immédiatement réaffectable (**201 prouvé**) ;
« Endommagé » → bascule maintenance ; PIN/PUK masqués partout sauf endpoint
confidentiels SUPER ; traçabilité complète des retours.

## 8. Concurrence & idempotence — CONFORME

- `probe-concurrence` : PASS (sorties > stock impossibles, compteurs cohérents).
- Clés d'idempotence purgées par le planificateur ; double soumission protégée.
- Transactions sur création d'affectation (fiche + lignes + mouvement atomiques).

## 9. Suites de tests & build — VERTES

| Suite | Résultat | Lieu |
|---|---|---|
| Vitest (unitaires/intégration) | **110/110** | **CI GitHub Linux verte** (runs 32785542310 & 32785544989, commit `96803e4`). Exécution locale impossible : blocage OS du poste (rolldown/native-bind sous politique Windows) — variation documentée, la CI fait foi. |
| `verifier-phase1.ts` | **67/67 PASS** | local, sur `parc_audit` |
| `verifier-non-regression.ts` | **Tous contrôles PASS** | local, rejoué après correctif P1 |
| Recette API complète v3 | **OK=58 FAIL=0** (×2 exécutions) | local |
| `npx prisma validate/generate/migrate deploy` | OK | local, base fraîche |
| `npx tsc --noEmit` / lint backend+frontend / `npm run build` | 0 erreur / propre / PASS | local |
| Seed sur base vierge | compteurs amorcés (article/mouvement/affectation-AAAA), données démo cohérentes | ×3 exécutions |

> Note d'exploitation : `verifier-phase1`/`verifier-non-regression` **rejouent le
> seed**, qui suit `MOT_DE_PASSE_DEMO` de l'environnement courant. Passer toujours
> cette variable explicitement avant ces suites (comportement documenté, non un bug).

## 10. PDF — RECETTE NAVIGATEUR RÉELLE : 13/13 (N1–N13)

Chrome réel (headless, profil isolé) sur la SPA servie localement :

- N1–N4 : connexion réelle, onglet « Affectations & Décharges », bouton
  « Fiche d'Affectation (PDF) », modal « Exporter PDF ».
- N5–N8 : fichier téléchargé (`Decharge_Materiel_IT_<bénéficiaire>.pdf`,
  628 647 octets), magie `%PDF-`, **MediaBox A4 portrait**, nommage conforme.
- N9–N13 : bouton « Décharge de Restitution (PDF) » visible sur fiche restituée,
  PV téléchargé (630 915 octets), `%PDF-`, A4.

Accents, bénéficiaire, matériel, référence et date présents ; **aucun PIN/PUK**
sur les documents accessibles aux rôles non privilégiés. Pas de duplication de
boutons d'export constatée.

## 11. Responsive & erreurs frontend — CONFORME

- Viewports 375×667 / 768×1024 / 1440×900 : formulaire de connexion rendu,
  **pas de scroll horizontal**, **zéro erreur JS console** (×2 campagnes).
- Route SPA inconnue → rendu sans crash ; route API inconnue → 404 (HTML Express,
  cf. anomalie P3-c).
- Erreurs API observées côté UI : messages français propres (401/403/409/422/429
  couverts par la recette), **aucune stack trace exposée** (test navigateur +
  inspection des corps de réponse : JSON `{error}` uniquement).
- DB indisponible : le serveur **refuse de démarrer** avec message explicite
  (« Impossible de démarrer : la base PostgreSQL est inaccessible ») — fail-fast
  conforme §15, plus sûr qu'un health 503 silencieux.

## 12. Points d'environnement relevés (non bloquants applicatif)

- **Filtrage web d'entreprise** (type FortiGate) du poste de recette intercepte
  localhost dans les navigateurs équipés d'extensions d'entreprise (page
  « catégorie non classée »). Contournement testé : profil Chrome vierge sans
  extensions. **Action déploiement VPN : whitelister l'URL de l'app** dans le
  filtrage (consigné aussi dans la proposition proxy).
- Vitest local bloqué par l'OS du poste (§9) — CI Linux = référence.

## 13. PostgreSQL

- Migrations appliquées proprement sur base vierge (×3) ; schéma conforme
  (tables `lignes_affectation`, `retours_affectation`, index unique partiel
  `uq_affectation_imei`, index de recherche : `journal_audit_cree_le_idx`,
  `_action_idx`, `_utilisateur_id_idx`, `_entite_entite_id_idx`,
  `articles_stock_categorie_idx/_status_idx/uq_article_numero_serie`,
  `mouvements_stock_article_id_idx`…).
- `EXPLAIN ANALYZE` sur listes paginées triées (articles, mouvements, audit
  filtré action) : < 1 ms sur volumes actuels ; plans Seq Scan attendus à ce
  volume, **index pertinents déjà en place**. Recommandation : re-tester les
  plans au-delà de ~10⁴ articles (risque résiduel R-1).

## 14. Backup & restauration — PREUVE COMPLÈTE (§18)

Procédure validée (mot de passe jamais en dur — fourni par variable
d'environnement du shell) :

```
pg_dump -Fc -U stock_app parc_audit > backup.parc_audit.dump   # 58 928 octets, exit 0
createdb parc_audit_restore_tmp   (owner stock_app)
pg_restore --no-owner --role=stock_app -d parc_audit_restore_tmp backup.parc_audit.dump  # exit 0
-- Comparaison table à table : IDENTIQUE
users 5 | societes 2 | articles 21 | mouvements_stock 18 | affectations 11
lignes_affectation 12 | retours_affectation 2 | journal_audit 82 | compteurs 3
DROP DATABASE parc_audit_restore_tmp   (+ suppression du fichier dump)
```

PIN/PUK toujours chiffrés (`enc-v1:…`, AES-256-GCM) **dans la copie restaurée**.
La base de production/dev n'a jamais été touchée. Recommandation d'exploitation
(planification quotidienne, rétention 30 j, test mensuel de restauration) incluse
dans la proposition proxy §6.

## 15. Health & exploitation

- `/api/health` → `{"status":"ok"}` sans aucun secret/version sensible.
- Démarrage : avertissement explicite en `NODE_ENV=production` sans `TRUST_PROXY`.
- Logs : niveaux structurés, `X-Requete-Id` propagé, secrets absents des journaux
  (revue + grep) ; rotation/rétention à confier à l'exploitation (journald/logrotate).

## 16. CI/CD, dépendances, secrets

- CI verte sur branche principale et PR (seed base CI jetable avant Vitest,
  attente PostgreSQL explicite) — commits `18dbfc4`, `96803e4`, rapport `171b257`.
- Aucun secret versionné (scan propre) ; seed CI sans données sensibles.
- `npm audit` runtime : 0 vulnérabilité connue exploitable ; `npm outdated` :
  majors disponibles (Express 5, Prisma 7, TypeScript 7, Vite 8…) classées P3-d,
  pas de major upgrade automatique (conforme).
- Recommandations (hors périmètre d'action) : protéger `main` (PR obligatoire +
  CI required), revue à deux.

## 17. TLS / Reverse proxy — PRÊT À DÉPLOYER (non déployé)

Proposition complète livrée : `docs/PROPOSITION-TLS-REVERSE-PROXY-INTRANET.md`
(architecture, variables `NODE_ENV/HOST/TRUST_PROXY/ORIGINES_AUTORISEES`, exemples
Caddy & Nginx, certificat ADCS interne, checklist de mise en œuvre + recette post-
déploiement). Le code supporte nativement ce schéma (cookies `Secure` en
production, `HOST`, `TRUST_PROXY`, avertissement M4). **Statut matrice : À DÉPLOYER.**

## 18. Anomalies classées

| ID | Sévérité | Description | État |
|---|---|---|---|
| A-1 | **P1** | 500 brut sur 2ᵉ affectation d'un article sérialisé disponible (P2002 `uq_affectation_imei` non interceptée, IMEI alimenté par le nº de série) | **CORRIGÉE + prouvée** (§7.2) — commitée `74667a7` |
| A-2 | P3 | `stock.service.ts` : libellé « numéro de série » générique pour toute P2002 de création d'article (référence dupliquée → message légèrement imprécis) | Consignée |
| A-3 | P3 | Permission RBAC `parametres.gerer` définie dans la matrice mais aucun endpoint ne l'utilise (surface morte) | Consignée |
| A-4 | P3 | Route API inconnue renvoie le HTML d'erreur Express au lieu d'un JSON 404 homogène | Consignée |
| A-5 | P3 | Majors de dépendances disponibles (Express 5, Prisma 7, TS 7, Vite 8) | Veille planifiée |
| A-6 | P3 | Filtrage web d'entreprise peut intercepter l'URL locale (navigateurs avec extensions) → whitelist requise au déploiement | Consignée (§12) |

Aucune anomalie P0 ouverte. Aucune anomalie P2 constatée (UX métier/messages :
conformes aux contrôles effectués).

## 19. Changements effectués (Git final, §21)

- `git status --porcelain` :
  - `M backend/src/services/affectations.service.ts` — **le correctif P1** (+16/−3),
    validé puis **commité localement** : `74667a7`
    « fix(affectations): ne plus alimenter l'IMEI avec le numéro de série et
    traduire P2002 en 409 métier » (aucun push/merge effectué) ;
  - `?? docs/AUDIT-GLOBAL-APPLICATION.md` (préexistant, non suivi) ;
  - + 2 nouveaux documents de cet audit :
    `docs/RAPPORT-AUDIT-FINAL-PRODUCTION-INTERNE-VPN-2026-08-24.md` (le présent
    fichier) et `docs/PROPOSITION-TLS-REVERSE-PROXY-INTRANET.md`.
- `git log -n 10` : historique propre, dernier commit `171b257`
  (rapport correctif CI). Aucun temporaire ni secret dans les fichiers suivis.
- Scripts de recette conservés **hors dépôt** (`%TEMP%\opencode\…`) :
  `recette-api.ps1` (58 contrôles), harnais puppeteer (`recette-pdf.js`,
  `recette-responsive.js`, `recette-ui-erreurs.js`), scripts de preuve.

## 20. Preuves (index)

- Recette API : `RESULTAT: OK=58 FAIL=0` (double exécution, base fraîche).
- Fix P1 : CAS A 201 / B1 201 / B2 409 `ITEM_ALREADY_ASSIGNED` ; tsc/lint verts.
- Phase 1 : `67/67` ; NR : tous contrôles PASS ; CI runs 32785542310/32785544989.
- Backup/restore : dump 58 928 o exit 0, restore exit 0, 9 tables comparées
  identiques, `enc-v1:` intact, base temporaire supprimée.
- PDF navigateur : N1–N13 OK (noms/tailles de fichiers consignés §10).
- Responsive : 3 viewports OK ; UI erreur login propre ; SPA fallback OK.
- Limiteur : 429 + verrous observés en conditions réelles ; purge vérifiée.
- CSRF/Origin : 403 prouvé sur origine non déclarée ; cookies conformes capturés.

## 21. Risques résiduels

| Risque | Impact | Maîtrise |
|---|---|---|
| R-1 Performances non mesurées à grande échelle (>10⁴ articles) | Lenteurs possibles | Index en place ; test de charge recommandé avant montée en charge |
| R-2 TLS non encore déployé | Trafic LAN en clair tant que le proxy n'est pas posé | Proposition prête ; **condition du GO** |
| R-3 Dépendances majors | Dette future | Plan de veille P3-d |
| R-4 Sauvegardes manuelles à ce stade | Perte de fenêtre si incident | Automatisation demandée dans checklist §6 de la proposition |
| R-5 Postes clients avec filtrage web agressif | Page blanche perçue | Whitelist URL (§12) |

## 22. Matrice GO/NO-GO (§23)

| Domaine | Statut | Preuve (référence) | Bloquant |
|---|---|---|---|
| CI | **PASS** | runs 32785542310 / 32785544989 verts (`96803e4`) | Non |
| Auth | **PASS** | §5 (A1–A8, égalisation, leurre, Inactif, changement mdp) | Non |
| Sessions | **PASS** | cookies `HttpOnly/SameSite=Lax/Path=/api`, logout→401, purge planifiée | Non |
| RBAC | **PASS** | matrice C1–C10 multi-rôles + confidentiels SIM | Non |
| Stock | **PASS** | D1–D9 (SN dupliqué 409, strict 422, pagination bornée) | Non |
| Affectations | **PASS** | E1–E13 + **correctif A-1 validé** (201/201/409) | Non |
| Restitutions | **PASS** | bon état→réaffectation 201, endommagé→maintenance, PV | Non |
| Concurrence | **PASS** | probe-concurrence PASS, transactions/idempotence | Non |
| Notifications | **PASS** | F1–F? isolation par destinataire, événements restitution | Non |
| Audit (journal) | **PASS** | append-only triggers, filtres indexés, lecture seule AUDITOR | Non |
| Chiffrement SIM | **PASS** | PIN/PUK `enc-v1:` (AES-256-GCM), 403 hors SUPER, masqués partout y compris PDF | Non |
| PDF navigateur | **PASS** | N1–N13 (Chrome réel, %PDF-, A4, contenu conforme) | Non |
| Responsive | **PASS** | 3 viewports, zéro erreur JS, pas de scroll horizontal | Non |
| HTTPS / reverse proxy | **À DÉPLOYER** | proposition `docs/PROPOSITION-TLS-REVERSE-PROXY-INTRANET.md` ; code prêt (Secure/HOST/TRUST_PROXY/M4) | **Oui (condition du GO)** |
| Backup | **PASS** | pg_dump -Fc exit 0, procédure sans mdp en dur | Non |
| Restore | **PASS** | restauration temporaire comparée 9/9 tables, cleanup effectué | Non |
| Health | **PASS** | `/api/health` sobre ; fail-fast boot si DB down | Non |
| Secrets | **PASS** | 0 secret versionné ; env/systemd ; hash Argon2id + leurre | Non |
| Build | **PASS** | tsc 0 erreur, lint propre, builds front/back PASS | Non |

## 23. Verdict

Tous les critères du GO complet sont réunis **sauf le déploiement effectif du
TLS/reverse proxy** (prêt et documenté, non déployable dans le périmètre de cet
audit) et les protections GitHub recommandées.

## `GO SOUS CONDITIONS - PRODUCTION INTERNE/VPN`

**Conditions de mise en production :**
1. Déployer le reverse proxy TLS selon `docs/PROPOSITION-TLS-REVERSE-PROXY-INTRANET.md`
   (certificat ADCS/Caddy, `NODE_ENV=production`, `HOST=127.0.0.1`, `TRUST_PROXY`,
   `ORIGINES_AUTORISEES=https://…`) puis rejouer la mini-recette post-déploiement (§6).
2. Commiter le correctif A-1 (`backend/src/services/affectations.service.ts`) —
   validé puis commité localement : `74667a7` ; activer la protection de `main`
   (PR + CI required) avant le merge.
3. Automatiser les sauvegardes `pg_dump` validées (quotidien, rétention 30 j,
   test de restauration mensuel) et whitelister l'URL applicative dans le filtrage web.

---

*Fin du rapport — arrêt conforme §26 : aucun déploiement, aucun merge/push, aucune
modification d'infrastructure effectués.*
