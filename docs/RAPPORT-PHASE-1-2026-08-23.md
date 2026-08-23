# Rapport Phase 1 — Durcissement & robustesse (2026-08-23)

Branche : `convergence-parc-it` · HEAD : `691e5f5` · **Aucun push** · Baseline Phase 0 (`6daa4bf`, `80575cc`, `2bdc800`) intacte.

## 1. Commits

| Commit | Chantier | Fichiers principaux | Résumé |
|---|---|---|---|
| `f57b1d2` | H4 | `audit.service.ts`, `routes/index.ts`, `validation-zod.ts`, `JournalAuditModule.tsx`, `types.ts`, `App.tsx`, `verifier-phase1.ts` | GET `/api/audit` paginée/filtrée, protégée `audit.consulter` + UI journal |
| `3495076` | H5 | `app.ts` | CSP Helmet active et adaptée à l'inventaire réel des ressources |
| `eb0410a` | M6 | `validation-zod.ts`, routes mutateurs, `verifier-non-regression.ts`, `probe-concurrence.ts` | Zod systématique à la frontière HTTP |
| `6d3d93f` | M3 | `lib/purge-technique.ts` (nouveau), `server.ts` | Purge planifiée bornée des données techniques expirées |
| `0abf955` | M1 | `middleware/auth.ts`, `auth.routes.ts`, `frontend/src/api.ts` + 8 composants, scripts de test | Marqueur anti-CSRF obligatoire sur toute mutation |
| `8f3fcf1` | M2 | `schema.prisma`, migration `20260823213000_m2_limitation_ip`, `middleware/auth.ts`, `auth.routes.ts`, `purge-technique.ts` | Limiteur par adresse IP (30 échecs/1 h → blocage 15 min), persistant |
| `06de33e` | M4 | `lib/confiance-proxy.ts` (nouveau), `app.ts`, `server.ts`, `.env.example`, `docs/DEPLOIEMENT.md` | TRUST_PROXY validé strictement, HOST paramétrable, doc déploiement |
| `691e5f5` | M5 | `lib/ids.ts`, `stock.service.ts`, `affectations.service.ts`, `App.tsx` | Références crypto-random (`referenceAleatoire`), plus de timestamps tronqués |

Découpage : M2 et M4 sont séparés bien que couplés via `trust proxy`. Raison : M2 exigeait sa propre migration et devait être validé indépendamment. La cohérence IP est garantie structurellement — les deux chantiers consomment exclusivement `req.ip` d'Express, résolue par le réglage unique `app.set("trust proxy", …)` de `app.ts`. M4 ajoute la validation stricte de cette configuration sans toucher au mécanisme.

## 2. Résultat par chantier

### H4 — Journal d'audit consultable ✅
- API `GET /api/audit` : permission serveur `audit.consulter` ; pagination serveur (défaut 20, plafond 200) ; filtres action / utilisateur / type entité / id entité / date début / date fin validés Zod ; ordre stable `{creeLe:"desc"},{id:"desc"}`.
- Défense en profondeur : tout champ ressemblant à un secret dans les instantanés avant/après est masqué avant sérialisation.
- UI : onglet « Journal d'audit » conditionné à la permission, pagination, filtres, détail avant/après.
- Tests (21 contrôles H4 du vérificateur + sondes live) : admin OK, auditeur 200, employé 403 sur l'API directe, pagination p1≠p2, total cohérent, filtres, PIN révélé absent du payload servi, pas de hash mot de passe/token. **Vert.**

### H5 — Content Security Policy ✅
- Politique finale : `default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`.
- `'unsafe-inline'` limité aux STYLES uniquement et documenté en commentaire (attributs `style` React/CSSOM). Aucun script inline dans le build Vite (vérifié sur `dist/index.html`) → `script-src 'self'` strict, sans `'unsafe-eval'`.
- `upgrade-insecure-requests` volontairement désactivé (`upgradeInsecureRequests: null`) pour que l'accès LAN HTTP direct reste possible ; le chiffrement se pilote au reverse proxy (documenté).
- Vérifié live en mode production (instance NODE_ENV=production temporaire port 3200) : document SPA avec CSP, assets servis, fallback SPA, login fonctionnel. Sondes finales : CSP présente, XCTO nosniff, Referrer-Policy no-referrer, HSTS max-age=31536000. **Vert.**

### M6 — Validation Zod systématique ✅
- Schémas ajoutés/renforcés dans `validation-zod.ts` : articles création/modification (strict), mouvements manuels (liste fermée des 5 types saisissables), recherche stock, lignes/fiches d'affectation (strip documenté des champs d'affichage hérités), restitution, sociétés (+ activation booléen strict), utilisateurs (+ changement de statut liste fermée).
- Mass assignment impossible : strict() refuse tout champ inconnu (422) sauf formulaires hérités où le strip est explicite et commenté.
- Montants : preprocess miroir de la grammaire service (« 1 250,50 MAD » → 1250.5).
- Erreurs uniformisées via le gestionnaire existant : 422 + message français, pas de détail interne.
- Tests (12 contrôles M6 + non-régression ajustée) : payloads valides (dont prix français), champ obligatoire absent, enum invalide (catégorie, type mouvement), chaîne trop longue, quantité négative, propriété inattendue refusée, tableau invalide. Les déplacements 400→422 sont couverts ; la transition interdite conserve son 409 machine à états via un article en état terminal. **Vert.**

### M3 — Purge maîtrisée des données techniques ✅
- `lib/purge-technique.ts` : sessions expirées avec grâce 1 h ; clés d'idempotence > 24 h ; compteurs morts du limiteur de connexion (C2) fenêtre close ; compteurs IP morts (M2) blocage terminé depuis 24 h.
- Journal d'audit et notifications : explicitement hors périmètre (règle « historique immuable » + politique de conservation non tranchée — conservés, cf. prompt §P1.4).
- Planificateur `demarrerPurgePlanifiee()` : `PURGE_INTERVALLE_MINUTES` (défaut 360), première passe différée +15 s, garde anti-chevauchement, timers unref, erreurs loguées sans tuer le process ; câblé dans `server.ts` avec arrêt propre SIGINT/SIGTERM (fallback 5 s). Compatible multi-instances (suppressions bornées idempotentes).
- Tests (7 contrôles M3) : exécution manuelle, bilans, non-ingérence journal/notifications. **Vert.**

### M1 — Renforcement CSRF ✅
- Analyse : cookie SameSite=Lax déjà posé mais insuffisant seul ; production = même origine (SPA servie par le backend), développement = Vite proxifié.
- Solution retenue : en-tête custom obligatoire `X-Requested-With: XMLHttpRequest` sur TOUTE mutation `/api/*` (middleware global avant la couche Origin-si-présent conservée), ET sur `/auth/login`, `/auth/logout`, `/auth/changer-mot-de-passe`. Un curl authentifié sans l'en-tête reçoit 403.
- Frontend : `api.ts` (`apiFetch`) devient le point de passage unique ; 23 appels migrés (App ×6, ChangePassword ×1, ITStock ×3, JournalAudit ×2, Login ×1, MaterialAssignment ×3, Societes ×3, UserManagement ×4). Scripts de test alignés.
- Ordre des contrôles : 401 (non authentifié) AVANT 403 (marqueur absent) — vérifié.
- Tests (5 contrôles M1) : login sans marqueur → 403, login avec marqueur → 200, mutation authentifiée sans marqueur → 403, Origin étrangère + marqueur → 403, GET sans marqueur → 200. **Vert.**

### M2 — Rate limiting complémentaire par IP ✅
- Politique interne : 30 échecs / 1 h / IP → blocage 15 min (constantes `FENETRE_IP_S=3600`, `MAX_ECHECS_IP=30`, `BLOCAGE_IP_S=900`). Distincte de C2 (5 échecs/15 min par couple identifiant+IP), qui reste intact.
- Persistance PostgreSQL table `limitation_ip` (timestamptz(3)) ; décision atomique INSERT…ON CONFLICT (miroir C2) → survit aux redémarrages, sûr en concurrence/multi-instances. Pas de DoS trivial derrière NAT : seuil haut + blocage court + nettoyage automatique (M3).
- Au login : contrôle IP EN PREMIER (avant lookup utilisateur) → 429 + Retry-After ; échec incrémente les DEUX compteurs ; succès ne réinitialise PAS le compteur IP (anti-spray, commenté). XFF non cru sans TRUST_PROXY.
- Écart d'historique assumé : la table a été créée APRÈS le commit M3 ; l'extension de la purge aux compteurs IP est donc livrée dans M2 (expliqué ici conformément au prompt).
- Tests (7 contrôles M2) : spray 29×401 puis 30ᵉ franchit le seuil, 31ᵉ → 429+Retry-After, XFF usurpé ignoré, utilisateur légitime bloqué pendant l'incident, nettoyage, login redevenu possible. Interaction C2 revalidée (non-régression + probe). **Vert.**

### M4 — HTTPS / reverse proxy / trust proxy ✅
- `lib/confiance-proxy.ts` : grammaire Express complète acceptée (sauts 1..10, `loopback`/`linklocal`/`uniquelocal`, IPv4/IPv6, CIDR, listes) ; valeur absente → aucune confiance (sûr) ; valeur INVALIDE → échec immédiat du démarrage (fail fast, plus de repli silencieux). Jamais `trust proxy: true`.
- `HOST` paramétrable (défaut 0.0.0.0) ; recommandation `HOST=127.0.0.1` derrière proxy local.
- Production sans TRUST_PROXY : avertissement explicite au démarrage (mode LAN direct supporté sciemment).
- `.env.example` : + HOST, ORIGINES_AUTORISEES, PURGE_INTERVALLE_MINUTES ; doc TRUST_PROXY étendue ; FRONTEND_URL inutilisé retiré.
- `docs/DEPLOIEMENT.md` : architecture cible, exemple nginx TLS complet, variables d'env, checklist mise en production, contrats intégrations (X-Requested-With, limiteurs), notes CSP.
- Cookies/HSTS/Helmet : SameSite=Lax + HttpOnly déjà en place (Phase 0) ; Secure activé en production ; HSTS vérifié live. Cohérence avec M2 garantie (même `req.ip`).
- Tests (8 contrôles M4) : unitaires parseur (7 valeurs dont rejets), démarrage réel avec TRUST_PROXY=banane → process mort + message contenant la valeur, instance TRUST_PROXY=1 consommant XFF (ligne limitation_ip clé 9.9.9.9 créée puis purgée). **Vert.**

### M5 — Identifiants sans collision ✅
- Inventaire des timestamps tronqués : 3 occurrences backend (`SN-${Date.now()…}` stock, `IT-TEL-${Date.now()…}` et `SN-${Date.now()…}` SIM direct) + 1 frontend (id notification locale).
- `referenceAleatoire(prefixe, octets=4)` basée sur `crypto.randomBytes` hex majuscule dans `lib/ids.ts` ; fallbacks devenus `SN-XXXXXXXX` et `IT-TEL-XXXXXX`. Frontend : `crypto.randomUUID()`. Les références métier séquentielles (compteur transactionnel chantier 3.5) ne sont pas touchées.
- Tests (7 contrôles M5) : motif unitaire, burst 12 créations sans série → 12×201, motifs SN-XXXXXXXX respectés, zéro doublon ; burst 8 fiches SIM directes → IT-TEL-XXXXXX et SN uniques. (Premier passage rouge car le serveur tournait encore sur l'ancien code — redémarré, second passage vert.) **Vert.**

## 3. Migrations

- Créée : `20260823213000_m2_limitation_ip` — table `limitation_ip` (clé PK texte, échecs, bloque_jusqua, fenêtre ouverte) en `timestamptz(3)` ; le schéma Prisma a aussi été aligné sur les colonnes `timestamptz(3)` réelles de `tentatives_connexion` (migration C2 existante) pour éviter un drift fantôme.
- `prisma migrate status` : 8 migrations trouvées, base à jour, exit 0.
- Replay sur base propre : `CREATE DATABASE replay_phase1` → `prisma migrate deploy` → **8/8 migrations appliquées avec succès** → base jetable supprimée.

## 4. Tests (résultats réels)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` backend | exit 0 |
| `npx tsc --noEmit` frontend | exit 0 |
| `npm run build` racine (backend compilé + Vite prod) | exit 0 (warning chunks >500 kB informatif) |
| `scripts/verifier-phase1.ts` | TOUS LES CONTRÔLES PASSENT — H4 21, M6 12, M3 7, M1 5, M4 8, M5 7, M2 7 (67 contrôles) |
| `scripts/verifier-non-regression.ts` | TOUS LES CONTRÔLES PASSENT (chantiers 2b + 3) |
| `scripts/probe-concurrence.ts` | SONDE : TOUS LES CONTRÔLES PASSENT (20 POST simultanés, dispo=1) |
| RBAC ciblé live | auditeur GET /api/audit 200 ; employé 403 ; employé POST /api/stock 403 (dans non-régression) |
| Sécurité ciblée live | CSP/XCTO/Referrer/HSTS présents ; POST sans marqueur CSRF sans cookie → 401 (ordre auth→CSRF) ; cas authentifié sans marqueur → 403 couvert par M1-4 |
| Burst M5 | 12 articles + 8 fiches SIM concurrents, unicité vérifiée |

## 5. Vérification Phase 0

- **C1** : scan secrets sur tous les fichiers suivis (mots de passe démo, clés privées, AKIA, URLs avec credentials, clés renseignées) → aucun secret réel ; seuls placeholders et documentation des rapports d'audit (mot de passe démo, constat Phase 0 déjà accepté). `.env` non suivi. **Vert.**
- **C2** : politique intacte (5 échecs/15 min, backoff 30 s→4 min) ; persistance re-testée par la non-régression (« état persisté en base ») ; concurrence sans lost update par probe-concurrence ; le compteur C2 n'a été ni remplacé ni affaibli par M2 (double compteur, succès anti-spray uniquement côté IP). **Vert.**
- **H1** : `/api/data` — employé reçoit `utilisateurs: []` (annuaire vide, contrat de forme stable, length=0 vérifié live) ; admin voit l'annuaire. Protection serveur inchangée. **Vert.**

## 6. Git

- Branche : `convergence-parc-it` · HEAD : `691e5f55c7ef7fedc1cbf018c9ad3b5073f92100`.
- Commits Phase 1 : `f57b1d2`, `3495076`, `eb0410a`, `6d3d93f`, `0abf955`, `8f3fcf1`, `06de33e`, `691e5f5` (un par chantier, diffs inspectés, aucun secret/.env staged).
- Non suivis : `docs/RAPPORT-CONTRE-AUDIT-PHASE-0-2026-08-23.md` (préservé) et ce rapport.
- **Modifications présentes dans l'arbre de travail NON issues de cette mission** (observées après le commit M5, laissées intactes, non commitées) : `backend/src/lib/{auth,chiffrement,machine-etats,notifications,purge-technique,serialisation}.ts`, `backend/src/routes/index.ts`, `frontend/package.json` + lock (retrait html2canvas/motion), et fichier non suivi `backend/src/lib/journal-serveur.ts`. L'arbre courant compile (tsc backend + frontend exit 0). À arbitrer par leur auteur.
- **Aucun push effectué.**

## 7. Points ouverts

1. Modifications d'arbre extérieures à la mission (cf. §6) — à réconcilier/réviquer par leur auteur avant tout commit.
2. Chunk `MaterialAssignmentModule` > 500 kB (warning Vite informatif, hors périmètre Phase 1).
3. Avertissement Prisma : `package.json#prisma` déprécié → migrer vers `prisma.config.ts` à l'occasion (Prisma 7).
4. Mot de passe de démonstration documenté dans les rapports d'audit suivis (constat C1 Phase 0, classé acceptable/dev-only).
5. `'unsafe-inline'` style-src maintenu faute de besoin critique — candidat à durcissement si migration vers CSS-in-JS extrait.
6. Notifications résolues anciennes volontairement non purgées (politique de conservation à décider).

---

**Fin de la Phase 1. Arrêt conforme au prompt : aucun push, aucun début de H2/H3/Phase 2/3 — en attente d'autorisation.**
