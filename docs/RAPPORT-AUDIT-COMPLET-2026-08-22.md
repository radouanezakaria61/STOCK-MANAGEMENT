# Rapport d'audit complet — IT Stock Manager (STOCK-MANAGEMENT)

> **Date :** 22 août 2026 · **Périmètre :** intégralité du dépôt `C:\Users\HP\Documents\Default Project\STOCK-MANAGEMENT`
> **Audité contre :** `AGENTS.md` (règles non négociables), `docs/02-plan-convergence.md` v1.2, bonnes pratiques OWASP.
>
> **Vérifications réellement exécutées** (pas de conclusion sans exécution) :
> - Lecture intégrale du backend (`src/` : app, routes, middleware, services, lib — ~3 800 lignes TS)
> - Lecture du schéma Prisma complet (409 lignes, 15 modèles) et des migrations (dont `chantier3_5_durcissement`)
> - Lecture du seed, de `.env.example`, de `.env`, `.gitignore`, scripts racine
> - Lecture du frontend : `App.tsx`, `LoginPage.tsx`, structure des 7 composants, `vite.config.ts` (~5 800 lignes balayées, composants géants survolés)
> - Historique git complet (10 commits, recherche de secrets dans l'historique sur `CLE_CHIFFREMENT`, `.env`)
> - `npx tsc --noEmit` backend : **PASSE** · frontend : **PASSE**
> - Vérification : aucun `dangerouslySetInnerHTML`/`eval` côté frontend ; aucune dépendance `cors` ; aucun test présent

---

## 1. Synthèse générale

Application full-stack **jeune mais remarablement structurée** : Express + Prisma/PostgreSQL 16 (backend, port 3001), React 19 + Vite + Tailwind 4 (frontend, port 3000). Le socle sécurité issu du chantier 3.5 est solide et va au-delà de ce qu'on voit habituellement sur une application interne.

**Points forts constatés (à préserver) :**

| Domaine | Constat vérifié |
|---|---|
| Hachage mots de passe | Argon2id, paramètres OWASP (m=19456, t=2, p=1) — `lib/auth.ts` |
| Sessions | Jeton 48 octets aléatoire, seule l'empreinte SHA-256 en base, expiration glissante plafonnée, révocation immédiate (changement MDP, désactivation, suppression) |
| Anti-énumération | Message de login unique + hash leurre à temps quasi constant — `auth.routes.ts` |
| RBAC | Tables Role/Permission serveur, `exigerPermission()` sur **toutes** les routes y compris les GET — `routes/index.ts` |
| Audit | Écrit dans la transaction métier même (`journaliserDansTx`), trigger PostgreSQL d'immuabilité, instantanés avant/après filtrés par liste blanche (`instantane()`) |
| Secrets SIM | PIN/PUK chiffrés AES-256-GCM au repos, jamais dans les listes, révélation via endpoint dédié permissionnée + tracée — `chiffrement.ts`, `affectations.service.ts` |
| Intégrité données | Decimal(12,2) pour l'argent (plus de parseFloat), DateTime partout, soft delete + FK Restrict, machine à états du matériel, invariant quantités en CHECK base, verrous `FOR UPDATE`, compteur transactionnel atomique pour les références |
| Idempotence | Middleware serveur avec empreinte de corps et détection concurrence — `idempotence.ts` |
| Sérialisation | Filtre par liste blanche inverse documentée (motDePasseHash, tokenHash, supprimeLe jamais exposés) |

**En revanche**, plusieurs failles et manques réels subsistent, détaillés ci-dessous.

---

## 2. Constats par criticité

### 🔴 CRITIQUE

#### C1. Travail important non commité (21 fichiers modifiés/créés)

- **Preuve :** `git status` → 18 fichiers `M` dont `app.ts`, `auth.ts`, `routes/index.ts`, `affectations.service.ts`, `schema.prisma`, `seed.ts`, plus 3 non suivis dont **`backend/src/lib/chiffrement.ts` (le module de chiffrement AES-GCM entier !)** et la migration `20260823120000_chantier3_5_durcissement`.
- **Impact :** tout le chantier de durcissement 3.5 (chiffrement PIN/PUK, permissions de lecture, notifications par destinataire) n'existe que sur le disque. Une perte de disque, un `git clean` ou un checkout accidentel efface la couche sécurité critique. Impossible de reproduire un build depuis git.
- **Fichiers :** tout le diff en cours.
- **Correction :** commiter immédiatement (un commit par thème ou un commit unique « chantier 3.5 »), puis pousser vers le dépôt distant s'il existe.
- **Priorité : 1 — aujourd'hui.**

#### C2. Limiteur de connexion en mémoire alors que la table persistante existe mais est inutilisée

- **Preuve :** `middleware/auth.ts` lignes ~55–110 : `const tentatives = new Map<string, TentativesConnexion>()` — purement mémoire. Le modèle Prisma `TentativeConnexion` (« Limitation… PERSISTANTE (chantier 3.5): survit aux redémarrages ») existe dans `schema.prisma` et sa table est créée par migration, mais **aucun code ne lit ni n'écrit cette table** (`grep tentativeConnexion backend/src` → 0 résultat).
- **Impact :** (a) un redémarrage du serveur réinitialise tous les compteurs anti-bruteforce ; (b) si le process est lancé en plusieurs instances, chaque instance a son propre compteur (×N tentatives) ; (c) divergence grave entre documentation du schéma et réalité.
- **Correction :** brancher `enregistrerEchecConnexion`/`verifierLimiteConnexion` sur la table `TentativeConnexion` (upsert atomique), garder la Map comme cache optionnel.
- **Priorité : 1.**

### 🟠 HAUTE

#### H1. `GET /api/data` expose l'annuaire complet des utilisateurs à tout rôle « lecture »

- **Preuve :** `dashboard.service.ts` renvoie `utilisateurs` complets (name, email, phone, department, role…) ; la route exige seulement `parc.consulter`, accordée à **EMPLOYEE inclus** (matrice du seed).
- **Impact :** n'importe quel employé consulte l'annuaire complet avec rôles et coordonnées. Contradiction avec la permission dédiée `utilisateurs.consulter` qui existe déjà.
- **Correction :** retirer `utilisateurs` de l'agrégat `/data` (ou le masquer selon permission), faire charger les utilisateurs par `/api/users` uniquement aux détenteurs de `utilisateurs.consulter`. Adapter le frontend en conséquence.
- **Priorité : 2.**

#### H2. Aucune pagination ni filtrage serveur — agrégats complets en mémoire

- **Preuve :** `obtenirDonneesGlobales()` fait 5 `findMany` sans `take`/`skip` ; `listerAffectations` inclut `items` + `returnRecord` de toutes les fiches ; `rechercherStock` charge tout puis filtre en JS (`resultats.filter(...)`).
- **Impact :** temps de réponse et consommation mémoire croissent linéairement avec l'historique (qui, par règle métier, ne se supprime **jamais**) ; le SPA re-télécharge tout le parc à chaque refresh (`App.tsx` ligne 160).
- **Correction :** pagination curseur sur mouvements/affectations/journal, recherche stock poussée en SQL (`where: { OR: [...] }`), endpoints dédiés par onglet au lieu de l'agrégat monolithique.
- **Priorité : 2 (bloquant avant mise en production avec données réelles).**

#### H3. Aucun test automatisé, aucune CI

- **Preuve :** 0 occurrence de script `test` dans les deux `package.json` ; pas de Vitest/Playwright ; pas de workflow CI. La non-régression repose sur `scripts/verifier-non-regression.ts` manuel.
- **Impact :** le projet applique des règles strictes (machine à états, invariants quantités, transitions) précisément celles qu'un test de caractérisation sécurise. Toute évolution risque une régression silencieuse.
- **Correction :** Vitest sur les services (stock, affectations) avec base PostgreSQL jetable (testcontainers ou DB temporaire — `scripts/check-db-temp.ts` suggère que l'infrastructure existe partiellement) ; CI GitHub Actions lançant `tsc --noEmit` + migrations + tests.
- **Priorité : 2.**

#### H4. Journal d'audit invisible : permission `audit.consulter` seedée mais aucun endpoint

- **Preuve :** la permission existe (`seed.ts` ligne ~40) et est accordée à SUPER_ADMIN/IT_MANAGER/AUDITOR, mais `grep journalAudit backend/src/routes backend/src/services` ne trouve **aucune route de consultation**. Le journal ne se consulte qu'en SQL direct (Prisma Studio).
- **Impact :** le rôle AUDITOR est incapable d'exercer sa fonction depuis l'application ; la traçabilité des révélations PIN (`CONFIDENTIAL_REVEALED`) n'est pas exploitée.
- **Correction :** `GET /api/audit` (permission `audit.consulter`, paginée, filtres action/utilisateur/dates). Chantier prévu par l'architecture — à prioriser.
- **Priorité : 2.**

#### H5. CSP désactivée volontairement

- **Preuve :** `app.ts` : `app.use(helmet({ contentSecurityPolicy: false }))` — commenté comme différé « phase 41+ ».
- **Impact :** en production où le backend sert le SPA, aucune protection XSS navigateur (pas de `default-src 'self'`). Le risque d'injection est bas aujourd'hui (pas de `dangerouslySetInnerHTML` trouvé), mais une seule dépendance compromise suffit.
- **Correction :** CSP minimale dès maintenant : `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` (Tailwind inline), ajuster ensuite.
- **Priorité : 2.**

### 🟡 MOYENNE

#### M1. Anti-CSRF contournable par absence d'en-tête Origin
`verifierOrigine` laisse passer toute mutation **sans** en-tête Origin (« curl passe »). C'est documenté et défendable en réseau interne, mais un navigateur ancien/plugin peut omettre Origin. Complément recommandé : exiger un en-tête custom `X-Requested-With` (non émis cross-origin sans preflight) ou un vrai jeton double-submit. Priorité 3.

#### M2. Clé de limiteur par IP+identifiant — contournement trivial
Un attaquant qui fait varier l'identifiant (et dispose de plusieurs IP) échappe à la temporisation. Ajouter aussi un compteur global par IP seule (ex. 50 échecs/h/IP → blocage) en plus du couple actuel.

#### M3. Purge d'idempotence probabiliste et sessions expirées jamais purgées
`purgerExpirees` ne tourne que si `Math.random() < 0.05` **au moment d'une requête avec clé** ; les `Session` expirées ne sont supprimées qu'à la connexion du porteur. Sur une application peu fréquentée, les tables grossissent indéfiniment. Ajouter un job périodique (`setInterval` au démarrage ou pg_cron) purgent sessions expirées + requêtes idempotentes >24 h + notifications RESOLUE anciennes.

#### M4. Serveur lié sur 0.0.0.0 sans durcissement réseau
`server.ts` écoute sur toutes les interfaces. En interne c'est voulu, mais le README ne mentionne aucun reverse proxy TLS ; le cookie n'est `Secure` qu'en production et rien ne force HTTPS derrière le proxy. Documenter le déploiement cible (TLS obligatoire, `TRUST_PROXY`) et ajouter HSTS quand TLS est en place.

#### M5. `serialNumber` généré depuis `Date.now()` — collisions possibles
`creerArticle` : `SN-${Date.now().toString().slice(-6)}` (aussi `IT-TEL-${...slice(-4)}` et assetTag implicites). Deux créations dans la même milliseconde → même SN. Utiliser `randomBytes(4).toString('hex')` ou le compteur transactionnel déjà disponible.

#### M6. Validation d'entrée partielle hors Zod
Les schémas Zod couvrent login/changement MDP, mais les gros corps métier (`EntreeAffectation` ~25 champs, `EntreeArticle`) sont validés à la main, champ par champ, avec défauts implicites (`beneficiarySite || "Berrechid"`, `authorizedBy || "Directeur Systèmes d'Information"`). Risque : champs non bornés (longueurs max absentes sur beneficiaryName, notes, deviceConfiguration…) écrits tels quels en base. Créer des schemas Zod par endpoint (AGENTS.md règle 8 l'exige formellement) avec longueurs maximales et listes fermées.

#### M7. Champs texte libres affichés sans échappement prouvé côté PDF
`pdfGenerator.ts` (1 166 lignes) injecte les données bénéficiaires dans le PDF via jsPDF/html2canvas. Pas de vulnérabilité DOM directe trouvée, mais vérifier que les chaînes utilisateur (nom, département) ne peuvent pas casser la structure du document. Faible probabilité, à contrôler lors d'un passage sur le module.

### ⚪ FAIBLE

- **F1.** `_sauvegardes/seed-initial/` contient des CSV de données (dont `appels_offres.csv` du périmètre supprimé) — ignorés par git mais présents localement ; le script `restaurer-seed-initial.ps1` n'a pas été relancé depuis la suppression des achats. À régénérer ou archiver.
- **F2.** `dev-servers.log`, `server-35.log`, `server-35.err.log` committés/laissés à la racine backend — nettoyer (déjà couverts par `*.log` dans `.gitignore` pour les futurs).
- **F3.** `.env` local contient `MOT_DE_PASSE_DEMO=Distra-Demo-2026` et la clé de chiffrement en clair : normal en dev, mais rappeler que toute fuite du poste compromet les PIN/PUK de la base de dev ; rotation de `CLE_CHIFFREMENT` interdite sans migration de re-chiffrement (prévoir le script avant la prod).
- **F4.** Deux rapports d'audit antérieurs existent déjà dans `docs/` (`RAPPORT-AUDIT-2026-08-22.md`, `RAPPORT-AUDIT-2-...`) — le présent rapport les remplace ; marquer les anciens comme obsolètes.
- **F5.** Frontend : duplication d'état (`versAppUser` force `phone: ""`, `status: "Actif"`) — le type AppUser mérite un alignement sur le profil serveur.
- **F6.** `listerUtilisateurs` renvoie `email`/`phone` sans filtrage par société — conforme à la décision « étiquette, pas cloisonnement », à revisiter si la décision change.

---

## 3. Fonctionnalités manquantes (vs architecture cible & attentes)

| Élément | État | Référence |
|---|---|---|
| Modèles `Equipement`, `Employe`, `Licence`, `Maintenance`, QR codes, garanties | **Non construits** — cœur du domaine parc IT (plan : 22 modèles manquants sur 31) | `docs/02-plan-convergence.md` |
| Consultation du journal d'audit (UI + API) | Absent (cf. H4) | architecture §audit |
| Écran « Réception / entrée en stock » (chantier 7) | Absent — saisie manuelle seule depuis la suppression des achats | plan §1.1 |
| Pagination partout | Absente (cf. H2) | — |
| Tests automatisés + CI | Absents (cf. H3) | — |
| Script de sauvegarde `pg_dump` planifié | Mentionné nulle part dans les scripts ; seul le restore du seed existe | checklist opérationnelle |
| Module maintenance dédié (envoi/reçu, SAV) | Partiel : géré via mouvements de stock et restitutions, pas d'écran ni d'entité | plan chantiers 5-6 |
| Offboarding collaborateur (retour massif) | Non implémenté | architecture Phase 1 |
| Filtrage par société dans les listes | Décidé (« étiquette ») mais aucun paramètre de filtre exposé sur les endpoints | plan v1.2 §3.2 |

---

## 4. Roadmap priorisée

### Phase 0 — Sécuriser l'existant (immédiat, < 1 jour)
1. 🔴 **C1** — Commiter/pousser le chantier 3.5 (21 fichiers).
2. 🔴 **C2** — Basculer le limiteur de connexion sur la table `TentativeConnexion`.
3. 🟠 **H1** — Retirer l'annuaire utilisateurs de `GET /api/data`.

### Phase 1 — Durcissement & robustesse (semaine 1-2)
4. 🟠 **H4** — Endpoint + UI de consultation du journal d'audit (`audit.consulter`).
5. 🟠 **H5** — Activer une CSP minimale.
6. 🟡 **M6** — Schémas Zod complets sur tous les endpoints mutateurs.
7. 🟡 **M3** — Job de purge (sessions, idempotences, notifications résolues).
8. 🟡 **M1/M2/M4** — Renfort anti-CSRF, compteur par IP, doc déploiement TLS/TRUST_PROXY.
9. 🟡 **M5** — Générateur de SN/aléa sans collision.

### Phase 2 — Passage à l'échelle & qualité (semaines 2-4)
10. 🟠 **H2** — Pagination + recherche SQL + découpage de `/api/data`.
11. 🟠 **H3** — Suite de tests Vitest (services stock/affectations : machine à états, invariants, concurrence) + CI (typecheck, migrations, tests).
12. Sauvegarde `pg_dump` planifiée + procédure de restauration testée.

### Phase 3 — Domaine métier (selon plan de convergence)
13. Chantiers restants du plan : scission ArticleStock → Equipement, Employe, Licences, Maintenance, QR codes, écran Réception, offboarding.
14. Filtrage par société dans les listes (décision actuelle : simple filtre).

---

*Rapport généré après lecture effective du code source intégral backend et balayage du frontend ; les vérifications exécutées sont listées en tête. Les constats C1/C2/H1/H4/H5 sont appuyés par des extraits localisés dans le rapport.*
