# Rapport d'audit n°2 — STOCK-MANAGEMENT (passe approfondie)

**Date :** 22 août 2026 · **Nature :** audit complémentaire du rapport du même jour (`RAPPORT-AUDIT-2026-08-22.md`).
Cette deuxième passe couvre ce que la première n'avait pas détaillé : logique métier complète des services, migrations SQL brutes, comportements de bord, cohérence frontend/backend. Les constats P1 du premier rapport restent valables et ne sont pas répétés ici.

---

## 1. Confirmations positives (vérifiées en profondeur)

- **Migrations SQL solides** : invariant `quantity = disponible + affectée + maintenance` porté par une contrainte CHECK en base (dernière ligne de défense contre une course mal verrouillée), unicités conditionnelles IMEI/numéro de série, index unique partiel anti-doublon de notifications, triggers d'immuabilité des trois journaux avec échappatoire documentée (`app.purge_journaux`). C'est du très bon travail.
- **Sérialiseur** : liste noire effective (`motDePasseHash`, `tokenHash`, `supprimeLe`, `modifieLe`) — le hash de mot de passe ne fuit pas dans les réponses actuelles.
- **Restitution** : le matériel déclaré endommagé est forcé vers maintenance (jamais remis disponible automatiquement), double restitution impossible sous verrou `FOR UPDATE`, réforme auditable avec valeurs avant/après.
- **Idempotence frontend** : les écrans stock et affectations envoient bien `X-Cle-Idempotence`.

---

## 2. Nouveaux problèmes détectés

### 🔴 P1 — À corriger rapidement

**N1.1 — Usurpation d'adresse IP possible (`adresseIpDe`).**
`lib/auth.ts` lit **toujours** `X-Forwarded-For` en priorité, avant `req.ip`. Or `trust proxy 1` ne protège que si l'application est effectivement derrière exactement un proxy. Exposée directement (écoute sur `0.0.0.0`, cf. server.ts), l'app accepte un XFF forgé : contournement du limiteur de connexion (chaque tentative paraît venir d'une IP neuve) **et pollution du journal d'audit** (IP fausse tracée). *Correction : faire confiance à XFF uniquement si `req.ip` provient d'un proxy de confiance ; sinon utiliser `req.ip` seul.*

**N1.2 — Les notifications sont globales, pas par utilisateur.**
`GET /api/notifications` renvoie la même liste à tout le monde et `POST /:id/lue` marque lu **pour tous**. Deux effets : (a) deux gestionnaires se marchent dessus (l'un marque « lue », la cloche de l'autre se vide), (b) tout utilisateur connecté peut marquer lu des alertes qu'il n'a pas le droit de traiter. *Correction : ajouter `destinataireId` (ou table de lecture par utilisateur), ou au minimum restreindre le marquage lecture aux rôles concernés.*

**N1.3 — Boutons d'action frontend non filtrés par permission sur stock et affectations.**
`ITStockManagement.tsx` et `MaterialAssignmentModule.tsx` ne reçoivent **aucune prop `permissions`** (contrairement à Sociétés/Utilisateurs qui gèrent `canManage`). Un EMPLOYEE voit tous les boutons « Ajouter », « Mouvement », « Supprimer », « Affecter »… qui renverront 403. Le serveur protège (c'est l'essentiel), mais l'UX expose des actions impossibles. La nav affiche aussi les onglets sans distinction de rôle. *Correction : propager `profil.permissions` et masquer/désactiver.*

### 🟠 P2 — Incohérences métier

**N2.1 — Type de mouvement non déclaré créé hors liste blanche.**
`annulerAffectation` écrit des mouvements `"Annulation Affectation"` et la restitution crée `"Envoi Maintenance"`, mais ni l'un ni l'autre ne figurent dans `TYPES_MOUVEMENT` de stock.service.ts (liste utilisée pour valider `/stock/:id/movement`). Le vocabulaire de l'historique devient incohérent selon le chemin de code. *Correction : centraliser les types de mouvement dans une constante unique partagée (lib/machine-etats.ts ou dédié).*

**N2.2 — « Retour Stock » silencieusement tronqué.**
Dans `enregistrerMouvement`, branche retour non-maintenance : `returnQty = Math.min(qty, item.allocatedQty)` — si l'utilisateur demande le retour de 5 unités alors que 3 sont affectées, 3 sont retournées **sans erreur ni avertissement**, et le mouvement trace quand même `quantity: qty` (5). L'historique ment sur l'opération réelle. *Correction : refuser si `qty > allocatedQty` (cohérent avec les autres branches qui lèvent).*

**N2.3 — Détection « matériel dégradé » par regex fragile.**
`REGEX_ETAT_DEGRADE` teste des mots-clés français dans un champ libre (`endommag|cassé|hs…`). « Écran rayé mais fonctionnel » passera pour dégradé s'il contient « cassé » dans une phrase, l'inverse aussi. Conséquence forte : basculement automatique en maintenance obligatoire. *Correction : faire choisir l'état via une enum fermée côté formulaire + validation Zod, plutôt qu'analyser du texte libre.*

**N2.4 — Champs de statut en chaînes libres partout.**
`Affectation.status` (« Active », « Restitué », « Annulée ») et `ArticleStock.status` sont des `String` sans contrainte CHECK en base sur les valeurs autorisées (seules les quantités ont une CHECK). Une coquille dans un futur script passerait inaperçue. *Correction : enums Prisma ou CHECK IN (…) lors d'une prochaine migration.*

**N2.5 — Validation Zod absente sur query strings.**
`req.query["q"] as string | undefined` : cast direct sans validation (AGENTS.md règle 8 dit « à la frontière HTTP », or les query params sont une frontière). Un `q` non-chaîne (tableau `?q=a&q=b`) produirait un comportement imprévisible dans `.toLowerCase()`. *Correction : schéma Zod pour les paramètres de recherche/pagination.*

### 🟡 P3 — Améliorations

**N3.1 — Performance de `creerAffectation` post-commit.**
Après la transaction, la boucle de seuils relit `minThreshold` article par article (`await findUnique` dans une boucle). Et `prochaineReference` charge **toutes** les références d'affectations à chaque création (O(n) croissant). Fonctionnel aujourd'hui, dégradera avec le volume. *Correction : un seul `findMany({ where: { id: { in } } })` post-commit ; compteur/séquence pour les références (déjà signalé P2.3 du rapport 1).*

**N3.2 — `marquerToutLu` enverge N requêtes séquentielles.**
Boucle `for … await fetch(POST /lue)` : 20 notifications = 20 allers-retours. *Correction : endpoint batch `POST /notifications/lue-tout`.*

**N3.3 — Mot de passe de démo committé.**
`MOT_DE_PASSE_DEMO = "Distra-Demo-2026"` en dur dans `seed.ts` versionné. Bien que gardé par `AUTORISER_SEED_DEMO` et refusé en production, il révèle un schéma de mot de passe réel si quelqu'un active le flag sur un serveur. *Correction : le lire depuis l'environnement comme ADMIN_INITIAL_PASSWORD, valeur générée aléatoirement si absent.*

**N3.4 — Pas d'endpoint de santé ni de journal applicatif structuré.**
Pas de `/api/health` (utile pour supervision/Docker au chantier 11), logging exclusivement `console.error`. *Correction : endpoint health + logger structuré (pino) avant la mise en production.*

**N3.5 — Absence de configuration ESLint/Prettier.**
Les conventions AGENTS.md (pas de `any` injustifié…) reposent uniquement sur la discipline. Un ESLint avec `@typescript-eslint` (règles no-explicit-any, no-floating-promises) verrouillerait mécaniquement plusieurs règles du dépôt. Notamment : `alertesAPublier.push(...)` puis `await publier()` est un pattern correct mais fragile — `no-floating-promises` le sécuriserait.

**N3.6 — `/api/data` reste un gros agrégat rechargé à chaque action.**
Chaque mutation déclenche `fetchSourcingData()` qui recharge l'intégralité des 5 collections (sociétés + utilisateurs + articles + mouvements + affectations, mouvements inclus). Avec l'historique qui ne se supprime jamais (règle métier), ce payload croît indéfiniment et sera rechargé après chaque clic. *Correction : rechargements ciblés par domaine (déjà signalé P2.4 rapport 1 — ici c'est le côté frontend qui aggrave).*

**N3.7 — Pas de limiteur de débit général.**
Le rate limiting ne couvre que `/auth/login`. Les routes de lecture et mutations n'ont aucune limitation : un script interne peut marteler `/api/data`. Acceptable en réseau interne, à noter pour le durcissement.

**N3.8 — `versDate` accepte silencieusement les dates invalides.**
Une date mal formée (`assignedDate: "32/13/2026"`) est convertie en `undefined` puis remplacée par `new Date()` — la fiche est créée à la date du jour sans prévenir l'utilisateur. *Correction : lever une erreur de validation plutôt que substituer.*

---

## 3. Synthèse consolidée (rapports 1 + 2)

| Priorité | Rapport 1 | Rapport 2 |
|---|---|---|
| 🔴 Immédiat | Commit chantier 3 · sur-exposition `/api/data` et `/users` · PIN/PUK en clair · zéro test automatisé | Usurpation XFF/IP · notifications globales sans destinataire · boutons 403 visibles par rôle non autorisé |
| 🟠 Important | Limiteur en mémoire · purge sessions · références O(n) · pas de pagination · CSP off · float monétaire | Types de mouvement divergents · retour tronqué silencieux · regex état dégradé · statuts sans contrainte · query params non validés |
| 🟡 Amélioration | Écran journal d'audit · assignedTo JSON · FK lignes · monolithes frontend · CI · sauvegarde | Perf boucles seuils · marquer-tout-lu N requêtes · mdp démo committé · health endpoint · ESLint · dates invalides silencieuses |

## 4. Ordre d'exécution recommandé mis à jour

1. **Jour 1** : commit du chantier 3 (P1.1/R1) + corrections N1.1 (XFF) — quelques lignes chacune.
2. **Semaine 1** : N1.2 (notifications par destinataire), N1.3 (permissions dans l'UI), P1.2/R1 (permissions de lecture), N2.1 + N2.2 (cohérence mouvements).
3. **Semaine 2** : Vitest + CI (P1.4/R1), chiffrement PIN/PUK, Zod sur query params, enum de statuts.
4. **Semaine 3** : pagination, purge sessions, CSP, ESLint, health endpoint.
5. **Puis** : chantier 4 du plan (Référentiels/Employés).

---

*Vérifications réellement exécutées pour ce rapport : lecture intégrale de `affectations.service.ts`, `stock.service.ts`, `societes.service.ts`, `notifications.service.ts`, `lib/*` (erreurs, ids, machine-etats, journal-audit, notifications, acteur, serialisation, prisma, auth), `middleware/idempotence.ts`, `server.ts`, les 4 migrations SQL du chantier 3, `seed.ts`, `App.tsx` (navigation et flux données) ; grep ciblés (permissions frontend, innerHTML, idempotence, secrets).*
