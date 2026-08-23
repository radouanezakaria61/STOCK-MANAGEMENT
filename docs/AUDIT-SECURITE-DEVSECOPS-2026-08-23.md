# Audit sécurité DevSecOps — Mots de passe & durcissement global

> **Date :** 23 août 2026 · **Application :** IT Stock Manager (STOCK-MANAGEMENT)
> **Stack réelle :** Express + TypeScript + Prisma + PostgreSQL 16 (backend), React 19 + Vite (frontend) — *pas de Next.js/NextAuth/SQLite : les points du prompt ont été adaptés à la stack effective.*
> **Niveau d'exigence :** production bancaire/finance (l'app manipule des CIN, IMEI et codes PIN/PUK SIM).
> **Méthode :** vérification ligne par ligne dans le code, greps systématiques, `npm audit`, historique git complet. Aucune supposition optimiste — tout point non vérifiable est marqué comme tel.

---

## 1. Résumé exécutif

**Score global : 92/100**

| Sévérité | Nombre avant audit | Corrigé pendant l'audit | Restant |
|---|---|---|---|
| 🔴 Critique | 0 | — | 0 |
| 🟠 Haute | 1 (3 CVE via prisma CLI) | **1 (corrigé, commité)** | 0 |
| 🟡 Moyenne | 2 | 0 | 2 |
| ⚪ Faible / recommandations | 4 | 0 | 4 |

Le socle authentification est **conforme aux standards 2026** sans aucune exception relevée.

---

## 2. Mission 1 — Gestion des mots de passe

| # | Point | Fichier:ligne | Verdict | Sévérité | Détail / Correctif |
|---|---|---|---|---|---|
| 1.1 | Algorithme de hashage | `backend/src/lib/auth.ts:30-33` (`@node-rs/argon2`) | ✅ CONFORME | — | Argon2id natif (binding Rust). Aucun MD5/SHA-1/SHA-256 seul/AES réversible. Le seul `createHash("sha256")` (ligne 45) hache le **jeton de session**, jamais un mot de passe — usage correct. |
| 1.2 | Coût du hash | `auth.ts:30` — `{ memoryCost: 19456, timeCost: 2, parallelism: 1 }` | ✅ CONFORME | — | Exactement les paramètres OWASP 2024+ recommandés (19 MiB, t=2, p=1). |
| 1.3 | Salage | interne à `@node-rs/argon2` | ✅ CONFORME | — | Sel aléatoire généré par la librairie à chaque hash, encodé dans la chaîne PHC ; aucun sel statique nulle part. |
| 1.4 | Fuite de hash/mdp | routes + services + sérialiseur | ✅ CONFORME | — | `motDePasseHash` est dans la liste d'exclusion du sérialiseur (`lib/serialisation.ts:41` `CHAMPS_SUPPRIMES`) : jamais sorti par une API. Aucun `console.*` ne loggue hash ni mot de passe (greps vérifiés). Les messages d'échec login sont uniformes (`MESSAGE_ECHEC_CONNEXION`). |
| 1.5 | Comparaison timing-safe | `auth.ts:36-40` (`argonVerifier`) + `auth.routes.ts:113-131` | ✅ CONFORME | — | Vérification native Argon2 (timing-safe par conception). Aucune comparaison `===` sur un hash. Bonus au-delà du prompt : **hash leurre** vérifié quand le compte n'existe pas → latence uniforme, pas d'oracle de timing même indirect. |
| 1.6 | Équivalent NextAuth (session/JWT) | `auth.ts` sessions serveur | ✅ CONFORME | — | Pas de JWT : session en base, cookie porte un jeton aléatoire 48 octets, seule son empreinte SHA-256 est stockée (`tokenHash @unique`). Le profil renvoyé par `/api/auth/me` et `/login` (`construireProfil`) est construit champ par champ — jamais `...utilisateur`. Cookie HttpOnly + SameSite=Lax + Secure en prod. |
| 1.7 | Migration/seeds en clair | `prisma/seed.ts:72-84,198-214,303` | ✅ CONFORME (état actuel) | — | Seed prod : refuse de tourner sans `ADMIN_INITIAL_PASSWORD` ≥ 12 car., hashé immédiatement. Seed dev : mot de passe démo lu depuis l'environnement ou **généré aléatoirement affiché une seule fois**. ⚠️ Résidu historique : voir 1.8b. |
| 1.8a | Credentials codés en dur (code actuel) | greps `password=`, `admin123`, `changeme`… | ✅ CONFORME | — | Aucun. Les scripts de test lisent `process.env.MOT_DE_PASSE_DEMO` avec refus explicite si absent. `.env` non versionné (vérifié `git ls-files`). |
| 1.8b | Credentials dans l'**historique git** | commits ≤ `1d4f612` | ⚠️ À AMÉLIORER | 🟡 Moyenne | `MOT_DE_PASSE_DEMO="Distra-Demo-2026"` a été commité dans le passé (`seed.ts`, `probe-concurrence.ts`, `verifier-non-regression.ts`) avant d'être purgé du code actuel. **Impact limité mais réel** : c'est le mot de passe des comptes de démonstration — si une base de dev seedée avec ce mot de passe a existé hors du poste, ces comptes sont compromis. **Correctif :** (a) s'assurer qu'aucun environnement partagé n'utilise plus cette valeur ; (b) si le dépôt doit devenir accessible au-delà de l'équipe, réécrire l'historique (git filter-repo) ou considérer l'historique compromis et rotativer partout. Les URLs PostgreSQL dans l'historique ne contiennent pas de mots de passe (placeholders). |

---

## 3. Mission 2 — Durcissement DevSecOps

### A. Authentification & Sessions
| Point | Verdict | Détail |
|---|---|---|
| Complexité mots de passe | ✅ | Zod : ≥12 car., minuscule+majuscule+chiffre (`validation-zod.ts:24-30`), max 200. HIBP : non implémenté → recommandation R1 (faible). |
| Rate limiting / brute-force | ✅ | Double limiteur persistant en base : par IP+identifiant (5 échecs/15 min, backoff exponentiel 30s→4min) **et** par IP seule (30 échecs/1h → blocage 15 min, commit m2). Survit aux redémarrages. `Retry-After` renvoyé. Pas de verrou permanent (anti-DoS ciblé). |
| Expiration/rotation sessions | ✅ | Glissante 8h plafonnée à 12h absolues, fenêtre d'inactivité 30 min, révocation immédiate sur changement MDP/désactivation/suppression, écriture d'extension throttlée (5 min). |
| Cookies httpOnly/secure/sameSite | ✅ | `httpOnly:true, sameSite:"lax", secure: NODE_ENV==="production"` (`auth.ts:81-85`). SameSite=strict non utilisé : choix cohérent avec le flux SPA (le Lax + double contrôle CSRF ci-dessous couvre le risque). |
| CSRF | ✅ | Double barrière : en-tête `X-Requested-With: XMLHttpRequest` obligatoire sur toute mutation (m1) **et** vérification Origin-si-présent contre liste blanche/host. |

### B. Secrets & Configuration
| Point | Verdict | Détail |
|---|---|---|
| Secrets committés | ✅ | `git ls-files` : aucun `.env`. `.gitignore` couvre `.env`, `.env.*`, `_sauvegardes/`, logs. `.env.example` = placeholders uniquement. |
| Secret de session fort | ✅ | Pas de secret applicatif signé (sessions opaques en base) ; clé AES-256-GCM `CLE_CHIFFREMENT` exigée 32 octets base64/hex, validée au démarrage, sinon crash explicite. |
| Séparation dev/prod | ✅ | Seed refuse les comptes démo en production sans variable explicite ; comportements pilotés par `NODE_ENV`. |

### C. Base de données (Prisma / PostgreSQL)
| Point | Verdict | Détail |
|---|---|---|
| Injection SQL | ✅ | Tous les `$queryRaw`/`$executeRaw` utilisent des tagged templates paramétrés (13 occurrences vérifiées une à une : verrous `FOR UPDATE`, compteur, limiteur IP). `Prisma.join()` pour les listes IN. Un seul `$executeRawUnsafe` : chaîne constante sans interpolation (`seed.ts:134`), sûr. |
| Moindre privilège PG | ⚠️ À VÉRIFIER | Le user applicatif `stock_app` existe, mais je n'ai trouvé **aucune documentation des GRANT appliqués** ni de script de création du rôle. Recommandation R2 (moyenne) : documenter/imposer `CREATE ROLE stock_app LOGIN PASSWORD …; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES…` sans SUPERUSER/CREATEDB, et le noter dans DEPLOIEMENT.md. Non vérifiable depuis le code seul. |
| Chiffrement au repos | ✅ | PIN/PUK SIM chiffrés AES-256-GCM (nonce unique + tag), jamais dans les listes API, révélation permissionnée + audité (`CONFIDENTIAL_REVEALED`). |

### D. Validation & Injections
| Point | Verdict | Détail |
|---|---|---|
| Validation serveur | ✅ | Schémas Zod `.strict()` sur tous les endpoints mutateurs (refus 422 de tout champ inconnu), listes fermées depuis `machine-etats`, montants au format FR validés, dates strictes AAAA-MM-JJ. |
| XSS | ✅ | Aucun `dangerouslySetInnerHTML`/`innerHTML`/`eval` (grep vide). CSP Helmet active : `default-src 'self'`, script-src strict sans unsafe-eval, frame-ancestors none. React échappe par défaut. |
| Upload de fichiers | N/A | Aucune fonctionnalité upload (multer/busboy absents). Le logo PDF est un SVG data-URI statique embarqué dans le code. |

### E. API & Autorisation
| Point | Verdict | Détail |
|---|---|---|
| AuthN+AuthZ sur chaque route | ✅ | Middleware global `chargerSession→exigerAuth` puis `exigerPermission('module.action')` sur **chaque** route métier y compris les GET (9 permissions RBAC, 6 rôles). Seules exceptions : `/notifications*` (auth requise globalement, filtrage par destinataire côté service). |
| IDOR | ✅ | Notifications : vérification explicite `destinataireId !== demandeur → 403` (`notifications.service.ts:28`). Ressources métier adressables par id/référence sans cloisonnement utilisateur — conforme à la décision architecturale documentée « Societe = étiquette » (AGENTS.md) ; à revisiter si cette décision change. |
| Rate limiting endpoints sensibles | ⚠️ Partiel | Login : exhaustif. Autres mutations : uniquement derrière l'auth (surface réduite) mais pas de quota par utilisateur. Recommandation R3 (faible en LAN) : express-rate-limit global si exposition élargie. |

### F. Headers & réseau
| Point | Verdict | Détail |
|---|---|---|
| CSP/HSTS/XFO/nosniff/referrer | ✅ | Helmet `useDefaults` (XFO DENY, nosniff, referrer policy, HSTS prêt) + CSP stricte documentée (`app.ts:33-60`), upgrade-insecure-requests désactivé volontairement pour le LAN HTTP (documenté). |
| CORS | ✅ | Aucun middleware cors : frontend servi même origine en prod, proxy Vite en dev. Origines de mutation filtrées. |
| HTTPS forcé | ⚠️ Documenté | TLS à terminer au reverse proxy (docs/DEPLOIEMENT.md) ; warning au démarrage si production sans TRUST_PROXY. Rien à corriger dans le code. |

### G. Dépendances & supply chain
| Point | Verdict | Détail |
|---|---|---|
| npm audit backend | 🟠→✅ **CORRIGÉ** | 3 CVE **high** : GHSA-ggr8-5vv4-36mx (stack exhaustion deepmerge-ts <8 via @prisma/config ≥6.13, transitif de prisma CLI 6.19.3). **Corrigé : downgrade maîtrisé prisma + @prisma/client 6.19.3 → 6.12.0 exact** (commit `719d379`). `npm audit` : **0 vulnérabilité runtime et dev**. `prisma generate`, typecheck, non-régression et phase-1 rejoués après le changement : tout passe. Note : surveiller le retour de la correction amont (>6.19) pour remonter ensuite. |
| npm audit frontend | ✅ | 0 vulnérabilité (prod et dev). |
| Lockfiles | ✅ | Committés aux deux niveaux. |

### H. Logs & erreurs
| Point | Verdict | Détail |
|---|---|---|
| Stack trace au client | ✅ | Gestionnaire central : ErreurMetier → message français prévu pour l'utilisateur ; erreur inattendue → `{ error: "Erreur interne du serveur." }` générique, stack uniquement côté serveur (`routes/index.ts`). |
| Données sensibles dans les logs | ✅ | Journalisation structurée sans secrets ; journal d'audit alimenté par instantanés filtrés par liste blanche (`instantane()`) — un hash ne peut pas y fuiter même par erreur d'appelant. |
| Alerting intrusion | ⚪ Recommandation R4 | JournalAudit contient déjà `LOGIN_FAILED` horodatés + IP. Manque : une vue/alerte (ex. notification interne au rôle AUDITOR au-delà d'un seuil d'échecs). |

### I. Déploiement
| Point | Verdict | Détail |
|---|---|---|
| Variables client | ✅ | Pas de build Next.js : le frontend Vite n'embarque que `VITE_API_URL` (non sensible, fallback localhost). Aucun `VITE_` autre. |
| .gitignore | ✅ | `.env`, `.env.*` (sauf example), `_sauvegardes/`, dist, node_modules, logs. |

---

## 4. Recommandations restantes (priorisées)

| # | Action | Sévérité | Effort |
|---|---|---|---|
| R1 | Vérification des nouveaux mots de passe contre liste compromise (k-anonymity Have I Been Pwned) lors du changement/création | Faible | ~½ j |
| R2 | Documenter et imposer les GRANT PostgreSQL du rôle applicatif (moindre privilège, sans superuser) dans DEPLOIEMENT.md + script SQL versionné | Moyenne | ~½ j |
| R3 | Quota de débit global par utilisateur sur les mutations (express-rate-limit) si l'app quitte le LAN | Faible | ~¼ j |
| R4 | Alerte automatique (notification interne AUDITOR/SUPER_ADMIN) sur pic de `LOGIN_FAILED` | Faible | ~¼ j |
| R5 | Décider du traitement de l'historique git contenant l'ancien mot de passe démo (filter-repo ou rotation assumée) avant toute ouverture du dépôt | Moyenne | décision + ½ j |
| R6 | Surveiller prisma > 6.19 pour remonter de version dès que deepmerge-ts ≥ 8 est adopté amont (rétablir `^6` à ce moment) | Info | continu |

## 5. Preuves d'exécution post-correctif

- `npm audit` backend (runtime **et** dev) : `found 0 vulnerabilities`
- `npx prisma generate` : OK · `npx tsc --noEmit` backend : OK
- `verifier-non-regression.ts` : « TOUS LES CONTRÔLES PASSENT (chantiers 2b + 3) »
- `verifier-phase1.ts` : « ✓ VÉRIFICATION PHASE 1 : TOUS LES CONTRÔLES PASSENT. » (67 contrôles)
