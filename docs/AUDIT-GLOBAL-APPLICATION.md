# RAPPORT D'AUDIT GLOBAL — Application de Gestion de Parc IT « STOCK-MANAGEMENT »

**Date de l'audit** : 24 août 2026
**Version auditée** : branche `main` (= `convergence-parc-it`), commit `a4b5495`
**Dépôt** : https://github.com/radouanezakaria61/STOCK-MANAGEMENT
**Périmètre** : backend Express + Prisma + PostgreSQL, frontend React + Vite, scripts de vérification, intégration continue
**Auditeur** : revue automatisée assistée par IA, sur code source et exécution réelle (aucune partie du code n'a été exclue)

---

## 1. Synthèse exécutive

L'application est une solution interne de **gestion de parc informatique** (inventaire matériel, stock, affectations aux collaborateurs avec formulaires officiels Distra IT-01/IT-02, restitutions, notifications, journal d'audit) structurée en monorepo `backend/` + `frontend/`.

| Dimension | Évaluation | Commentaire |
|---|---|---|
| Architecture | ✅ Solide | Séparation stricte route → service → Prisma, sérialiseur unique |
| Sécurité | ✅ **Très renforcée** | Argon2id, sessions serveur, anti-CSRF, limiteur adaptatif, TRUST_PROXY strict, chiffrement AES-256-GCM des PIN/PUK, CSP stricte |
| Contrôle d'accès | ✅ Conforme | RBAC en base, permissions vérifiées côté serveur sur chaque route mutante |
| Intégrité des données | ✅ Garantie | Historiques immuables (triggers PostgreSQL), soft delete, argent en `Decimal`, audit dans la transaction |
| Qualité & tests | ✅ Bonne | 110 contrôles Vitest + 3 suites de non-régression tsx, tout au vert au 23/08/2026 |
| Performance | ✅ Correcte | Pagination serveur généralisée, bundle principal 227 ko, jsPDF en chargement différé |
| Observabilité | ✅ Bonne | Journal applicatif horodaté + identifiant de requête ; journal d'audit en base inviolable |
| CI/CD | 🟡 Prête | Workflow GitHub Actions complet mais sans historique d'exécution à la date de l'audit |

**Verdict global : application prête pour un audit final de production interne (réseau interne / VPN)**, sous réserve des limites listées en §10.

---

## 2. Architecture technique

```
Navigateur ── HTTP ──▶ Vite dev (3000) / SPA buildée servie par Express (prod)
                        │ proxy /api
                        ▼
              Express (backend, port 3001)
                route (validation Zod, permissions)
                  → service (métier, contexte utilisateur)
                      → Prisma (données)
                        → PostgreSQL 16 (+ triggers d'immuabilité)
```

- **Backend** : Node.js ≥ 20 (exécuté ici sous Node 24), TypeScript strict, ~4 500 lignes dans `src/` — 7 services, 5 fichiers de routes, middlewares dédiés (auth, CSRF, idempotence, request-id).
- **Frontend** : React 19 + Vite 6 + Tailwind 4, ~7 850 lignes — 8 modules métier dont `MaterialAssignmentModule` (affectations/restitutions, décomposé en sous-composants d'impression), `JournalAuditModule`, `DashboardOverview`.
- **Règle d'or respectée** : une route ne contient jamais de logique métier ni d'appel Prisma direct ; un service ne connaît jamais `req`/`res`. Signature systématique `service(contexte, données)` où le contexte porte l'utilisateur, ses permissions et son adresse IP.
- **Réponses API normalisées** : `{ status, data }` en lecture, `{ message, data }` en mutation, `{ error }` en erreur. Clés en français (`creeLe`, `derniereConnexion`…), aucune traduction de champ à la frontière.

---

## 3. Modèle de données et intégrité

**17 modèles Prisma**, **8 migrations** appliquées, PostgreSQL 16.

Garanties vérifiées pendant l'audit :

1. **Immuabilité de l'historique** — triggers PostgreSQL refaisant tout `UPDATE`/`DELETE` direct sur les tables historiques (`MouvementStock`, `Affectation`, `JournalAudit`). Vérifié par tests : les deux opérations sont refusées au niveau base, pas seulement applicatif.
2. **Suppression = soft delete** (`supprimeLe`) sur les entités métier, avec clés étrangères `onDelete: Restrict` ; l'extension Prisma filtre automatiquement les enregistrements supprimés.
3. **Argent en `Decimal @db.Decimal(12,2)`**, conversion en nombre uniquement dans le sérialiseur unique — jamais de `Float`.
4. **Dates en `DateTime`**, formatage français à l'affichage ; le parseur applicatif `versDate()` rejette les dates impossibles (correctif audité : `2026-02-30` → erreur `DATE_INVALIDE`).
5. **Audit transactionnel** : toute écriture métier journalise dans `JournalAudit` **dans la même transaction** — un échec d'audit annule l'opération.
6. **Idempotence** des créations sensibles (clé générée côté client, régénérée à l'ouverture du formulaire) : un double clic ne crée jamais deux fiches ni deux sorties de stock.
7. **Concurrence** : verrou `SELECT … FOR UPDATE` sur l'équipement avant affectation — la sonde de concurrence confirme **0 incohérence de quantité** sous charge parallèle.

---

## 4. Sécurité

### 4.1 Authentification et sessions
- Mots de passe hachés **Argon2id** (paramètres OWASP), comparaison à temps quasi constant (hash leurre quand le compte n'existe pas — pas de fuite d'existence par latence).
- Sessions **côté serveur** en base, cookie `gsit_session` `httpOnly` ; inactivité 30 min, glissante 8 h, durée absolue 12 h (configurable).
- Connexion par username **ou** email, insensible à la casse.
- Changement de mot de passe forcé à la première connexion des comptes administratifs (`doitChangerMdp`).

### 4.2 Anti-force-brute (M2)
Double compteur en cascade : par **adresse IP seule** puis par couple (**IP + identifiant**) ; blocages progressifs (30 s → 4 min), en-têtes `Retry-After`, purge automatique des compteurs morts. Testé : usurpation d'en-têtes `X-Forwarded-For` ignorée tant que le proxy n'est pas déclaré de confiance.

### 4.3 Anti-CSRF (M1)
Toute requête mutante doit porter l'en-tête `X-Requested-With: XMLHttpRequest` (impossible à forger depuis un formulaire tiers) ; complément `Origin` vs liste `ORIGINES_AUTORISEES`. Les clients scriptés posent l'en-tête explicitement (documenté dans `docs/DEPLOIEMENT.md`).

### 4.4 Confiance proxy et liaison réseau (M4)
Grammaire étendue et **stricte** pour `TRUST_PROXY` (entier 1..10, mots-clés loopback/linklocal/uniquelocal, IP, CIDR, combinaisons). Une valeur invalide **empêche le démarrage** — aucune interprétation silencieuse. Sans proxy déclaré, les en-têtes `X-Forwarded-*` ne sont pas crus. Variable `HOST` pour lier l'écoute (0.0.0.0 LAN ou 127.0.0.1 derrière reverse-proxy local).

### 4.5 Données confidentielles au repos
Les codes **PIN/PUK des cartes SIM** sont chiffrés **AES-256-GCM** (clé 32 octets hors dépôt, `CLE_CHIFFREMENT`). Ils ne transitent jamais dans les listes : leur révélation est un endpoint dédié, soumis à la permission `affectations.confidentiels` et **auditée**. La sonde de sécurité confirme : **aucune donnée sensible dans le journal d'audit exportable**.

### 4.6 En-têtes et CSP
CSP stricte en production : `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, etc. Seule exception documentée : `'unsafe-inline'` sur `style-src`, nécessaire aux attributs `style` calculés par React (barres de progression, graphiques Recharts) — analyse consolidée dans `app.ts` : le build ne contient aucun `<script>` ni `<style>` inline, le vecteur réel (injection de script) reste fermé.

### 4.7 Hygiène de dépôt
- Aucun secret versionné : `.env` ignorés (vérifié), seuls des `.env.example` sans valeurs réelles sont suivis.
- Aucun mot de passe de démo statique dans le code : lu depuis l'environnement (≥ 12 caractères) ou **généré aléatoirement et affiché une seule fois** ; interdit en production sans variable explicite.
- Les journaux applicatif et d'audit ne contiennent jamais de secret.

### 4.8 Minimisation des sorties API
- DTO **allowlist** sur les utilisateurs : `motDePasseHash`, `tokenHash`, horodatages internes et marqueurs de suppression ne quittent **jamais** le serveur (testé négativement).
- Listes d'affectations : secrets masqués par défaut.

---

## 5. Contrôle d'accès (RBAC)

9 permissions, 6 rôles, matrice stockée en base et appliquée par `exigerPermission()` sur chaque route sensible — masquer un bouton côté client n'est jamais le contrôle.

| Permission \ Rôle | SUPER_ADMIN | IT_MANAGER | IT_TECHNICIAN | STOCK_MANAGER | AUDITOR | EMPLOYEE |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| parc.consulter | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| utilisateurs.consulter | ✔ | ✔ | — | — | ✔ | — |
| utilisateurs.gerer | ✔ | — | — | — | — | — |
| societes.gerer | ✔ | — | — | ✔ | — | — |
| stock.ecrire | ✔ | ✔ | ✔ | ✔ | — | — |
| affectations.ecrire | ✔ | ✔ | ✔ | ✔ | — | — |
| affectations.confidentiels | ✔ | ✔ | — | — | — | — |
| audit.consulter | ✔ | ✔ | — | — | ✔ | — |
| parametres.gerer | ✔ | — | — | — | — | — |

La matrice complète est testée par la suite Vitest d'intégration (37 contrôles) : chaque rôle contre chaque permission, en base réelle.

---

## 6. API HTTP — inventaire

27 endpoints (préfixe `/api`), validation **Zod systématique** à la frontière, pagination normalisée :

```jsonc
{ "items": [...], "pagination": { "page": 1, "limite": 50, "total": 123, "pages": 3 } }
```

Plafond serveur : 200 éléments/page, défaut 50, tris déterministes (`creeLe desc, id desc`) — pages stables et reproductibles (testé).

| Méthode | Route | Rôle fonctionnel |
|---|---|---|
| GET | `/health` | Sonde de santé (publique, sans donnée) |
| GET | `/data` | **Déprécié UI** — conservé pour les scripts internes |
| GET / POST | `/societes` · PUT `/:id` · POST `/:id/statut` | Gestion des sociétés (étiquettes/filtres) |
| GET / POST | `/users` · PUT `/:id` · POST `/:id/status` · DELETE `/:id` | Cycle de vie des comptes (soft delete) |
| GET | `/stock` · `/stock/search` · POST `/stock` · PUT `/:id` · DELETE `/:id` | Articles de stock |
| GET | `/mouvements` | Historique paginé des mouvements (lecture seule) |
| POST | `/stock/:id/movement` | Mouvements (entrée/sortie/ajustement, invariants testés) |
| GET | `/assignments` · POST `/assignments` · DELETE `/:id` | Affectations |
| GET | `/assignments/:id/confidentiels` | Révélation audité PIN/PUK (permission dédiée) |
| POST | `/assignments/:id/return` | Restitution (génère le PV imprimable) |
| GET | `/notifications` · POST `/lue-tout` · POST `/:id/lue` | Notifications utilisateur |
| GET | `/audit` | Journal d'audit paginé (permission `audit.consulter`) |

---

## 7. Qualité logicielle et tests

| Suite | Périmètre | Résultat (23/08/2026) |
|---|---|---|
| **Vitest** (12 fichiers) | Libs pures (dates/références, TRUST_PROXY, AES-GCM, machine à états, Zod, sérialiseur) + intégrations en base réelle (RBAC 37 contrôles, notifications, invariants stock, immutabilité, pagination) | ✅ **110/110** |
| `verifier-phase1.ts` | Auth, sessions, RBAC, rate limiting, en-têtes — bout en bout sur serveur réel | ✅ 67/67 |
| `verifier-non-regression.ts` | Immutabilité base, index partiel alertes, idempotence, nettoyage | ✅ TOUS PASS |
| `probe-concurrence.ts` | Verrous concurrents, cohérence quantités, absence de secrets dans l'audit | ✅ 0 incohérence |
| `tsc --noEmit` ×2 | Backend + frontend stricts | ✅ 0 erreur |
| **ESLint** (typescript-eslint flat config) | Backend | ✅ 0 erreur, 41 avertissements (`any` documentés, durcissement progressif) |
| `npm run build` racine | Backend (tsc) + frontend (Vite) | ✅ succès |

Bugs réels détectés et corrigés grâce à cette couverture (exemples audités) : dates impossibles acceptées par `versDate()`, régression sur identifiants locaux après fusion externe, imports morts.

---

## 8. Performance

- **Pagination serveur** sur toutes les listes volumineuses (stock, mouvements, utilisateurs, affectations, notifications, audit) — plus de transferts non bornés vers le navigateur.
- **Bundle frontend** : chunk principal ramené de >500 ko à **227 ko (70 ko gzip)** via import dynamique de jsPDF (391 ko chargés seulement au premier export PDF) ; découpage par module (Dashboard, Stock, Affectations, Audit…). Plus aucun avertissement Vite.
- Index PostgreSQL dont **index partiels** (ex. une seule alerte OUVERTE par entité+destinataire — contrainte testée).
- Purge planifiée des données techniques expirées (sessions, clés d'idempotence, compteurs du limiteur) toutes les 6 h par défaut.

---

## 9. Observabilité

- **Journal applicatif** : horodaté UTC, niveaux, contexte de requête propagé via AsyncLocalStorage — chaque ligne d'erreur porte `[req:<id>]` corrélé à l'en-tête de réponse `X-Requete-Id` (vérifié live).
- **Journal d'audit en base** : immuable (triggers), paginé, filtrable, consultable via permission dédiée ; ne contient aucune donnée sensible.
- **Notifications** : dédupliquées par clé métier (pas de doublon d'alerte pour la même cause), isolation testée entre destinataires.

---

## 10. Limites connues et recommandations

| # | Limite constatée | Risque | Recommandation priorisée |
|---|---|---|---|
| L1 | Export PDF non cliqué manuellement en navigateur lors de l'audit (validé par types + build uniquement) | Faible | Cliquer les 3 exports (IT-01, IT-02, restitution) lors de la recette finale |
| L2 | Plafond 200 éléments/page sans pagination avancée côté UI | Faible (usage interne) | Pagination UI si l'annuaire dépasse 200 comptes |
| L3 | Endpoint `/api/data` conservé pour les scripts tsx | Faible | Le retirer après migration des scripts |
| L4 | 41 avertissements ESLint résiduels (`any` documentés) | Faible | Durcissement progressif vers `unknown` |
| L5 | CI fraîchement activée (premier push récent) — pas encore d'historique vert | Moyen | Vérifier le premier run GitHub Actions et le rendre bloquant (branch protection) |
| L6 | Pas de HTTPS natif (déploiement LAN prévu derrière VPN/reverse-proxy) | Moyen selon exposition | TLS au niveau du reverse-proxy ; cookie `Secure` en production |
| L7 | Sauvegarde/restauration PostgreSQL non outillée dans le dépôt | **Élevé en production** | `pg_dump` planifié + test de restauration documenté |
| L8 | Monitoring/alerting externe absent (logs fichiers locaux) | Moyen | Centralisation des logs + sonde externe sur `/api/health` |

---

## 11. Conclusion

Le socle technique, la sécurité et l'intégrité des données atteignent un niveau remarquable pour une application interne : les mécanismes critiques (immutabilité de l'historique, chiffrement des secrets métier, RBAC serveur, anti-CSRF, anti-force-brute) sont **implémentés en profondeur et prouvés par tests exécutés**, pas seulement déclarés. La dette restante est faible, documentée et sans impact bloquant connu.

**Recommandation : lancer l'audit final de recette (parcours métier complets avec comptes réels, exports PDF cliqués, sauvegarde/restauration testée) avant mise en production interne/VPN.**

---
*Rapport généré le 24 août 2026 à partir du code commit `a4b5495` et des exécutions de validation du 23 août 2026.*
