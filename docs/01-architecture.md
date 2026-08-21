# IT Stock Manager — PHASE 1 : Analyse & Architecture

> Document de conception à valider avant toute génération de code.
> Version 1.0 — 19 août 2026

---

## 0. Décisions prises et points à valider

### 0.1 Décisions validées avec vous

| Sujet | Décision |
|---|---|
| Langue | **Tout en français** : interface, nommage du domaine, dossiers métier, messages |
| Authentification | **Auth.js (NextAuth v5)** + adapter Prisma + stratégie *database sessions* |
| Modèle de stock | **Hybride** : équipements sérialisés (1 ligne = 1 objet, QR unique) + articles quantitatifs (consommables) |
| Déploiement | **Docker auto-hébergé** (Next.js + PostgreSQL), données internes à l'entreprise |

### 0.2 Trois arbitrages que je dois vous expliquer avant de coder

**(A) Le français ne peut pas être total — 3 exceptions techniques.**

Vous avez demandé « tout en français », mais trois zones doivent rester en anglais pour des raisons de contrainte technique, pas de style :

1. **Les modèles d'authentification.** L'adapter Prisma d'Auth.js appelle littéralement `prisma.user`, `prisma.account`, `prisma.session`, `prisma.verificationToken`. Renommer ces modèles casse l'adapter. Ils restent donc `User`, `Account`, `Session`, `VerificationToken`, mais avec `@@map("utilisateurs")`, `@@map("comptes")`… pour que **les tables PostgreSQL soient en français**.
2. **Les valeurs d'enums.** Votre cahier des charges §7 et §15 impose `AVAILABLE`, `ASSIGNED`, `OPEN`, `IN_PROGRESS`… Je les conserve telles quelles : ce sont des valeurs stockées en base, changer leur langue plus tard coûte une migration. Le français apparaît uniquement à l'affichage, via un dictionnaire de traduction centralisé (`src/lib/libelles.ts`). Vous pourrez donc écrire « Disponible » partout sans toucher à la base.
3. **Les mots-clés du framework.** `page.tsx`, `layout.tsx`, `route.ts`, `app/`, `api/`, `middleware.ts` sont imposés par Next.js.

Tout le reste — modèles Prisma (`Equipement`, `Employe`, `MouvementStock`), champs (`numeroInventaire`, `dateFinGarantie`), dossiers métier (`src/modules/equipements/`), services, validations, libellés — est en français.

**(B) Les routes API : `/api/equipements` et non `/api/assets`.**

Votre §26 listait des routes anglaises (`/api/assets`, `/api/employees`), écrites avant qu'on tranche la langue. Par cohérence avec « tout en français », je propose de basculer les routes en français. **Dites-moi si vous préférez garder les URL anglaises** : c'est le seul point où votre cahier des charges et votre choix de langue se contredisent, et c'est plus simple à trancher maintenant qu'après 40 fichiers.

**(C) Deux entités que votre cahier des charges n'a pas listées mais dont l'application a besoin.**

Je ne les ajoute pas pour gonfler le code (règle 10), elles sont structurellement nécessaires :

- **`ArticleStock` + `NiveauStock`** — sans elles, votre §9 (« stock faible », « quantité si nécessaire ») et votre §5 (alerte stock faible) sont impossibles : un seuil de réapprovisionnement n'a aucun sens sur un objet unique sérialisé. C'est le pilier du modèle hybride que vous avez choisi.
- **`ProcessusDepart` + `LigneProcessusDepart`** — votre §11 décrit un *workflow* d'offboarding avec plusieurs décisions par équipement. Sans une entité qui porte l'état d'avancement, l'offboarding n'est qu'une liste d'actions manuelles sans garantie que rien n'est oublié.

J'ajoute aussi `Document`, `Inventaire`/`LigneInventaire` et `ParametresApplication`, explicitement demandés en §27, §9 et §1.

---

## 1. Architecture technique globale

### 1.1 Principe directeur

**Le serveur est la seule source de vérité.** Aucune règle métier, aucun contrôle de permission, aucune écriture ne dépend du navigateur. Le frontend affiche et propose ; il ne décide jamais.

Concrètement, cela impose une règle non négociable dans tout le projet :

> Un composant React ne parle jamais directement à Prisma.
> Il passe par un **Server Action** ou une **Route Handler**, qui appelle un **service métier**, qui seul touche à la base.

Cette couche service est ce qui rend possible les règles 4, 5 et 6 de votre cahier des charges (permissions serveur, audit systématique, historique inviolable) : elles sont appliquées **à un seul endroit** au lieu d'être répétées — et donc oubliées — dans chaque écran.

### 1.2 Les 5 couches

```text
┌──────────────────────────────────────────────────────────────┐
│  1. PRÉSENTATION                                             │
│     React Server Components (lecture) + Client Components    │
│     (interactivité) — shadcn/ui, Tailwind, Recharts          │
│     Ne contient AUCUNE règle métier.                         │
└───────────────────────────┬──────────────────────────────────┘
                            │ Server Actions / fetch JSON
┌───────────────────────────▼──────────────────────────────────┐
│  2. FRONTIÈRE APPLICATIVE                                    │
│     • Route Handlers  src/app/api/**/route.ts                │
│     • Server Actions  src/modules/*/actions.ts               │
│     Responsabilités : authentifier, valider (Zod),           │
│     autoriser (RBAC), limiter le débit, formater la réponse. │
│     Aucune requête Prisma directe ici.                       │
└───────────────────────────┬──────────────────────────────────┘
                            │ appels typés
┌───────────────────────────▼──────────────────────────────────┐
│  3. SERVICES MÉTIER   src/modules/*/service.ts               │
│     Le cœur : affecter, retourner, transférer, mettre en     │
│     maintenance, entrer/sortir du stock, clôturer un départ. │
│     Chaque opération = 1 transaction Prisma qui écrit        │
│     l'entité + le mouvement + l'audit + la notification.     │
└───────────────────────────┬──────────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────▼──────────────────────────────────┐
│  4. ACCÈS AUX DONNÉES                                        │
│     Prisma ORM — requêtes paramétrées (anti-injection),      │
│     sélections explicites, pagination serveur.               │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  5. INFRASTRUCTURE                                           │
│     PostgreSQL 16 · stockage fichiers · Docker · logs        │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Transversal (appelé depuis la couche 3, jamais depuis la 1)

| Service transversal | Rôle |
|---|---|
| `journaliserAudit()` | Écrit dans `JournalAudit` **dans la même transaction** que l'opération. Si l'audit échoue, l'opération est annulée. |
| `notifier()` | Crée les notifications in-app. Interface `CanalNotification` prête pour l'email (phase ultérieure). |
| `verifierPermission()` | Contrôle RBAC serveur. Lève `ErreurAutorisation` → 403. |
| `limiteurDebit()` | Rate limiting sur connexion, import, export, scan. |
| `chiffrer()` / `dechiffrer()` | AES-256-GCM pour les clés de licence. |

### 1.4 Pourquoi Server Actions **et** Route Handlers (et pas l'un ou l'autre)

- **Server Actions** pour tout ce que déclenche un formulaire interne : création d'équipement, affectation, retour. Bénéfice direct : protection CSRF native, revalidation du cache automatique, pas de duplication de types entre client et serveur.
- **Route Handlers** (`/api/...`) pour ce qui doit être appelable de l'extérieur ou en GET : recherche globale, export de fichiers, endpoint de scan QR, futures intégrations (Active Directory, GLPI, ITSM).

Les deux appellent **le même service**. Il n'existe jamais deux chemins d'écriture pour une même opération métier.

---

## 2. Stack technique finale

| Domaine | Choix | Version cible | Justification |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.x | RSC, Server Actions, streaming, un seul déploiement front+back |
| Langage | TypeScript `strict` | 5.6+ | `strict: true`, `noUncheckedIndexedAccess: true`, `any` interdit hors cas justifié |
| UI | React | 19 | — |
| Styles | Tailwind CSS | 4.x | Thème piloté par variables CSS → couleur d'entreprise configurable |
| Composants | shadcn/ui (Radix) | — | Code possédé, pas une dépendance opaque ; accessibilité clavier native |
| Icônes | Lucide React | — | Demandé |
| Base | PostgreSQL | 16 | Contraintes fortes, index partiels, `citext`, `pg_trgm` pour la recherche |
| ORM | Prisma | 6.x | Migrations versionnées, typage bout-en-bout |
| Auth | Auth.js (NextAuth) v5 | 5.x | Sessions en base, adapter Prisma, extensible SSO/Entra ID |
| Hashage | `@node-rs/argon2` (argon2id) | — | Plus résistant que bcrypt aux attaques GPU ; recommandation OWASP |
| Validation | Zod | 3.x | Un schéma partagé client + serveur, mais **revalidé serveur** |
| Formulaires | React Hook Form + `@hookform/resolvers` | 7.x | Demandé |
| Tables | TanStack Table | 8.x | Tri/filtres/colonnes, **pagination pilotée serveur** |
| Requêtes client | TanStack Query | 5.x | Cache, invalidation après mutation, états de chargement |
| Graphiques | Recharts | 2.x | Demandé |
| QR code | `qrcode` (génération) + `html5-qrcode` (lecture caméra) | — | Génération SVG serveur, scan navigateur mobile |
| Excel / CSV | ExcelJS + Papa Parse | — | Import et export |
| PDF | React-PDF (`@react-pdf/renderer`) | — | Rapports et étiquettes |
| Toasts | Sonner | — | Intégré shadcn/ui |
| Thème | next-themes | — | Dark / Light |
| Dates | date-fns + locale `fr` | 4.x | Formats FR, calculs de garantie |
| Tests unitaires | Vitest | 2.x | Services métier, permissions, validations |
| Tests E2E | Playwright | 1.4x | Parcours critiques |
| Qualité | ESLint + Prettier + Husky + lint-staged | — | Barrière avant commit |
| Conteneurs | Docker + docker-compose | — | App + PostgreSQL + volume de sauvegarde |

**Deux dépendances volontairement écartées :**

- *Redis* — le rate limiting et le cache passent d'abord par PostgreSQL et le cache Next.js. Ajouter Redis dès le départ, c'est un service de plus à administrer pour un parc de quelques milliers d'équipements. L'interface `MagasinLimiteDebit` permet de basculer sur Redis plus tard sans toucher au métier.
- *Un stockage objet type S3* — les documents (factures, bons de livraison) vont dans un volume Docker, derrière une interface `StockageFichiers` avec une implémentation `StockageLocal`. Si un jour l'entreprise veut S3 ou MinIO, une seule classe change.

---

## 3. Architecture des dossiers

Organisation **par module métier**, pas par type de fichier. Chercher « comment fonctionne une affectation » revient à ouvrir un seul dossier, au lieu de sauter entre `components/`, `services/`, `types/` et `validations/`.

```text
it-stock-manager/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── index.ts
│       ├── 01-roles-permissions.ts
│       ├── 02-referentiels.ts        # départements, localisations, catégories
│       ├── 03-utilisateurs.ts        # comptes de démonstration
│       ├── 04-employes.ts
│       ├── 05-fournisseurs.ts
│       ├── 06-equipements.ts
│       ├── 07-affectations.ts
│       ├── 08-maintenances.ts
│       └── 09-licences.ts
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── connexion/page.tsx
│   │   │   └── mot-de-passe-oublie/page.tsx
│   │   ├── (application)/                    # protégé par le layout + middleware
│   │   │   ├── layout.tsx                    # Sidebar + Header + fil d'Ariane
│   │   │   ├── tableau-de-bord/page.tsx
│   │   │   ├── equipements/
│   │   │   │   ├── page.tsx                  # liste + filtres
│   │   │   │   ├── nouveau/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx              # fiche complète (§27)
│   │   │   │       └── modifier/page.tsx
│   │   │   ├── stock/
│   │   │   │   ├── articles/
│   │   │   │   ├── mouvements/
│   │   │   │   └── inventaires/
│   │   │   ├── employes/[id]/page.tsx
│   │   │   ├── departs/[id]/page.tsx          # workflow d'offboarding
│   │   │   ├── maintenances/
│   │   │   ├── logiciels/
│   │   │   ├── fournisseurs/
│   │   │   ├── localisations/
│   │   │   ├── departements/
│   │   │   ├── rapports/
│   │   │   ├── journal-audit/
│   │   │   ├── notifications/
│   │   │   ├── scan/page.tsx                  # scanner QR (mobile)
│   │   │   └── parametres/
│   │   │       ├── general/                   # nom, logo, couleur (§1)
│   │   │       ├── utilisateurs/
│   │   │       ├── roles/
│   │   │       └── categories/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── equipements/route.ts
│   │   │   ├── equipements/[id]/route.ts
│   │   │   ├── recherche/route.ts
│   │   │   ├── import/route.ts
│   │   │   ├── export/route.ts
│   │   │   └── ...  (cf. §8 conventions API)
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── modules/                        # ← le cœur métier, un dossier par domaine
│   │   ├── equipements/
│   │   │   ├── service.ts              # règles métier + transactions
│   │   │   ├── requetes.ts             # lectures optimisées (listes, fiche)
│   │   │   ├── actions.ts              # Server Actions
│   │   │   ├── schemas.ts              # Zod
│   │   │   ├── types.ts
│   │   │   └── composants/
│   │   │       ├── TableauEquipements.tsx
│   │   │       ├── FormulaireEquipement.tsx
│   │   │       ├── BadgeStatut.tsx
│   │   │       └── DialogueAffectation.tsx
│   │   ├── stock/
│   │   ├── employes/
│   │   ├── departs/
│   │   ├── maintenances/
│   │   ├── logiciels/
│   │   ├── fournisseurs/
│   │   ├── referentiels/               # départements, localisations, catégories, marques
│   │   ├── rapports/
│   │   ├── tableau-de-bord/
│   │   ├── audit/
│   │   ├── notifications/
│   │   ├── import-export/
│   │   └── parametres/
│   │
│   ├── composants/                     # partagé, sans logique métier
│   │   ├── ui/                         # shadcn/ui
│   │   ├── mise-en-page/               # Sidebar, Header, FilAriane, MenuUtilisateur
│   │   ├── tableaux/                   # DataTable générique, pagination, tri
│   │   ├── formulaires/                # ChampTexte, ChampDate, SelecteurEntite
│   │   └── retours/                    # EtatVide, Chargement, DialogueConfirmation
│   │
│   ├── lib/
│   │   ├── prisma.ts                   # singleton
│   │   ├── auth.ts                     # configuration Auth.js
│   │   ├── permissions.ts              # verifierPermission, matrice RBAC
│   │   ├── audit.ts
│   │   ├── chiffrement.ts              # AES-256-GCM
│   │   ├── limite-debit.ts
│   │   ├── erreurs.ts                  # ErreurMetier, ErreurAutorisation, ErreurConflit
│   │   ├── reponse-api.ts              # format JSON unifié
│   │   ├── libelles.ts                 # enums techniques → libellés français
│   │   ├── qrcode.ts
│   │   ├── stockage-fichiers.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   ├── types/
│   ├── config/
│   │   ├── navigation.ts               # sidebar : entrées + permission requise
│   │   ├── application.ts              # nom, logo, couleur par défaut
│   │   └── constantes.ts
│   └── middleware.ts                   # garde de session + en-têtes de sécurité
│
├── tests/
│   ├── unitaires/
│   └── e2e/
└── docs/
    ├── 01-architecture.md              # ce document
    ├── 02-modele-donnees.md
    └── 03-deploiement.md
```

**Une règle d'import à respecter :** `modules/x` peut importer `lib/`, `composants/` et `modules/x`. Un module n'importe **jamais** le `service.ts` d'un autre module directement — il passe par une fonction publique exportée depuis l'`index.ts` du module cible. Sinon, en six mois, tout dépend de tout.

---

## 4. Modèle de données

### 4.1 Vue d'ensemble : 31 tables réparties en 6 blocs

| Bloc | Tables |
|---|---|
| **Sécurité & accès** | `User`, `Account`, `Session`, `VerificationToken`, `Role`, `Permission`, `RolePermission` |
| **Référentiels** | `Departement`, `Localisation`, `Categorie`, `Marque`, `Modele`, `Fournisseur` |
| **Personnes** | `Employe` |
| **Parc & stock** | `Equipement`, `Affectation`, `MouvementStock`, `ArticleStock`, `NiveauStock`, `Maintenance`, `Inventaire`, `LigneInventaire` |
| **Logiciels** | `Logiciel`, `Licence`, `AffectationLicence` |
| **Processus & transverse** | `ProcessusDepart`, `LigneProcessusDepart`, `Document`, `Notification`, `JournalAudit`, `ParametresApplication` |

### 4.2 Le choix structurant : `Equipement` vs `ArticleStock`

C'est la décision qui conditionne tout le reste du modèle.

| | `Equipement` (sérialisé) | `ArticleStock` (quantitatif) |
|---|---|---|
| Granularité | 1 ligne = 1 objet physique | 1 ligne = 1 référence + quantités |
| Exemples | Dell Latitude 5440 n° série JH8K2L1 | Câble HDMI 2 m, toner HP 26A, souris standard |
| Identifiant | Numéro d'inventaire unique + QR code | Référence interne |
| Statut | AVAILABLE / ASSIGNED / MAINTENANCE… | Pas de statut, uniquement des quantités |
| Affectation | Nominative, historisée | Sortie consommée, non restituée |
| Alerte | Fin de garantie, sans utilisateur | **Seuil de réapprovisionnement** |
| Quantité par localisation | Implicite (l'objet est à un endroit) | Table `NiveauStock` (référence × localisation) |

Les deux alimentent **la même table `MouvementStock`**. Un mouvement pointe soit vers un `Equipement` (quantité toujours 1), soit vers un `ArticleStock` (quantité N) — contrainte SQL : exactement l'un des deux est renseigné. Vous obtenez ainsi un historique unifié et un seul écran « Mouvements », comme demandé en §9.

### 4.3 Diagramme — noyau parc

```mermaid
erDiagram
    Categorie   ||--o{ Modele       : "classe"
    Marque      ||--o{ Modele       : "fabrique"
    Modele      ||--o{ Equipement   : "décline"
    Categorie   ||--o{ Equipement   : "classe"
    Categorie   ||--o{ Categorie    : "parent de"
    Fournisseur ||--o{ Equipement   : "fournit"
    Localisation||--o{ Equipement   : "héberge"
    Departement ||--o{ Equipement   : "rattache"
    Employe     ||--o{ Equipement   : "détient (courant)"

    Departement ||--o{ Employe      : "emploie"
    Localisation||--o{ Employe      : "situe"
    Employe     ||--o{ Employe      : "manage"

    Equipement  ||--o{ Affectation  : "historise"
    Employe     ||--o{ Affectation  : "reçoit"
    Equipement  ||--o{ Maintenance  : "subit"
    Equipement  ||--o{ MouvementStock : "trace"
    Equipement  ||--o{ Document     : "documente"
```

### 4.4 Diagramme — stock, logiciels, départs

```mermaid
erDiagram
    ArticleStock  ||--o{ NiveauStock    : "réparti en"
    Localisation  ||--o{ NiveauStock    : "contient"
    ArticleStock  ||--o{ MouvementStock : "trace"
    Categorie     ||--o{ ArticleStock   : "classe"
    Fournisseur   ||--o{ ArticleStock   : "fournit"

    Inventaire    ||--o{ LigneInventaire : "compte"
    Localisation  ||--o{ Inventaire      : "porte sur"

    Logiciel      ||--o{ Licence            : "possède"
    Licence       ||--o{ AffectationLicence : "attribue"
    Employe       ||--o{ AffectationLicence : "utilise"
    Equipement    ||--o{ AffectationLicence : "installe"
    Fournisseur   ||--o{ Licence            : "vend"

    Employe          ||--|| ProcessusDepart      : "déclenche"
    ProcessusDepart  ||--o{ LigneProcessusDepart : "détaille"
    Equipement       ||--o{ LigneProcessusDepart : "concerne"
```

### 4.5 Diagramme — sécurité et transverse

```mermaid
erDiagram
    Role ||--o{ User           : "attribue"
    Role ||--o{ RolePermission : "détient"
    Permission ||--o{ RolePermission : "accordée par"
    User ||--o{ Session        : "ouvre"
    User ||--o{ Account        : "lie"
    User ||--o{ JournalAudit   : "génère"
    User ||--o{ Notification   : "reçoit"
    User ||--o{ MouvementStock : "effectue"
    User ||--o{ Affectation    : "valide"
    Employe ||--o| User        : "correspond à"
```

### 4.6 Détail des tables principales

#### `Equipement` — table centrale

| Champ | Type | Contraintes / notes |
|---|---|---|
| `id` | UUID | PK, `@default(uuid())` |
| `numeroInventaire` | String | **UNIQUE**, indexé. Généré automatiquement : `ITSM-LAP-2026-0042` (préfixe configurable) |
| `numeroSerie` | String? | `@unique` — PostgreSQL autorise plusieurs NULL sur une contrainte unique, donc les équipements sans numéro de série coexistent sans astuce |
| `codeQr` | String | **UNIQUE** — jeton aléatoire 32 caractères, **pas** l'id (voir §7.5 sécurité) |
| `categorieId` | UUID | FK → `Categorie`, `onDelete: Restrict` |
| `modeleId` | UUID? | FK → `Modele` (porte la marque) |
| `marqueLibre` / `modeleLibre` | String? | Saisie libre si le modèle n'est pas au référentiel — évite de bloquer la saisie terrain |
| `description` | String? | |
| `statut` | Enum `StatutEquipement` | Indexé. AVAILABLE / ASSIGNED / RESERVED / MAINTENANCE / DAMAGED / LOST / RETIRED / DISPOSED |
| `etatPhysique` | Enum `EtatPhysique` | NEUF / BON / CORRECT / USE / DEFECTUEUX |
| `localisationId` | UUID? | FK → `Localisation` |
| `departementId` | UUID? | FK → `Departement` |
| `employeId` | UUID? | FK → `Employe` — **détenteur courant, dénormalisé volontairement** (cf. 4.8) |
| `fournisseurId` | UUID? | FK → `Fournisseur` |
| `dateAchat` | Date? | |
| `prixAchat` | Decimal(12,2)? | `Decimal`, **jamais** `Float` : pas d'erreur d'arrondi sur la valeur du parc |
| `devise` | String(3) | Défaut `MAD` |
| `dateReception` | Date? | |
| `dateDebutGarantie` | Date? | |
| `dateFinGarantie` | Date? | **Indexé** — alimente l'alerte « garantie bientôt expirée » |
| `dureeGarantieMois` | Int? | Calculé si les deux dates sont fournies, sinon saisi |
| `dateMiseEnService` | Date? | |
| `dateFinDeVie` | Date? | |
| `notes` | String? | |
| `creeParId` / `modifieParId` | UUID? | FK → `User` |
| `creeLe` / `modifieLe` | DateTime | `@default(now())` / `@updatedAt` |
| `supprimeLe` | DateTime? | **Soft delete** — filtré par défaut dans toutes les requêtes |

*Index composés prévus :* `(statut, categorieId)`, `(employeId)`, `(localisationId)`, `(dateFinGarantie)`, plus un index GIN `pg_trgm` sur `numeroInventaire`, `numeroSerie`, `marqueLibre`, `modeleLibre` pour la recherche approximative.

#### `Affectation` — historique nominatif (jamais modifié)

`id`, `equipementId`, `employeId`, `dateAffectation`, `dateRetourPrevue?`, `dateRetour?`, `statut` (ACTIVE / RETURNED / LOST / REPLACED), `etatALaRemise`, `etatAuRetour?`, `motifRetour?`, `attribueParId` (User), `receptionneParId?` (User), `commentaire?`, `pieceJointeDechargeId?` (→ `Document`, la décharge signée), `creeLe`.

**Contrainte forte :** un équipement ne peut avoir **qu'une seule affectation ACTIVE** à la fois. Prisma ne sait pas déclarer d'index unique partiel, la contrainte est donc ajoutée par une migration SQL manuelle :

```sql
CREATE UNIQUE INDEX affectation_active_unique
  ON affectations (equipement_id) WHERE statut = 'ACTIVE';
```

C'est la base de données qui l'empêche, pas seulement le code : même un script mal écrit ne pourra pas créer de double affectation.

#### `MouvementStock` — journal immuable

`id`, `reference` (UNIQUE, `MVT-2026-000128`), `type` (ENTREE / SORTIE / TRANSFERT / AJUSTEMENT / RETOUR / REBUT / AFFECTATION / RETOUR_AFFECTATION / MAINTENANCE_ENTREE / MAINTENANCE_SORTIE), `equipementId?`, `articleStockId?`, `quantite` (Int, défaut 1), `localisationSourceId?`, `localisationDestinationId?`, `statutAvant?`, `statutApres?`, `employeId?`, `effectueParId` (User, requis), `dateMouvement`, `commentaire?`, `documentReference?` (n° BL, facture), `creeLe`.

**Aucune colonne `modifieLe`, aucune colonne `supprimeLe`** — la table est en écriture seule (règle 6). Une erreur de saisie se corrige par un mouvement d'AJUSTEMENT inverse, référencé via `mouvementAnnuleId`. La révocation des droits UPDATE/DELETE est aussi posée au niveau PostgreSQL sur le rôle applicatif.

#### `ArticleStock` et `NiveauStock`

`ArticleStock` : `id`, `reference` (UNIQUE), `designation`, `categorieId`, `unite` (PIECE / METRE / BOITE), `seuilAlerte` (Int), `quantiteReappro` (Int?), `prixUnitaire` (Decimal?), `fournisseurId?`, `actif`, timestamps, soft delete.

`NiveauStock` : `id`, `articleStockId`, `localisationId`, `quantite` (Int, `CHECK quantite >= 0`), `modifieLe` — **`@@unique([articleStockId, localisationId])`**. Toute écriture passe par un `UPDATE … SET quantite = quantite + n` dans une transaction sérialisée : deux sorties simultanées ne peuvent pas faire passer le stock en négatif.

#### `Maintenance`

`id`, `numeroTicket` (UNIQUE, `MNT-2026-0031`), `equipementId`, `typeIntervention` (PREVENTIVE / CORRECTIVE / UPGRADE), `probleme`, `description?`, `priorite` (LOW / MEDIUM / HIGH / CRITICAL), `statut` (OPEN / IN_PROGRESS / WAITING_PART / COMPLETED / CANCELLED), `technicienId?` (User), `fournisseurId?`, `dateDebut`, `dateFinPrevue?`, `dateFinReelle?`, `cout` (Decimal?), `sousGarantie` (Boolean — pré-rempli automatiquement en comparant `dateDebut` à `dateFinGarantie`), `resolution?`, `creeParId`, timestamps.

#### `Licence`

`id`, `logicielId`, `type` (PERPETUAL / SUBSCRIPTION / OEM / VOLUME / OPEN_SOURCE), `nombreLicences` (Int), **`nombreUtilisees` non stocké** — il est calculé depuis `AffectationLicence` (règle : pas de duplication de données), `cleChiffree` (String? — AES-256-GCM), `dateAchat?`, `dateExpiration?` (indexé), `cout` (Decimal?), `fournisseurId?`, `notes?`, timestamps, soft delete.

Contrainte applicative vérifiée en transaction : `COUNT(AffectationLicence actives) <= nombreLicences`.

#### `JournalAudit`

`id`, `utilisateurId?` (nullable : une tentative de connexion échouée n'a pas d'utilisateur identifié), `emailTentative?`, `action` (LOGIN / LOGIN_FAILED / LOGOUT / CREATE / UPDATE / DELETE / ASSIGN / RETURN / TRANSFER / MAINTENANCE / IMPORT / EXPORT / PERMISSION_CHANGE), `module`, `entiteId?`, `entiteLibelle?` (ex. « Dell Latitude 5440 — ITSM-LAP-2026-0042 », conservé même si l'entité est supprimée), `valeursAvant` (Jsonb?), `valeursApres` (Jsonb?), `adresseIp?` (Inet), `agentUtilisateur?`, `creeLe` (indexé).

Les champs sensibles (`motDePasseHash`, `cleChiffree`) sont **filtrés avant écriture** par une liste blanche : un log d'audit ne doit jamais devenir une fuite de secrets.

#### `ParametresApplication` — personnalisation (§1)

Table à ligne unique (`id` fixe = 1) : `nomApplication`, `logoUrl?`, `logoSombreUrl?`, `couleurPrimaire` (hex), `favicon?`, `deviseParDefaut`, `prefixeInventaire`, `formatNumeroInventaire`, `joursAlerteGarantie` (défaut 60), `joursAlerteLicence` (défaut 30), `joursMaintenanceLongue` (défaut 30), `urlPublique` (pour les QR codes), `modifieLe`.

La couleur primaire est injectée en variables CSS dans le `<head>` du layout racine → **changer la couleur de l'entreprise ne nécessite aucune recompilation**.

### 4.7 Récapitulatif des relations

| Relation | Cardinalité | Suppression |
|---|---|---|
| `Categorie` → `Equipement` | 1..N | `Restrict` (catégorie non supprimable si utilisée) |
| `Categorie` → `Categorie` | auto-référence (sous-catégories) | `SetNull` |
| `Marque` → `Modele` → `Equipement` | 1..N..N | `Restrict` |
| `Fournisseur` → `Equipement` / `ArticleStock` / `Licence` | 1..N | `SetNull` |
| `Localisation` → `Equipement` / `Employe` / `NiveauStock` | 1..N | `Restrict` sur `NiveauStock` |
| `Departement` → `Employe` / `Equipement` | 1..N | `Restrict` |
| `Employe` → `Employe` (manager) | auto-référence | `SetNull` |
| `Employe` → `Equipement` (détenteur courant) | 0..N | `Restrict` — on ne supprime pas un employé qui détient du matériel |
| `Equipement` → `Affectation` | 1..N (1 seule ACTIVE) | `Restrict` |
| `Equipement` / `ArticleStock` → `MouvementStock` | 1..N | `Restrict` — jamais de cascade sur l'historique |
| `Equipement` → `Maintenance` | 1..N | `Restrict` |
| `Logiciel` → `Licence` → `AffectationLicence` | 1..N..N | `Cascade` uniquement sur `AffectationLicence` |
| `Employe` → `ProcessusDepart` | 1..0..1 | `Restrict` |
| `User` → `Session` / `Account` | 1..N | `Cascade` |
| `Role` ↔ `Permission` | N..N via `RolePermission` | `Cascade` sur la table de liaison |

### 4.8 Deux décisions de modélisation à assumer

**`Equipement.employeId` duplique-t-il l'affectation active ?**

En apparence oui, et la règle 10 dit d'éviter les duplications. En pratique, sans ce champ, afficher une liste de 500 équipements avec leur détenteur exige une jointure sur `Affectation` filtrée sur `statut = 'ACTIVE'` à chaque requête, chaque tri et chaque export. J'assume donc une **dénormalisation contrôlée** : `employeId` est le cache du détenteur courant, mis à jour **uniquement** par le service d'affectation, dans la même transaction que la ligne `Affectation`. La source de vérité historique reste `Affectation` ; un test d'intégrité (phase 6) vérifie que les deux ne divergent jamais.

**Soft delete : où, et où surtout pas ?**

- **Avec** `supprimeLe` : `Equipement`, `Employe`, `Fournisseur`, `ArticleStock`, `Logiciel`, `Licence`, `User`, `Departement`, `Localisation`, `Categorie`.
- **Sans, jamais** : `MouvementStock`, `Affectation`, `Maintenance`, `JournalAudit`, `LigneInventaire`, `ProcessusDepart`. Ces tables sont l'historique ; les supprimer, même en douceur, violerait la règle 6.

Le filtrage `supprimeLe: null` est appliqué par une **extension Prisma globale**, pas répété dans chaque requête — parce qu'une seule requête où on oublie le filtre suffit à faire réapparaître des données archivées dans un rapport.

---

## 5. Rôles et permissions (RBAC)

### 5.1 Modèle choisi : rôles **et** permissions granulaires

Un simple `enum Role` sur `User` suffirait pour les 6 rôles demandés, mais rendrait impossible toute nuance ultérieure (« ce technicien peut aussi valider les sorties de stock »). J'utilise donc :

```text
User → Role → RolePermission → Permission
```

Les 6 rôles demandés sont **seedés** avec leur jeu de permissions ; le SUPER_ADMIN peut ensuite ajuster une permission depuis `Paramètres → Rôles` sans redéploiement. Toute modification passe par un audit `PERMISSION_CHANGE`.

Une permission s'écrit `module.action` : `equipements.creer`, `equipements.affecter`, `stock.sortir`, `maintenance.cloturer`, `rapports.exporter`, `audit.consulter`, `parametres.gerer`…

### 5.2 Matrice des permissions

Légende : **T** = tout · **L** = lecture seule · **C** = création/modification · **—** = aucun accès · **P** = ses propres données uniquement

| Module | SUPER_ADMIN | IT_MANAGER | IT_TECHNICIAN | STOCK_MANAGER | AUDITOR | EMPLOYEE |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Tableau de bord | T | T | T | Stock | L | P |
| Équipements — consulter | T | T | T | T | L | P |
| Équipements — créer / modifier | T | T | C | C | — | — |
| Équipements — supprimer (archiver) | T | T | — | — | — | — |
| Affecter / retourner / transférer | T | T | T | T | — | — |
| Stock — mouvements | T | T | C | T | L | — |
| Stock — inventaire physique | T | T | C | T | L | — |
| Stock — ajustement | T | T | — | C | — | — |
| Employés | T | T | L | L | L | P |
| Offboarding (départs) | T | T | Exécuter | — | L | — |
| Maintenance | T | T | T | L | L | P (ses tickets) |
| Fournisseurs | T | T | L | C | L | — |
| Logiciels / licences | T | T | L | L | L | P |
| Localisations / départements / catégories | T | C | L | L | L | — |
| Rapports — consulter | T | T | L | Stock | T | — |
| Rapports — exporter | T | T | — | Stock | T | — |
| Import Excel/CSV | T | T | — | Stock | — | — |
| Journal d'audit | T | L | — | — | T | — |
| Utilisateurs & rôles | T | — | — | — | L | — |
| Paramètres (nom, logo, couleurs) | T | — | — | — | — | — |
| Scan QR | T | T | T | T | L | P |

**Cas particulier `EMPLOYEE`.** Ce rôle ne filtre pas seulement l'affichage : le service applique un **filtre de portée** au niveau des requêtes (`where: { employeId: session.employeId }`). Un employé qui devinerait l'URL `/equipements/<id-d-un-collègue>` reçoit un 403, pas une page vide. La liaison se fait par `User.employeId`.

### 5.3 Application côté serveur — trois barrières

| Barrière | Où | Ce qu'elle bloque |
|---|---|---|
| 1. Middleware | `src/middleware.ts` | Accès sans session → redirection `/connexion`. Rapide, mais **grossier** : il ne connaît que la session. |
| 2. Layout applicatif | `app/(application)/layout.tsx` | Récupère la session complète + permissions ; masque les entrées de sidebar non autorisées. **Confort d'affichage, pas sécurité.** |
| 3. Service métier | `verifierPermission(session, 'equipements.affecter')` en **première ligne de chaque service** | La vraie barrière. Une Server Action, une route API ou un futur script appellent tous le même service : impossible de contourner. |

La règle qui rend cela fiable : **aucun service métier n'accepte d'être appelé sans session**. La signature est toujours `service(contexte: ContexteExecution, donnees: X)` où `ContexteExecution` porte l'utilisateur, ses permissions et son IP. Un appel sans contexte ne compile pas.

### 5.4 Comptes de démonstration (seed)

| Rôle | Email | Mot de passe |
|---|---|---|
| SUPER_ADMIN | `admin@itstock.local` | `Admin@2026!` |
| IT_MANAGER | `manager@itstock.local` | `Manager@2026!` |
| IT_TECHNICIAN | `tech1@itstock.local` | `Tech@2026!` |
| IT_TECHNICIAN | `tech2@itstock.local` | `Tech@2026!` |
| STOCK_MANAGER | `stock@itstock.local` | `Stock@2026!` |
| AUDITOR | `audit@itstock.local` | `Audit@2026!` |
| EMPLOYEE | `a.benali@itstock.local` | `Employe@2026!` |

Ces comptes ne sont créés **que** si `NODE_ENV !== 'production'` ou si `AUTORISER_SEED_DEMO=true`. Le seed de production ne crée que les rôles, les permissions et un unique compte administrateur dont le mot de passe est lu depuis `.env` et doit être changé à la première connexion.

---

## 6. Flux métier

### 6.1 Affectation d'un équipement à un employé

```mermaid
sequenceDiagram
    actor T as Technicien IT
    participant UI as Interface
    participant A as Server Action
    participant S as Service Affectation
    participant DB as PostgreSQL

    T->>UI: Fiche équipement → « Affecter »
    UI->>UI: Recherche employé + état à la remise + commentaire
    UI->>T: Confirmation « Affecter ce Dell Latitude à Ahmed Benali ? »
    T->>UI: Confirme
    UI->>A: affecterEquipement(equipementId, employeId, ...)
    A->>A: Validation Zod
    A->>S: contexte + données
    S->>S: verifierPermission('equipements.affecter')
    S->>DB: BEGIN
    S->>DB: SELECT equipement FOR UPDATE (verrou)
    alt statut ≠ AVAILABLE / RESERVED
        S-->>A: ErreurConflit → HTTP 409
        A-->>UI: Toast « Cet équipement est déjà affecté »
    else statut valide
        S->>DB: INSERT Affectation (statut ACTIVE)
        S->>DB: UPDATE Equipement (statut ASSIGNED, employeId, departementId, localisationId)
        S->>DB: INSERT MouvementStock (type AFFECTATION, statutAvant/Après)
        S->>DB: INSERT JournalAudit (action ASSIGN, valeurs avant/après)
        S->>DB: INSERT Notification (destinataire : manager IT)
        S->>DB: COMMIT
        S-->>A: succès
        A-->>UI: revalidatePath + Toast succès
    end
```

**Les points non négociables de ce flux :**

- Le verrou `SELECT … FOR UPDATE` empêche deux techniciens d'affecter le même équipement en même temps. Sans lui, à deux clics simultanés, l'équipement se retrouve avec deux affectations actives.
- Les 5 écritures sont dans **une seule transaction**. Si l'audit échoue, l'affectation est annulée — jamais d'opération non tracée (règles 5 et 6).
- L'équipement hérite du département et de la localisation de l'employé, sauf saisie contraire.

### 6.2 Retour, transfert, remplacement

| Opération | Effet sur `Affectation` | Effet sur `Equipement` | Mouvement généré |
|---|---|---|---|
| **Retour** | ACTIVE → RETURNED, `dateRetour`, `etatAuRetour` | `statut` = AVAILABLE (ou MAINTENANCE / DAMAGED selon l'état constaté), `employeId` = null, `localisationId` = stock de retour | `RETOUR_AFFECTATION` |
| **Transfert (employé → employé)** | Clôture la 1ʳᵉ (REPLACED), ouvre une nouvelle ACTIVE | `employeId` mis à jour | `AFFECTATION` |
| **Transfert (localisation)** | inchangée | `localisationId` | `TRANSFERT` (source + destination) |
| **Remplacement** | Ancienne → RETURNED avec motif, nouvelle sur le nouvel équipement | 2 équipements mis à jour | 2 mouvements liés |
| **Perte déclarée** | ACTIVE → LOST | `statut` = LOST | `SORTIE` + notification priorité haute |

Un retour avec `etatAuRetour = DEFECTUEUX` **propose automatiquement** l'ouverture d'un ticket de maintenance : c'est proposé, jamais imposé silencieusement.

### 6.3 Entrée et sortie de stock

```mermaid
flowchart TD
    A[Réception fournisseur] --> B{Type d'article ?}
    B -->|Équipement sérialisé| C[Créer N Equipements<br/>numéro d'inventaire + QR auto]
    B -->|Consommable| D[Incrémenter NiveauStock<br/>article x localisation]
    C --> E[MouvementStock ENTREE<br/>quantité 1 par équipement]
    D --> E
    E --> F[JournalAudit CREATE]
    F --> G{Seuil d'alerte franchi ?}
    G -->|Oui| H[Notification stock faible levée]
    G -->|Non| I[Fin]

    J[Sortie / consommation] --> K{Stock suffisant ?}
    K -->|Non| L[Erreur 409 : stock insuffisant<br/>opération refusée]
    K -->|Oui| M[UPDATE quantite = quantite - n<br/>transaction sérialisée]
    M --> N[MouvementStock SORTIE]
    N --> O{Quantité sous le seuil ?}
    O -->|Oui| P[Notification stock faible]
    O -->|Non| I
```

**Inventaire physique.** Un `Inventaire` est ouvert sur une localisation, l'application génère les `LigneInventaire` attendues (quantité théorique figée à l'ouverture), l'opérateur saisit ou scanne les quantités réelles, l'écart est calculé, puis la **clôture génère automatiquement les mouvements d'AJUSTEMENT** correspondants. Un inventaire clôturé n'est plus modifiable.

### 6.4 Maintenance

```mermaid
stateDiagram-v2
    [*] --> OPEN : Ouverture du ticket<br/>Équipement → MAINTENANCE
    OPEN --> IN_PROGRESS : Technicien assigné
    IN_PROGRESS --> WAITING_PART : Pièce commandée
    WAITING_PART --> IN_PROGRESS : Pièce reçue
    IN_PROGRESS --> COMPLETED : Réparé
    OPEN --> CANCELLED : Annulé
    IN_PROGRESS --> CANCELLED : Annulé
    COMPLETED --> [*] : Retour au statut précédent<br/>ou AVAILABLE / DISPOSED
    CANCELLED --> [*] : Retour au statut précédent
```

À l'ouverture, l'application mémorise le statut précédent de l'équipement et **pré-remplit `sousGarantie`** en comparant la date du jour à `dateFinGarantie`. À la clôture, elle propose trois issues : remise en service (retour au statut d'avant), mise au rebut (`DISPOSED`), ou déclaration irréparable (`DAMAGED`). Le coût alimente le rapport « coût de possession » par équipement.

### 6.5 Offboarding — départ d'un employé

C'est le flux le plus sensible : c'est là qu'un parc informatique perd du matériel.

```mermaid
flowchart TD
    A[RH ou IT Manager déclare le départ] --> B[Création ProcessusDepart<br/>statut EN_COURS]
    B --> C[Génération automatique d'une LigneProcessusDepart<br/>par équipement et licence détenus]
    C --> D[Écran de checklist]
    D --> E{Décision par ligne}
    E -->|Restitué| F[Retour → AVAILABLE<br/>+ état constaté]
    E -->|Manquant| G[Statut LOST<br/>+ notification priorité CRITICAL]
    E -->|Défectueux| H[Ticket maintenance ouvert]
    E -->|Transféré| I[Nouvelle affectation<br/>vers un autre employé]
    F --> J{Toutes les lignes traitées ?}
    G --> J
    H --> J
    I --> J
    J -->|Non| D
    J -->|Oui| K[Clôture : ProcessusDepart TERMINE<br/>Employe statut PARTI]
    K --> L[Révocation des licences nominatives]
    L --> M[Désactivation du compte User lié]
    M --> N[Génération PDF de décharge de sortie]
```

**Verrou volontaire :** tant qu'une ligne reste non traitée, l'employé **ne peut pas** passer au statut PARTI. L'application refuse la clôture et affiche ce qui manque. C'est exactement le genre de contrainte qu'on regrette de ne pas avoir mise quand on découvre six mois plus tard que trois portables ont disparu avec des départs.

### 6.6 QR code — génération et scan

```mermaid
sequenceDiagram
    actor U as Technicien (mobile)
    participant S as Page /scan
    participant API as GET /api/scan/[jeton]
    participant DB as PostgreSQL

    Note over DB: À la création de l'équipement :<br/>codeQr = jeton aléatoire 32 car.
    U->>S: Ouvre le scanner (caméra)
    S->>S: html5-qrcode lit l'URL
    S->>API: /api/scan/{jeton}
    API->>API: Session valide ?
    alt Non authentifié
        API-->>S: 401 → redirection connexion<br/>(retour automatique après login)
    else Authentifié
        API->>DB: SELECT equipement WHERE codeQr = jeton
        API->>API: Filtre selon le rôle
        API-->>S: Fiche résumée
        S-->>U: N° inventaire, catégorie, marque/modèle,<br/>statut, détenteur, localisation + actions rapides
    end
```

L'URL encodée est `https://<urlPublique>/e/<jeton>`. **Le jeton n'est pas l'UUID de l'équipement** : un QR code est physiquement visible par n'importe qui (visiteur, prestataire) et photographiable. Un jeton dédié permet de le régénérer si une étiquette est compromise, sans toucher à l'identifiant interne.

Impression : étiquette unitaire, planche A4 (Avery 3×8), ou impression en masse depuis une sélection de la liste — le tout en PDF côté serveur.

### 6.7 Import Excel / CSV — 6 étapes, aucune écriture avant confirmation

```mermaid
flowchart LR
    A[1. Dépôt du fichier] --> B[2. Analyse<br/>type MIME + magic bytes<br/>taille max 10 Mo]
    B --> C[3. Correspondance des colonnes<br/>proposée puis ajustable]
    C --> D[4. Validation Zod ligne à ligne<br/>+ contrôle des doublons en base]
    D --> E[5. Aperçu : N lignes valides,<br/>M en erreur avec motif et n° de ligne]
    E --> F{Confirmation ?}
    F -->|Non| G[Abandon, aucune écriture]
    F -->|Oui| H[6. Import transactionnel<br/>tout ou rien]
    H --> I[JournalAudit IMPORT<br/>+ rapport d'import téléchargeable]
```

Les lignes en erreur sont exportables dans un fichier corrigeable, à redéposer. Le rapport d'erreurs est explicite : `Ligne 47 — colonne « Date d'achat » : « 32/13/2025 » n'est pas une date valide`.

---

## 7. Architecture de sécurité

### 7.1 Authentification

| Élément | Mise en œuvre |
|---|---|
| Bibliothèque | Auth.js v5, `CredentialsProvider` + adapter Prisma |
| Stratégie de session | **Sessions en base** (pas JWT) — une révocation est immédiate ; avec un JWT, un compte désactivé reste valide jusqu'à expiration |
| Hashage | argon2id — `memoryCost 19456 KiB`, `timeCost 2`, `parallelism 1` (paramètres OWASP 2024) |
| Cookie | `httpOnly`, `secure` en production, `sameSite: lax`, durée 8 h, prolongation glissante |
| Politique de mot de passe | 12 caractères minimum, contrôle contre une liste de mots de passe courants, changement obligatoire à la première connexion |
| Anti-énumération | Message identique que l'email existe ou non ; temps de réponse constant |
| Verrouillage | 5 échecs → blocage progressif du compte (1, 5, 15 min), journalisé en `LOGIN_FAILED` |
| Extension prévue | Entra ID / SAML ajoutables comme provider Auth.js sans refonte |

### 7.2 Les 10 mesures et leur point d'application

| Risque | Mesure | Où |
|---|---|---|
| Injection SQL | Prisma, requêtes paramétrées. `$queryRaw` interdit sauf `$queryRaw` *tagged template* justifié en revue | Couche 4 |
| XSS | React échappe par défaut ; `dangerouslySetInnerHTML` interdit ; CSP stricte avec nonce | Middleware + revue |
| CSRF | Server Actions protégées nativement ; routes API mutatives : vérification `Origin` + jeton | Frontière |
| Escalade de privilèges | `verifierPermission()` en première ligne de service ; jamais de contrôle uniquement en UI | Couche 3 |
| Accès horizontal (voir les données d'un autre) | Filtre de portée pour `EMPLOYEE`, appliqué dans la requête | Couche 3 |
| Force brute | Rate limiting : 5 tentatives / 15 min / IP+email sur la connexion ; 10 imports / h ; 30 exports / h | Frontière |
| Fichiers malveillants | Extension **et** magic bytes vérifiés, taille max, nom assaini, stockage hors racine web, servis par une route authentifiée | Service fichiers |
| Fuite de secrets | `.env` hors dépôt, `.env.example` fourni ; aucune variable sans préfixe `NEXT_PUBLIC_` n'atteint le navigateur ; audit du bundle en CI | Build |
| Clés de licence en clair | AES-256-GCM, clé dans `CLE_CHIFFREMENT` (env), déchiffrement à la demande, permission dédiée `licences.voir_cle`, chaque lecture auditée | Service |
| Absence de traçabilité | Audit dans la même transaction que l'opération ; `MouvementStock` en écriture seule au niveau PostgreSQL | Couche 3 + 5 |

### 7.3 En-têtes HTTP (middleware)

`Content-Security-Policy` (avec nonce, sans `unsafe-inline`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra autorisée uniquement sur `/scan`).

### 7.4 Variables d'environnement (`.env.example`)

```bash
DATABASE_URL="postgresql://itstock:motdepasse@localhost:5432/itstock?schema=public"
AUTH_SECRET=""                 # openssl rand -base64 32
AUTH_URL="http://localhost:3000"
CLE_CHIFFREMENT=""             # 32 octets base64 — clés de licence
URL_PUBLIQUE="http://localhost:3000"
ADMIN_EMAIL="admin@entreprise.com"
ADMIN_MOT_DE_PASSE=""          # changé à la première connexion
AUTORISER_SEED_DEMO="false"
CHEMIN_STOCKAGE="./stockage"
TAILLE_MAX_FICHIER_MO="10"
```

**Aucun secret réel dans le dépôt** (§25). `.env` est dans `.gitignore` dès le premier commit.

---

## 8. Conventions API

### 8.1 Format de réponse unifié

```jsonc
// Succès
{ "succes": true, "donnees": { }, "meta": { "page": 1, "parPage": 25, "total": 342 } }

// Erreur
{ "succes": false, "erreur": { "code": "EQUIPEMENT_DEJA_AFFECTE",
  "message": "Cet équipement est déjà affecté à Ahmed Benali.",
  "champs": { "employeId": "Employé introuvable" } } }
```

Le `message` est **rédigé en français, destiné à l'utilisateur final** et affichable tel quel dans un toast. Le `code` est stable et destiné au frontend.

### 8.2 Codes HTTP

| Code | Cas |
|---|---|
| 200 | Lecture ou mise à jour réussie |
| 201 | Création |
| 400 | Requête malformée |
| 401 | Non authentifié |
| 403 | Authentifié mais permission insuffisante |
| 404 | Ressource inexistante *ou* hors de la portée de l'utilisateur |
| 409 | Conflit métier (équipement déjà affecté, stock insuffisant, numéro de série existant) |
| 422 | Échec de validation Zod (détail par champ) |
| 429 | Rate limit atteint |
| 500 | Erreur serveur — message générique côté client, trace complète côté serveur |

### 8.3 Routes (nommage français — **à confirmer**, cf. §0.2 B)

```text
AUTH        /api/auth/[...nextauth]
PARC        /api/equipements
            /api/equipements/[id]
            /api/equipements/[id]/affecter
            /api/equipements/[id]/retour
            /api/equipements/[id]/transfert
            /api/equipements/[id]/qrcode
STOCK       /api/mouvements-stock
            /api/articles-stock
            /api/inventaires
PERSONNES   /api/employes
            /api/departs
            /api/departs/[id]/lignes/[ligneId]
REFERENTIEL /api/departements
            /api/localisations
            /api/categories
            /api/marques  ·  /api/modeles
            /api/fournisseurs
SUPPORT     /api/maintenances
LOGICIELS   /api/logiciels
            /api/licences
ADMIN       /api/utilisateurs
            /api/roles
            /api/parametres
            /api/journal-audit
OUTILS      /api/recherche
            /api/rapports/[type]
            /api/notifications
            /api/import  ·  /api/export
            /api/scan/[jeton]
```

Toutes les listes sont paginées côté serveur (`?page=&parPage=&tri=&ordre=&recherche=&filtres…`), plafonnées à 100 éléments par page.

---

## 9. Performance

| Levier | Mise en œuvre |
|---|---|
| Pagination serveur | Systématique, jamais de `findMany()` sans `take` |
| Recherche | Index GIN `pg_trgm` sur les colonnes texte + recherche full-text PostgreSQL, **pas** de `contains` sur 50 000 lignes |
| N+1 | `include`/`select` explicites, jamais de requête dans une boucle. Vérification par les logs Prisma en développement |
| Index | `(statut, categorieId)`, `(employeId)`, `(localisationId)`, `(dateFinGarantie)`, `(dateExpiration)`, `(creeLe)` sur l'audit, `(articleStockId, localisationId)` unique |
| Agrégats du tableau de bord | Requêtes `groupBy` uniques (pas 8 `count()` séparés) + cache Next.js 60 s |
| Chargement | Lazy loading des graphiques et du scanner QR ; `Suspense` avec squelettes |
| Charge cible | 50 000 équipements, 5 000 employés, 500 000 mouvements — dimensionnement des index prévu pour cet ordre de grandeur |

---

## 10. Ce que couvre la Phase 1, et la suite

### Livré dans cette phase

Architecture applicative en 5 couches · stack figée avec versions · arborescence complète des dossiers · modèle de données à 31 tables avec champs, relations, index et contraintes · matrice RBAC détaillée pour 6 rôles · 7 flux métier documentés · architecture de sécurité en 10 mesures · conventions API et codes HTTP · stratégie de performance.

### Non traité volontairement à ce stade

Le code (aucun fichier applicatif n'a été écrit), les maquettes visuelles précises, la stratégie de sauvegarde PostgreSQL et le plan de reprise (Phase 7), l'intégration Active Directory (hors périmètre initial).

### Phases suivantes

| Phase | Contenu | Livrable |
|---|---|---|
| **2** | `schema.prisma` complet, migration initiale, seed en 9 fichiers, vérification de cohérence du modèle | Base fonctionnelle et peuplée |
| **3** | Auth.js, RBAC, services métier, Server Actions, routes API, audit, validations Zod | Backend testable |
| **4** | Layout, sidebar, tableau de bord, écrans Équipements / Employés / Stock / Maintenance / Fournisseurs / Licences / Rapports / Paramètres | Application utilisable |
| **5** | QR codes et impression, import/export, notifications, recherche avancée, rapports PDF | Fonctionnalités avancées |
| **6** | Tests Vitest et Playwright, revue des permissions, revue de sécurité | Application vérifiée |
| **7** | Dockerfile, docker-compose, build production, migrations, README, déploiement | Prêt pour la production |

---

## 11. Ce que j'attends de vous pour lancer la Phase 2

Trois réponses suffisent :

1. **Routes API en français ou en anglais ?** (seul point de contradiction dans le cahier des charges)
2. **Le modèle de données vous convient-il ?** En particulier : la séparation `Equipement` / `ArticleStock`, la dénormalisation de `Equipement.employeId`, et l'ajout de `ProcessusDepart`.
3. **La matrice de permissions correspond-elle à votre organisation réelle ?** C'est le point le plus coûteux à changer plus tard — un rôle mal calibré se propage dans chaque service.

Un simple « ok, phase 2 » suffit si tout convient : j'enchaîne alors sur le schéma Prisma complet, les migrations et le seed.
