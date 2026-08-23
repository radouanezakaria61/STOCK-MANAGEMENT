# RAPPORT-CHANTIER-3.5-DURCISSEMENT.md

**Date :** 23 août 2026 · **Branche :** `convergence-parc-it` · **HEAD :** `6b32b8d`
**Contexte :** ce chantier a été implémenté en continu depuis le 22/08 (commits `6daa4bf` → `6b32b8d`), traversant deux audits Hermes, un contre-audit indépendant Phase 0, une Phase 1 de durcissement, un passage de refactoring et un audit DevSecOps interne (score 92/100). Ce rapport fait la **clôture formelle** : chaque constat est mis en correspondance avec son état réel actuel, preuves à l'appui.

---

## 1. Constats traités — état avant / correction / tests / état final

### Phase 1 — P1 sécurité/autorisations

| # | Constat | État avant | Correction (fichiers) | Tests | Final |
|---|---|---|---|---|---|
| 1 | X-Forwarded-For aveugle | `adresseIpDe()` croyait l'en-tête client ; faux XFF polluait audit + limiteur | `trust proxy` explicite désactivé par défaut (`app.ts`) puis validation stricte grammaire Express avec échec au démarrage (`lib/confiance-proxy.ts`, M4) ; IP exclusivement via `req.ip` (`lib/auth.ts:70`, C2, M2) | M2-4 XFF usurpé ignoré ; M4-7 démarrage invalide = échec ; M4-8 XFF consommé quand TRUST_PROXY=1 ; non-régression limiteur | ✅ FERMÉ |
| 2 | Lectures sans permission | `/api/data`, `/api/users`, journal, confidentiels ouverts à tout authentifié | Permissions serveur `parc.consulter`, `utilisateurs.consulter`, `affectations.confidentiels`, `audit.consulter` sur chaque route (`routes/index.ts`) ; H1 : annuaire masqué sans `utilisateurs.consulter` (commit `2bdc800`) | Non-régression RBAC (anonyme=401, employé=403, admin=200) ; sondes live auditeur 200 / employé 403 ; H1 employé → annuaire vide vérifié | ✅ FERMÉ |
| 3 | Sérialisation blacklist-only | Un futur champ Prisma sensible aurait fuité automatiquement | Filtrage centralisé renforcé (`lib/serialisation.ts`) : secrets retirés systématiquement ; défense en profondeur ajoutée côté journal d'audit (H4) où toute clé ressemblant à un secret est masquée dans les instantanés avant/après | H4-15/H4-16 : pas de hash ni PIN révélé dans le payload servi ; tests sérialisation non-régression | ✅ FERMÉ (allowlist générale classée dette P3 — cf. §7) |
| 4 | PIN/PUK en clair | Secrets SIM lisibles en base | AES-256-GCM authentifié au repos (`lib/chiffrement.ts`), clé uniquement via `CLE_CHIFFREMENT` (32 octets base64), nonce unique par écriture, migration `20260823120000_chantier3_5_durcissement` ; révélation derrière permission dédiée `affectations.confidentiels`, auditée, jamais journalisée en clair ; jamais exposés par `/api/data` | H4-16 (PIN absent du journal servi) ; révélation testée non-régression ; refus démarrage prod sans clé | ✅ FERMÉ |
| 5 | Notifications globales | Lecture par A marquait « lue » pour B | Modèle par destinataire : fan-out à l'émission, `destinataireId`, comptage/liste filtrée, marque-lue réservé au destinataire (`services/notifications.service.ts`), batch `POST /api/notifications/lue-tout` borné au demandeur | Non-régression A/B lecture indépendante + déduplication ; M1-4 batch sans marqueur → 403 | ✅ FERMÉ |
| 6 | Actions frontend non filtrées | Boutons affichés quelles que soient les permissions | `profil.permissions` propagé : gating onglets + modules (`App.tsx:303,609-630`), canManage `UserManagement`/`SocietesManagement`, garde journal ; le backend reste le contrôle réel (403 vérifiés partout) | RBAC backend vert ; UI conditionnelle revue | ✅ FERMÉ |

### Phase 2 — Cohérence métier P2

| # | Constat | Correction | Tests | Final |
|---|---|---|---|---|
| 7 | Types de mouvements dispersés | Source unique `lib/machine-etats.ts` ; saisie manuelle restreinte aux 5 types légitimes (`TYPES_MOUVEMENT_MANUELS`, Zod strict M6) | M6-5/M6-6 : type métier interne saisi → 422 ; type inconnu → 422 | ✅ FERMÉ |
| 8 | Retour stock tronqué (`Math.min`) | Refus atomique `RETURN_QTY_EXCEEDS_ALLOCATED` (`lib/erreurs.ts:37`, service transactionnel) | Non-régression : sur-restitution refusée (allocated=3 → retour 5 rejeté, retours ≤3 acceptés), invariant SQL vérifié | ✅ FERMÉ |
| 9 | État matériel par REGEX | Liste fermée d'états validée Zod + machine d'états ; commentaire libre non décisionnel | M6 (enum états) ; transitions interdites → 409 | ✅ FERMÉ |
| 10 | Statuts chaînes libres | CHECK PostgreSQL : Affectation IN ('Active','Restituée','Annulée'), ArticleStock IN ('En Stock','Affecté','En Maintenance','Rebut / Fin de vie','Supprimé') (migration `20260823120000`) ; transitions centralisées machine d'états | Valeur invalide → 422 ; transition interdite → 409 `INVALID_STATUS_TRANSITION` (M6/non-régression) | ✅ FERMÉ |
| 11 | Query params non validés | Zod à la frontière : filtres journal (`schemaFiltresJournalAudit`), recherche stock (`schemaRechercheStock`), pagination plafonnée (limite ≤ 200) | H4-17+ paramètres invalides → 422 ; recherche SQL testée | ✅ FERMÉ (généralisation aux autres listes : dette §7) |
| 12 | Date invalide → aujourd'hui | `versDate()` lève 400 `DATE_INVALIDE` pour toute valeur fournie invalide (`lib/ids.ts`) | Couvert par schémas Zod dateSeule + services | ✅ FERMÉ |

### Phase 3 — Tests et qualité

| # | Objet | État |
|---|---|---|
| 13 | Vérificateur historique conservé | ✅ `verifier-non-regression.ts` maintenu et enrichi (sections A→L) |
| 14 | Vitest | ❌ NON FAIT — pas de suite Vitest. Les validations passent par 3 suites tsx exécutées réellement (non-régression, concurrence, phase 1 : ~120 contrôles). Justification report : couverture équivalente en pratique, industrialisation restante (cf. §7). |
| 15 | Concurrence réelle | ✅ `probe-concurrence.ts` : 20 POST simultanés, dispo=1 → exactement 1 succès / 19 refus, aucune quantité négative, invariant SQL valide |
| 16 | Immutabilité AuditLog réelle | ✅ UPDATE brut exécuté contre le trigger → refus vérifié (non-régression L.) ; DELETE historique → 409 ; jamais basé sur le nom du trigger |
| 17 | CI GitHub | ❌ NON APPLICABLE EN L'ÉTAT — aucun remote Git configuré (dépôt local). Documenté ; à créer au moment de la mise en place du dépôt distant. |
| 18 | ESLint/Prettier | ❌ NON FAIT — reporté (risque de churn massif juste avant chantier 4 ; tsc strict + revues manuelles en place). |

### Phase 4 — Sessions et durcissement

| # | Objet | État |
|---|---|---|
| 19 | Purge sessions | ✅ M3 : planificateur borné (`PURGE_INTERVALLE_MINUTES`), grâce 1 h, arrêt propre, purge aussi idempotence/compteurs morts C2+IP ; journal/notifications conservés (politique documentée) |
| 20 | Rate limiter persistant | ✅ C2 : PostgreSQL persistant atomique (5 échecs/15 min, backoff 30 s→4 min, Retry-After), résiste aux redémarrages ; complété M2 par limiteur par IP (30 échecs/1 h → blocage 15 min) |
| 21 | CSP | ✅ H5 : active, adaptée à l'inventaire réel, `script-src 'self'` strict, `'unsafe-inline'` limité aux styles documenté, testée live (prod temporaire + sondes) |
| 22 | Health | ✅ **Ajouté en clôture (commit `6b32b8d`)** : `GET /api/health` public, SELECT 1, uptime, horodatage, 503 si base KO, zéro secret ; contrôle en non-régression |
| 23 | Logging structuré | ✅ Partiel-conforme : logger maison centralisé `lib/journal-serveur.ts` (horodatage ISO, niveau, composant), console.* remplacés (commit `4304da6`) ; Pino/request-ID non installés (dette P3). Interdiction de log des secrets respectée (audité). |
| 24 | Mot de passe démo statique | ✅ `Distra-Demo-2026` retiré du code ; lu depuis `MOT_DE_PASSE_DEMO` env, seed démo désactivable/refusé en production |

### Phase 5 — Scalabilité/performance

| # | Objet | État |
|---|---|---|
| 25 | Références O(n) | ✅ Compteur transactionnel `prochainNumero` (INSERT…ON CONFLICT…RETURNING), formats STK/MVT/AFF préservés, unicité sous concurrence (probe) |
| 26 | Pagination serveur | ◐ AuditLog paginé (H4) ; mouvements/affectations/utilisateurs/articles/notifications encore en agrégat — reporté explicitement (constat H2, cf. §7) |
| 27 | Recherche DB | ✅ Recherche stock poussée en SQL (contains insensitive + opérateurs JSON, commit refactor C+D) ; autres recherches simples indexées |
| 28 | Seuils post-affectation | ✅ Plus de boucle de findUnique : seuils vérifiés sur objets déjà chargés (`verifierSeuilStock(article)`), fallback unique pour saisie directe SIM |
| 29 | Marquer tout lu batch | ✅ `POST /api/notifications/lue-tout`, updateMany borné au destinataire + statut OUVERTE |
| 30 | Réduire `/api/data` | ❌ Reporté (H2/Phase F) — agrégat conservé, gated `parc.consulter`, volume actuel LAN interne acceptable |
| 31 | Monétaire exact | ✅ `Decimal(12,2)` Prisma de bout en bout, conversion unique au sérialiseur, preprocess montant français |

### Phase 6 — Journal d'audit UI
✅ **FERMÉ (H4)** : API paginée/filtrée protégée + écran lecture seule (aucun UPDATE/DELETE UI), détail avant/après avec masquage des secrets.

## 2. Constats non traités et justification

- **14 Vitest** : les trois suites existantes couvrent réellement les mêmes domaines (exécution prouvée ci-dessous) ; l'introduction d'un runner juste avant chantier 4 apporterait du churn sans gain immédiat de couverture.
- **17 CI** : aucun remote Git — inapplicable aujourd'hui, à activer avec le dépôt distant.
- **18 ESLint/Prettier** : choix de stabilité avant chantier 4 ; tsc strict + revues en place.
- **26/30 pagination & réduction `/api/data`** : besoin réel lié à la croissance des données ; périmètre fonctionnel (chantiers suivants), gated et fonctionnel en interne.

Aucun P1 confirmé ne reste ouvert.

## 3. Migrations DB (8)

`20260822122711_init` · `20260822141900_chantier3_notifications_idempotence` · `20260822143016_chantier3_maintenance_bucket` · `20260823090000_chantier3_contraintes_securite` · `20260823100000_chantier3_invariant_maintenance` · `20260823120000_chantier3_5_durcissement` (chiffrement secrets SIM, CHECK statuts, permissions) · `20260823200000_c2_tentatives_timestamptz` (correctif fuseau UTC) · `20260823213000_m2_limitation_ip`.
`prisma migrate status` : base à jour. Replay intégral 8/8 validé sur base jetable propre (Phase 1).

## 4. Permissions ajoutées/modifiées

- Ajoutées/appliquées serveur : `parc.consulter`, `utilisateurs.consulter`, `affectations.confidentiels`, `audit.consulter` (désormais réellement portée par une route).
- Gérées existantes confirmées sur chaque mutation : `societes.gerer`, `utilisateurs.gerer`, `stock.ecrire`, `affectations.ecrire`, `stock.mouvement`, `notifications.gerer` selon domaine.
- Anonyme=401 partout sauf `/api/auth/*` et `/api/health` ; rôle interdit=403 vérifié par rôle.

## 5. Tableau PASS/FAIL des tests réellement exécutés (23/08)

| Test | Résultat |
|---|---|
| TypeScript backend (`tsc --noEmit`) | PASS |
| TypeScript frontend (`tsc --noEmit`) | PASS |
| Build complet racine (backend + Vite prod) | PASS |
| `prisma migrate status` / replay 8 migrations base propre | PASS / PASS |
| Auth (login, générique 401, inactif, première connexion, logout, sessions glissantes) | PASS |
| Anti-bruteforce persistant C2 (+ backoff, Retry-After) | PASS |
| Limiteur IP M2 (seuil 30, blocage, spoof XFF ignoré) | PASS |
| RBAC par rôle (401/403/200 multi-rôles) | PASS |
| Stock entrée/sortie/retour/ajustement + invariant SQL + RETURN_QTY | PASS |
| Affectation/double/restitution/réaffectation/annulation/idempotence | PASS |
| Concurrence 20× dispo=1 (1 succès / 19 refus) | PASS |
| Notifications A/B indépendantes, déduplication, batch tout-lu | PASS |
| AuditLog sans secrets + UPDATE/DELETE interdits (trigger réel) | PASS |
| PIN révélé absent du journal servi ; chiffrement au repos | PASS |
| Faux XFF ignoré / consommé selon TRUST_PROXY ; config proxy invalide = échec démarrage | PASS |
| Zod payloads + query params + dates invalides → 400/422 structurés | PASS |
| CSP active + build sans script inline + login/navigation live | PASS |
| Purge technique (bilans, hors journal/notifications) | PASS |
| GET /api/health anonyme → 200 serveur/base ok | PASS |
| Vérificateur Phase 1 (67 contrôles) | PASS |
| Vérificateur non-régression historique | PASS |
| Sonde concurrence | PASS |
| Vitest | FAIL (absent — justifié §2) |
| CI | FAIL (sans remote — justifié §2) |

## 6. Risques restants

- **P2** — Absence de suite de tests automatisée versionnée (Vitest) : la régression repose sur des scripts tsx à lancer manuellement.
- **P2** — Agrégat `/api/data` non paginé (H2) : acceptable au volume interne actuel, deviendra un point de performance.
- **P3** — Pas de CI/lint automatisés (pas de remote Git).
- **P3** — Logger maison sans request-ID corrélation (Pino possible plus tard).
- **P3** — Chunk `MaterialAssignmentModule` >500 kB (atténué par lazy-loading).
- **P3** — `'unsafe-inline'` sur style-src (documenté, sans vecteur script).

## 7. Dette technique restante

Décomposition des composants géants (MaterialAssignmentModule 2 680 lignes…) · généralisation pagination/query-Zod aux listes restantes · chargements ciblés post-mutation (remplacement progressif de `/api/data`) · allowlist de sérialisation globale (aujourd'hui blacklist renforcée + masquage journal) · Pino + request ID · Vitest/CI/ESLint lors de la mise en place du dépôt distant.

## 8. Verdict

> ### **PRÊTE POUR AUDIT FINAL DE PRODUCTION INTERNE/VPN**

Tous les critères de sortie sont satisfaits : aucun P1 ouvert, aucune fuite de secret, XFF ne contourne rien, lectures sous permission, notifications par destinataire, retour stock honnête, dates invalides refusées, AuditLog immuable, builds/tests critiques verts. Le verdict n'est pas « PRÊTE POUR PRODUCTION » uniquement en raison des points P2/P3 ci-dessus (tests automatisés versionnés et CI notamment), qui relèvent de la mise en place du dépôt distant et du chantier suivant.

---
*Rapport de clôture généré après vérification réelle de chaque point ; commits de référence : `6daa4bf`, `80575cc`, `2bdc800`, `f57b1d2`→`691e5f5` (Phase 1), `6cfd785`/`4304da6`/`719d379` (refactoring/devsecops), `6b32b8d` (health).*
