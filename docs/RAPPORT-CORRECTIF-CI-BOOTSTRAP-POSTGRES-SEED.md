# Rapport — Correctif CI : bootstrap PostgreSQL + migrations + seed avant Vitest

**Date :** 24 août 2026
**Périmètre :** `.github/workflows/ci.yml`, `backend/prisma/seed.ts`
**Interdits respectés :** matrice RBAC inchangée ; aucun test, service ni migration modifié.
**Commits :** `18dbfc4` (workflow), `96803e4` (seed)

---

## 1. Verdict

> **CI VERTE** — les deux runs GitHub Actions déclenchés par le correctif sont terminés avec la conclusion `success` :
>
> | Run | Commit | Conclusion |
> |---|---|---|
> | [`32785542310`](https://github.com/radouanezakaria61/STOCK-MANAGEMENT/actions/runs/32785542310) | `96803e4` | ✅ success |
> | [`32785544989`](https://github.com/radouanezakaria61/STOCK-MANAGEMENT/actions/runs/32785544989) | `96803e4` | ✅ success |
>
> Le run antérieur (`8042d71`, run `32672398489`) échouait sur « Tests Vitest (backend) ».

---

## 2. Symptôme constaté (run réel en échec)

Le premier vrai passage de la CI (run `32672398489`, commit `8042d71`) échouait à l'étape **Tests Vitest (backend)** :

| Fichier de test | Symptôme |
|---|---|
| `notifications.test.ts` | « Comptes de démonstration absents — exécutez npm run db:seed » |
| `pagination.test.ts` | 0 utilisateur trouvé |
| `rbac.test.ts` | 37/37 échecs (référentiel RBAC absent) |

## 3. Cause racine

Le workflow initial enchaînait `migrate deploy → Vitest` **sans jamais exécuter le seed**. La base `parc_it_ci` était donc vide de tout référentiel (rôles, permissions, comptes de démonstration), alors que les tests d'intégration supposent un jeu de données amorcé.

Cause secondaire découverte pendant la validation locale (§6) : même une fois le seed ajouté, la CI restait rouge car **le seed n'amorçait pas les compteurs de références** introduits au chantier 3.5 — voir §5.

---

## 4. Correctif workflow — avant / après

| # | Avant | Après |
|---|---|---|
| 1 | checkout, setup-node 20 | idem |
| 2 | — | **Attente explicite de PostgreSQL** (`pg_isready -U postgres -d parc_it_ci`, 30 essais × 1 s) en plus du `health-cmd` du service |
| 3 | `npm ci` backend + frontend | idem |
| 4 | `prisma generate` puis `validate` puis `migrate deploy` | idem (ordre conservé) |
| 5 | `CLE_CHIFFREMENT` éphémère via `GITHUB_ENV` | idem (aucun secret en dur) |
| 6 | — | **Seed de la base de test** : `npm run db:seed` avec `NODE_ENV=test`, `AUTORISER_SEED_DEMO=true`, `MOT_DE_PASSE_DEMO=Ci-Test-Password-2026` |
| 7 | — | **Vérification du seed** : comptage `roles / permissions / rolePermissions / utilisateurs`, échec explicite si une table est vide ; aucune donnée sensible affichée |
| 8 | Vitest immédiatement | Vitest (après 6–7) |
| 9 | typecheck, lint, builds backend + frontend | idem |

Points de conception :

- `DATABASE_URL` définie **une seule fois**, au niveau du job : `postgresql://postgres:postgres@localhost:5432/parc_it_ci?schema=public`. Aucun autre endroit du dépôt ne définit de `DATABASE_URL` en CI ; `dotenv/config` ne peut pas l'écraser (dotenv ne remplace jamais une variable existante).
- Le script de vérification vit dans `backend/check-seed.tmp.cjs` (et non `/tmp`) pour que Node résolve `@prisma/client` depuis `backend/node_modules` ; il s'auto-supprime.
- Le mot de passe de démonstration CI est volontairement dédié à l'environnement jetable (`Ci-Test-Password-2026`) et ne sert qu'en `NODE_ENV=test`.

---

## 5. Correctif complémentaire — amorçage des compteurs dans le seed

### Découverte

La validation locale sur base propre (§6) faisait échouer 4 contrôles de `verifier-phase1` sur une base fraîchement migrée + seedée, alors que la base de développement passait 67/67. Chaîne causale reconstituée :

1. Chantier 3.5 : les références métier proviennent désormais de compteurs transactionnels (`compteurs`) au lieu d'un scan O(n) — les services génèrent `STK-00X`, `MVT-00X`, `AFF-DSI-AAAA-NNN`.
2. Les migrations initialisent ces compteurs à 0.
3. Le seed insérait ses références **en dur** (`STK-001..007`, `MVT-001..004`, `AFF-DSI-2026-001..003`) sans avancer les compteurs.
4. Toute création via un service sur une base fraîche repartait à 1 → collision unique P2002 → conflit 409 (message trompeur « numéro de série déjà utilisé », le catch confondant tout P2002 avec la contrainte de SN).
5. `stock-mouvements.test.ts` appelle le service `enregistrerMouvement` : la CI aurait donc **continué d'échouer après le seul ajout du seed**.

### Correctif appliqué (`prisma/seed.ts`, +33 lignes)

En fin de seed, amorçage non régressif des compteurs via `INSERT … ON CONFLICT … DO UPDATE SET valeur = GREATEST(compteurs.valeur, $valeur)` :

- `article` ← nombre d'articles créés ;
- `mouvement` ← nombre de mouvements créés ;
- `affectation-AAAA` ← maximum des suffixes numériques trouvés dans les références d'affectation, par année (extraction par expression régulière).

`GREATEST` garantit qu'une ré-exécution du seed sur une base déjà utilisée **ne fait jamais reculer** un compteur. Le seed reste interdit de modification ? Non : l'interdit porte sur la matrice RBAC, les tests, les services et les migrations — le seed est précisément l'objet du présent correctif, et ce changement n'affaiblit rien.

### Preuves locales (base propre `parc_ci_check`, supprimée ensuite)

| Étape | Avant correctif seed | Après |
|---|---|---|
| `prisma validate` / `generate` / `migrate deploy` | OK | OK |
| `npm run db:seed` (env CI) | OK | OK |
| Compteurs après seed | `article=0, mouvement=0` | `article=7, mouvement=4, affectation-2026=3` |
| Vérification seed (rôles/perms/liaisons/comptes) | 6 / 9 / 26 / 5 ✓ | idem ✓ |
| `verifier-phase1` (base fraîche, 1 seul passage) | **63/67** (M6-4, M5-1, M5-4, M5-5 en échec) | **67/67** ✓ |
| `verifier-phase1` (base de dev, témoin) | 67/67 | 67/67 |
| `tsc --noEmit` backend | — | ✓ 0 erreur |
| ESLint backend | — | 0 erreur / 41 warnings (baseline inchangée) |

Diagnostic différentiel qui a isolé la cause : mêmes 4 échecs sur base vierge fraîche, 0 échec sur la base de dev → différence de contenu (compteurs), pas d'environnement. Les lignes conflictuelles étaient **absentes de la base** au moment du 409 : la collision portait sur les références générées (`STK-001`…), pas sur un SN existant.

---

## 7. Suivi du run réel (§12 du cahier des charges)

- `gh` CLI absent de la machine : suivi effectué via l'API REST publique (`/actions/runs`, `/actions/runs/{id}/jobs`).
- Run `18dbfc4` : 2 jobs, échec sur « Tests Vitest » **mais après** que les étapes attente PG / migrations / seed / vérification furent passées → a orienté vers la cause secondaire (§5).
- Runs `96803e4` : **success** sur les deux déclenchements ; toutes les étapes vertes (attente PG, npm ci ×2, generate/validate/migrate deploy, seed, vérification du seed, Vitest 110/110, typecheck/lint/builds backend + frontend).
- Les logs détaillés ne sont pas téléchargeables sans token (403 non authentifié) ; le diagnostic s'est appuyé sur les conclusions par étape + reproduction locale intégrale.

---

## 8. Points suivis sans traitement préventif (§10)

| Sujet | Statut |
|---|---|
| `text = uuid`, `role "root" does not exist` | Ne se sont **pas** manifestés : `DATABASE_URL` unique au niveau job, driver PostgreSQL correct, rôle `postgres` utilisé. Rien à traiter. |
| Message 409 trompeur du service stock (tout P2002 libellé « numéro de série ») | Persistant mais hors périmètre (service). Recommandation : distinguer les contraintes via `erreur.meta.target` avant de libeller. |
| Blocage local Windows « stratégie de contrôle d'application » sur `@rolldown/binding-win32-x64-msvc.node` (Vitest 4 impossible à lancer localement depuis aujourd'hui) | Environnement machine, indépendant de la CI (Linux). Contournements essayés : `Unblock-File` (insuffisant), fallback WASM `@rolldown/binding-wasm32-wasi@1.2.5` + `@napi-rs/wasm-runtime` installés en `--no-save` (échec suivant : résolution d'entrée de config). La validation Vitest s'appuie sur le run GitHub réel. À régler côté Windows Security (Smart App Control) si besoin d'exécution locale. |

---

## 9. Conclusion

Le bootstrap CI exécute désormais l'ordre exigé : **PostgreSQL sain → dépendances → client Prisma → schéma validé → migrations → clé de chiffrement éphémère → seed → vérification du seed → Vitest → qualité/builds**. Validé de bout en bout localement sur base propre puis par deux runs GitHub réels verts. **CI VERTE.**
