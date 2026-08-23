# Contre-audit indépendant — Phase 0 (C1, C2, H1)

**Date :** 23 août 2026
**Branche :** convergence-parc-it — dépôt STOCK-MANAGEMENT
**Objet :** validation indépendante des commits 6daa4bf (C1), 80575cc (C2), 2bdc800 (H1)
**Méthode :** aucune affirmation du rapport d'implémentation n'a été acceptée sans re-vérification dans le code, Git, la base PostgreSQL ou par sondes HTTP reproductibles. Aucune correction n'a été apportée pendant l'audit ; les valeurs de secrets éventuellement découvertes sont masquées dans ce rapport.

---

## 1. Résumé exécutif

| ID | Verdict | Synthèse |
|----|---------|----------|
| C1 | PASS | Chantier 3.5 intégralement versionné (22 fichiers), aucun .env/log suivi, aucun secret à valeur réelle dans le code committé, fallbacks mot de passe démo supprimés du code exécutable. Deux résidus documentaires non bloquants (§4.2). |
| C2 | PASS | Limiteur réellement persistant (tentatives_connexion), upsert atomique vérifié sous concurrence (0 lost update sur 8 échecs simultanés), politique séquentielle exacte ([401 x5 puis 429], Retry-After=30 s), reset après succès vérifié, persistance au redémarrage re-testée indépendamment (blocage semé, redémarrage réel du process, 429 avec Retry-After=142 s cohérent), migration timezone rejouée sur base vierge (7/7, types finaux timestamptz). |
| H1 | PASS | Masquage côté serveur effectif et testé en direct sur 4 comptes (2 EMPLOYEE : annuaire vide + parc complet ; SUPER_ADMIN et AUDITOR : annuaire peuplé). Pas de chemin alternatif : GET /api/users exige utilisateurs.consulter (403 constaté pour un employé). Pas de fuite adjacente de l'annuaire (usernames/rôles/mots de passe absents du payload ; les emails présents relèvent des entités Société et Employé, périmètre parc.consulter voulu). |

### Gate global : PHASE 0 VALIDÉE

Les trois points sont PASS et aucune régression critique ou majeure liée aux changements n'a été découverte. Les recommandations de criticité faible/informationnelle listées n'entrent pas en ligne de compte pour le gate.

---

## 2. Périmètre réellement vérifié

- État Git complet : status, log, branche, fichiers suivis/non suivis, .gitignore, check-ignore.
- Diffs des trois commits : stats complètes + hunks ciblés sur middleware/auth.ts, routes/auth.routes.ts, lib/auth.ts, app.ts, dashboard.service.ts, routes/index.ts, App.tsx, verifier-non-regression.ts.
- Scans de secrets sur l'arbre HEAD : mots de passe démo, clés AES, tokens génériques (AKIA/AIza/sk-), PIN/PUK, affectations d'environnement non vides, occurrences motDePasseTemporaire.
- Code source actuel : limiteur anti-bruteforce intégral, agrégat /api/data, routes /users et /data.
- Sondes HTTP live contre le backend réel : matrice multi-rôles H1, chasse aux fuites adjacentes dans le payload, accès direct /api/users, politique séquentielle du limiteur, concurrence (8 requêtes parallèles), reset après succès, persistance après redémarrage réel du processus backend.
- Rejouabilité des migrations : création d'une base PostgreSQL vierge stock_contreaudit_tmp, prisma migrate deploy des 7 migrations, inspection information_schema/pg_constraint/pg_indexes, suppression de la base.
- Non-régression complète : tsc backend, tsc frontend, npm run build, prisma migrate status, verifier-non-regression.ts, probe-concurrence.ts.

Hors périmètre : audit général hors Phase 0 (chantiers antérieurs, écrans métier, performances), sécurité d'hébergement, contenu des logs locaux non versionnés.

---

## 3. État Git constaté

- Arborescence de travail : PROPRE (aucun fichier modifié ni non suivi).
- Branche : convergence-parc-it. Sommet : 2bdc800, puis 80575cc, puis 6daa4bf sur la base 1d4f612 (chantier 3).
- Migrations : 7 répertoires, de 20260822122711_init à 20260823200000_c2_tentatives_timestamptz.
- Fichiers suivis correspondant à .env, .log ou node_modules : AUCUN.
- check-ignore actif : backend/.env (.gitignore:7), server-35.log et server-35.err.log (.gitignore:6 *.log).

Reproductibilité depuis Git confirmée par le replay intégral des migrations sur base vierge (§6.5).

---

## 4. Vérification C1

### 4.1 Preuves positives

| Contrôle | Résultat |
|---|---|
| git show --stat 6daa4bf | 22 fichiers, +966/-188, périmètre conforme à l'annonce (migration durcissement, chiffrement AES-256-GCM, compteurs, notifications par destinataire, permissions de lecture, machine à états, seed, scripts, frontend, rapport d'audit) |
| Fichiers sensibles suivis | Aucun .env/.log ; node_modules absent de l'index |
| Affectations secrètes non vides dans HEAD | Aucune : CLE_CHIFFREMENT="" (placeholder), ADMIN_INITIAL_PASSWORD="", MOT_DE_PASSE_DEMO= vide dans .env.example |
| Tokens génériques (AKIA, AIza, sk-) | Absents |
| PIN/PUK | Littéraux du seed factices (fixtures démo) passés par chiffrer() à l'écriture ; aucun PIN/PUK réel |
| Fallback Distra-Demo-2026 dans le CODE de HEAD | ABSENT du code exécutable ; ne subsiste que dans deux documents d'audit (cf. 4.2) |
| Historique du fallback | Introduit au chantier 2b (ecdd8aa), retiré par 6daa4bf (git log -S) |
| Lecture stricte env + dotenv | verifier-non-regression.ts et probe-concurrence.ts : import dotenv/config + arrêt immédiat si MOT_DE_PASSE_DEMO absent ; exécution validée sans variable injectée manuellement |

### 4.2 Résidus constatés (faibles, documentés uniquement)

| # | Constat | Emplacement | Criticité | Recommandation |
|---|---------|-------------|-----------|----------------|
| R1 | Le littéral du mot de passe démo reste cité dans deux rapports d'audit versionnés et demeure dans l'historique Git antérieur. Le commit 6daa4bf a ajouté l'un de ces documents contenant la valeur. | docs/RAPPORT-AUDIT-2-2026-08-22.md:56 (pré-existant) ; docs/RAPPORT-AUDIT-COMPLET-2026-08-22.md:122 (ajout par 6daa4bf) ; historique antérieur à 6daa4bf | Faible | Anonymiser la valeur dans les documents lors d'un prochain passage ; rotation du mot de passe démo avant tout partage élargi du dépôt. La valeur est celle d'un compte de démonstration encadré par AUTORISER_SEED_DEMO (inopérant en production sans flag explicite). |
| R2 | Script de diagnostic jetable committé tel quel. | backend/scripts/check-db-temp.ts (15 lignes, lecture seule d'information_schema) | Informationnelle | Renommer (ex. diag-migrations.ts) au prochain passage. |

### Verdict C1 : PASS

Chantier intégralement versionné et reproductible ; aucun secret opérationnel introduit ; promesse « plus aucun fallback codé en dur » tenue pour tout code exécutable.

---

## 5. Vérification C2 — anti-bruteforce persistant

### 5.1 Architecture (backend/src/middleware/auth.ts:52-123)

- Plus aucun état mémoire : la Map interne a disparu ; seule autorité = table tentatives_connexion (modèle Prisma TentativeConnexion, @@map conforme).
- enregistrerEchecConnexion : UN SEUL INSERT ... ON CONFLICT (cle) DO UPDATE SET ... où la décision (fenêtre expirée ?, compteur, palier, plafond) est évaluée dans la même instruction que l'écriture : atomique par ligne sous PostgreSQL, donc insensible aux lost updates et correct multi-instances.
- verifierLimiteConnexion : findUnique + reliquat en secondes ; reinitialiserConnexion : deleteMany idempotent.
- Purge opportuniste (~5 % des vérifications, fire-and-forget) restreinte aux entrées dont fenêtre ET blocage sont expirés : impossible de supprimer un blocage actif.
- Injection SQL : requête paramétrée (paramètres liés pour cle et constantes), aucune concaténation. Sûr.
- Fail-open impossible : le login exige déjà la base ; échec d'enregistrement => 500 (fail-closed).
- Anti-verrouillage permanent : tentative pendant blocage = 429 SANS incrément (pas de prolongation infinie) ; bloque_jusqua=NULL sous le seuil ; plafond LEAST(palier, fenêtre 900 s) ; clé IP|identifiant inchangée (un attaquant ne peut empoisonner que sa propre IP).
- Routes : diff 80575cc sur auth.routes.ts = exactement trois ajouts de await, aucune autre modification logique (chemin hash-leurre anti-énumération intact).

### 5.2 Politique fonctionnelle — sondes live exécutées pendant l'audit

| Test | Attendu | Constâté |
|---|---|---|
| 6 échecs séquentiels (identifiant jetable) | 401 x5 puis 429, Retry-After ~30 | [401,401,401,401,401,429], Retry-After=30 |
| Ligne en base après blocage | echecs=5, bloque_jusqua futur | echecs=5, bloqueJusqua futur constaté |
| 2 échecs puis connexion réussie (zakaria.radouane) | reset (ligne supprimée) | avant : echecs=2 ; login 200 ; après : ligne supprimée |
| Comptage identifiants INCONNUS | comptés (anti-énumération maintenue) | oui : toutes les sondes de blocage utilisent des comptes inexistants |
| Concurrence : 8 échecs SIMULTANÉS (Promise.all) | echecs en base == nombre de 401 (aucun lost update) | [401 x8] ; echecs en base = 8 ; cohérent |
| Persistance : état semé (echecs=9, blocage 240 s), ARRÊT réel du backend, RELANCE (nouveau PID) | 429 conservé | HTTP 429, Retry-After=142 s (cohérent avec l'écoulement), ligne intacte |

Remarque sur la rafale concurrente : le dépassement transitoire du seuil avant le premier 429 est possible (les requêtes déjà engagées passent le contrôle de lecture) — comportement fail-closed (le compteur reste exact), non exploitable pour contourner la protection.

### 5.3 Migration timezone 20260823200000_c2_tentatives_timestamptz

- Contenu : purge de la table (état éphémère par design, fenêtre 15 min max) puis ALTER des deux colonnes vers timestamptz(3), DEFAULT now() réaffiché. Acceptable : aucune donnée métier, conversion naïf->tz aurait été ambiguë selon le fuseau de session.
- Base live : colonnes effectivement en timestamp with time zone ; Retry-After recalculé côté serveur désormais cohérent (30 s constatés au palier 1 contre ~3630 s avant correction).
- Rejouabilité sur base vierge : CREATE DATABASE stock_contreaudit_tmp ; prisma migrate deploy => 7/7 appliquées, 7/7 finished_at renseignés ; types finaux timestamptz vérifiés ; compteurs amorcées (article=0, mouvement=0) ; CHECK ck_affectation_statut et ck_article_statut présents ; index uq_notification_alerte_ouverte_destinataire et notifications_destinataire_id_statut_idx posés ; base supprimée ensuite.
- Cohérence Prisma : DateTime sans annotation => type natif attendu timestamptz(3) : plus aucune divergence schéma/base.

### Verdict C2 : PASS

---

## 6. Vérification H1 — /api/data

### 6.1 Chemin d'autorisation serveur (pas seulement l'interface)

- backend/src/services/dashboard.service.ts : obtenirDonneesGlobales(permissions) ne lance la requête prisma.utilisateur.findMany QUE si permissions.has("utilisateurs.consulter") ; sinon la requête n'est même pas exécutée et la clé utilisateurs est renvoyée vide (contrat de forme stable pour le frontend). Le masquage n'est PAS délégué au client.
- backend/src/routes/index.ts:67 : GET /data conserve exigerPermission("parc.consulter") (anonyme 401, rôle sans parc 403) et transmet req.contexteAuth.permissions au service.
- Pas de chemin alternatif vers l'annuaire : seuls deux sites appellent prisma.utilisateur.findMany dans les services — dashboard.service.ts (dorénavant conditionné) et utilisateurs.service.ts (desservi par GET /api/users qui exige utilisateurs.consulter, ligne 89 de routes/index.ts).
- Frontend : App.tsx utilise payload.data.utilisateurs ?? [] (garde défensive) — l'API reste autoritaire.

### 6.2 Matrice multi-rôles testée en direct (HTTP réel)

| Compte | Rôle | GET /api/data | Annuaire utilisateurs | Parc (articles/mouvements/affectations/sociétés) |
|---|---|---|---|---|
| karim.berrada | EMPLOYEE | 200 | 0 compte | 8 / 23 / 8 / 2 |
| maya.lin | EMPLOYEE | 200 | 0 compte | 8 / 23 / 8 / 2 |
| zakaria.radouane | SUPER_ADMIN | 200 | 5 comptes | 8 / 23 / 8 / 2 |
| sarah.benali | AUDITOR | 200 | 5 comptes | 8 / 23 / 8 / 2 |

Accès direct à l'annuaire par un EMPLOYEE : GET /api/users => HTTP 403 (permission utilisateurs.consulter exigée).

### 6.3 Chasse aux fuites adjacentes dans le payload EMPLOYEE

Analyse du JSON complet reçu par un EMPLOYEE sur /api/data :

- Aucun username, aucun champ motDePasse*, aucun code de rôle (SUPER_ADMIN/IT_MANAGER/AUDITOR absents du payload).
- La chaîne email apparaît dans societes (coordonnée générique type contact@... de la société) : entité « étiquette » explicitement visible de tous selon AGENTS.md.
- Les affectations portent beneficiaryName/beneficiaryEmail/beneficiaryPhone/beneficiaryCin : ce sont des champs du FORMULAIRE d'affectation rattachés à la personne physique Employé (bénéficiaire du matériel), pas des comptes Utilisateur. Leur visibilité relève de parc.consulter tel que défini dans la matrice seed (« Consulter le parc : articles, affectations, mouvements, sociétés »). Hors périmètre H1, signalé informationnellement (§8-N3).
- simPin / simPuk = null dans le listing agrégé : le chiffrement au repos tient, la révélation passe uniquement par l'endpoint dédié exigeant affectations.confidentiels (chantier 3.5).

Conclusion : aucune reconstruction de l'annuaire des comptes possible depuis les autres clés du payload.

### Verdict H1 : PASS

---

## 7. Tests et non-régression (exécutions d'audit)

| Contrôle | Commande / méthode | Résultat |
|---|---|---|
| TypeScript backend | npx tsc --noEmit (backend/) | exit 0 |
| TypeScript frontend | npx tsc --noEmit (frontend/) | exit 0 |
| Build production | npm run build (racine) | exit 0, built in ~11 s (avertissement taille de chunks pré-existant, hors périmètre) |
| Migrations Prisma | npx prisma migrate status | Database schema is up to date! (7 migrations) |
| Rejouabilité migrations | base vierge + prisma migrate deploy + inspections SQL | 7/7 appliquées, structures conformes, base de test supprimée |
| Non-régression fonctionnelle | verifier-non-regression.ts | TOUS LES CONTRÔLES PASSENT, exit 0 (sections A à L : auth, sessions, RBAC, stock, affectations, notifications, idempotence, immutabilité, chiffrement PIN/PUK implicite aux tests de révélation) |
| Sonde concurrence métier | probe-concurrence.ts | SONDE : TOUS LES CONTRÔLES PASSENT (20 POST simultanés : 1 succès/19 refus ; cohérence 3 compartiments ; audit sans données sensibles) |
| Sondes spécifiques C2 | scripts inline tsx (§5.2) | toutes vertes, lignes de sonde nettoyées en fin de chaque test |
| Sondes spécifiques H1 | scripts inline tsx (§6.2/6.3) | toutes vertes |

Aucune régression constatée sur : authentification (login/logout/me), sessions cookie HttpOnly, RBAC six rôles (403 vérifiés par le vérificateur et en direct), stock (invariants par la base), affectations (machine à états, restitution), chiffrement PIN/PUK (absents des listings), notifications (déduplication par destinataire re-testée), idempotence, sérialisation.

---

## 8. Anomalies nouvelles et observations (aucune bloquante)

| # | Type | Localisation | Constat | Criticité | Recommandation |
|---|------|--------------|---------|-----------|----------------|
| N1 | Qualité de code | middleware/auth.ts:62 cleLimiteurConnexion | Fonction exportée jamais utilisée : auth.routes.ts reconstruit la clé en ligne (duplication du format ip|identifiant). Risque de divergence future du format de clé. | Faible | Faire appel à cleLimiteurConnexion dans auth.routes.ts ou supprimer l'export. |
| N2 | Hygiène de commits | 2bdc800 (verifier-non-regression.ts) | Deux des trois hunks du vérificateur dans le commit H1 concernent C2 (purge d'idempotence après seed ; assertion de persistance en section L). Périmètre légèrement mélangé. | Informationnelle | Rien à corriger ; veiller lors des prochaines phases à isoler les changements de harnais dans le commit correspondant. |
| N3 | Conformité RGPD/PII (observation) | affectations.service.ts (payload /api/data) | Les coordonnées complètes du bénéficiaire employé (nom, email pro, téléphone, CIN) transitent dans /api/data pour tout détenteur de parc.consulter. Conforme à la matrice RBAC actuelle mais large. | Informationnelle | À arbitrer lors d'un chantier dédié aux données personnelles (masquage partiel possible côté service). |
| N4 | Robustesse | purgerSiNecessaire (middleware/auth.ts:69) | Purge probabiliste (5 %) : sous trafic très faible, les lignes expirées peuvent rester plusieurs heures. Sans impact sécurité (les lectures ignorent les blocages expirés) ni volumétrie (table bornée par le nombre de couples IP|identifiant actifs). | Informationnelle | Aucune action requise ; une purge périodique optionnelle pourrait être ajoutée plus tard. |

Aucune nouvelle vulnérabilité exploitable introduite par la Phase 0 n'a été trouvée : pas d'injection SQL (paramètres liés), pas de fail-open, pas de fuite de secret, pas de verrouillage permanent provoquable, pas de divergence schéma/base.

---

## 9. Revue qualitative des trois commits

| Commit | Cohérence du périmètre | Observations |
|---|---|---|
| 6daa4bf (C1) | Conforme à l'annonce (22 fichiers) | Contient check-db-temp.ts (R2) et un document d'audit citant le mot de passe démo (R1). Diff lib/auth.ts/app.ts revus : suppression correcte de la lecture manuelle X-Forwarded-For au profit de req.ip + TRUST_PROXY explicite (amélioration, pas de régression). |
| 80575cc (C2) | Strictement conforme (middleware + routes awaits + migration) | Le diff routes se limite aux trois await ; aucune logique métier touchée. |
| 2bdc800 (H1) | Conforme avec léger mélange de harnais (N2) | dashboard.service.ts/routes/App.tsx propres ; garde ?? [] minimale et justifiée. |

Conformité AGENTS.md : permissions serveur systématiques maintenues ; audit dans la transaction inchangé ; historique intact (le limiteur écrit dans une table dédiée, pas dans l'historique métier) ; TypeScript strict respecté ; clés API françaises conservées ; signature de service légèrement assouplie (permissions Set plutôt que contexte complet) — écart mineur acceptable avec la lettre de la règle service(contexte, données), sans impact identifié.

Aucun scope creep significatif ; aucun workaround présenté comme correction définitive ; aucun changement métier non demandé détecté.

---

## 10. Classification finale

| ID | Verdict |
|---|---|
| C1 | PASS |
| C2 | PASS |
| H1 | PASS |

## 11. Gate de validation Phase 0

# PHASE 0 VALIDÉE

Conditions du gate remplies : trois PASS, aucune régression critique ou majeure liée aux changements, corrections reproductibles depuis Git et validées par sondes indépendantes (concurrence, redémarrage réel, replay de migrations sur base vierge).

## 12. Actions correctives requises

Aucune action bloquante. Suggestions à planifier ultérieurement (hors Phase 0) :
1. Anonymiser les valeurs de secrets de démonstration citées dans docs/RAPPORT-AUDIT-*.md (R1) ;
2. Renommer backend/scripts/check-db-temp.ts (R2) ;
3. Unifier la construction de clé du limiteur via cleLimiteurConnexion (N1) ;
4. Arbitrage futur sur l'exposition PII des bénéficiaires d'affectation (N3).

---

*Contre-audit réalisé sans modification du code applicatif, sans commit et sans push. Le backend a été redémarré deux fois pour le besoin du test de persistance (état final : en écoute sur le port 3001). Toutes les données de sonde ont été purgées.*

