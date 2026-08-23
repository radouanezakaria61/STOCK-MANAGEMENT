import { z } from "zod";
import {
  STATUTS_MATERIEL,
  TYPES_MOUVEMENT,
  ETATS_MATERIEL_CONSTATES
} from "./machine-etats.js";

// Messages de validation en français, destinés à l'utilisateur final
// (AGENTS.md : les messages d'erreur sont en français). Zod ≥ 4 configure
// ses messages globalement ; les compléments métier restent explicites.
z.config(z.locales.fr());

export const schemaConnexion = z.object({
  identifiant: z
    .string({ message: "L'identifiant est obligatoire." })
    .trim()
    .min(1, "L'identifiant est obligatoire.")
    .max(190),
  motDePasse: z
    .string({ message: "Le mot de passe est obligatoire." })
    .min(1, "Le mot de passe est obligatoire.")
    .max(200)
});

export const schemaNouveauMotDePasse = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
  .max(200, "Le mot de passe ne peut pas dépasser 200 caractères.")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une lettre minuscule.")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une lettre majuscule.")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.");

export const schemaChangementMotDePasse = z.object({
  motDePasseActuel: z.string().min(1, "Le mot de passe actuel est obligatoire.").max(200),
  nouveauMotDePasse: schemaNouveauMotDePasse
});

// ── H4 (Phase 1) — filtres de consultation du journal d'audit ─────────
// Requête GET : tout arrive en chaîne ; les nombres sont convertis ici.
// Limite serveur plafonnée à 200 lignes : le journal est volumineux par
// nature et ne se télécharge JAMAIS en entier (H2 traitera le curseur).
export const schemaFiltresJournalAudit = z.object({
  action: z.string().trim().max(60).optional(),
  utilisateurId: z.string().trim().max(64).optional(),
  identifiant: z.string().trim().max(190).optional(),
  entite: z.string().trim().max(60).optional(),
  entiteId: z.string().trim().max(64).optional(),
  dateDebut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de début doit être au format AAAA-MM-JJ.")
    .optional(),
  dateFin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de fin doit être au format AAAA-MM-JJ.")
    .optional(),
  page: z.coerce.number().int().min(1, "Le numéro de page doit être au moins 1.").default(1),
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(200, "La limite ne peut pas dépasser 200 entrées par page.")
    .default(50)
});

// ══════════════════════════════════════════════════════════════════════
// M6 (Phase 1) — validation systématique des endpoints mutateurs.
//
// Deux familles de schémas :
//   • `.strict()` pour les payloads dont la forme est entièrement connue :
//     tout champ supplémentaire est REFUSÉ (422) — l'injection de masse
//     devient impossible par construction ;
//   • mode « strip » (défaut Zod) pour les gros formulaires hérités
//     (fiche d'affectation, restitution) qui envoient des champs d'affichage
//     historiques jamais consommés par les services : les champs inconnus
//     sont SILENCIEUSEMENT RETIRÉS avant d'atteindre le service, qui de toute
//     façon ne déstructure que ses champs déclarés.
// Les listes fermées proviennent de lib/machine-etats.ts et des types du
// domaine — aucune chaîne magique n'est dupliquée ici.
// ══════════════════════════════════════════════════════════════════════

// ── Aides locales ─────────────────────────────────────────────────────

const chaineOpt = (max: number) => z.string().trim().max(max).optional();
const texteLibreOpt = z.string().trim().max(2000).optional();
const dateSeuleOpt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être au format AAAA-MM-JJ.")
  .optional();
const emailOpt = z
  .string()
  .trim()
  .max(190)
  .regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Adresse e-mail invalide.")
  .optional();
const quantiteEntiere = z.coerce
  .number()
  .int("La quantité doit être un nombre entier.")
  .min(0, "La quantité ne peut pas être négative.")
  .max(1000000, "La quantité dépasse la limite autorisée.");

/** Montant accepté en nombre ou en saisie textuelle historique
 *  (« 1250 », « 1250,50 », « 1 250.00 MAD ») — même grammaire que le service
 *  stock (versMontant) ; la précision reste côté Decimal en base. */
const montantPositif = z.preprocess(
  (valeur) => {
    if (typeof valeur === "string") {
      const nettoyee = valeur
        .trim()
        .replace(/[\s']/g, "")
        .replace(",", ".")
        .replace(/MAD/i, "");
      return nettoyee === "" ? 0 : nettoyee;
    }
    return valeur;
  },
  z.coerce
    .number({ message: "Le montant saisi n'est pas un nombre valide." })
    .min(0, "Le montant ne peut pas être négatif.")
    .max(1000000000, "Le montant dépasse la limite autorisée.")
);

// ── Listes fermées partagées ──────────────────────────────────────────

/** Catégories métier du parc IT (référentiel affiché au stock IT).
 *  Liste alignée sur `StockCategory` du frontend et le seed de démonstration ;
 *  elle deviendra une table de référentiel au chantier 7 si besoin. */
export const CATEGORIES_MATERIEL = [
  "Laptops & Portables",
  "Postes Fixes & Écrans",
  "Serveurs & Stockage",
  "Réseau & Sécurité",
  "Périphériques & Accessoires",
  "Consommables & Pièces",
  "Licences & Logiciels"
] as const;

/** Statuts pilotables via HTTP : « Supprimé » n'est PAS saisissable — il est
 *  posé uniquement par le soft delete applicatif (règle 6 AGENTS.md). */
const STATUTS_SAISISABLES = [
  STATUTS_MATERIEL.DISPONIBLE,
  STATUTS_MATERIEL.AFFECTE,
  STATUTS_MATERIEL.MAINTENANCE,
  STATUTS_MATERIEL.REFORME
] as const;

/** Mouvements SAISIS manuellement (cf. stock.service.ts) : les types produits
 *  par les flux métier (Envoi Maintenance, Annulation Affectation) restent
 *  interdits à la saisie directe. */
export const TYPES_MOUVEMENT_MANUELS = [
  TYPES_MOUVEMENT.SORTIE_AFFECTATION,
  TYPES_MOUVEMENT.RETOUR_STOCK,
  TYPES_MOUVEMENT.ENTREE_ACHAT,
  TYPES_MOUVEMENT.MISE_AU_REBUT,
  TYPES_MOUVEMENT.AJUSTEMENT_INVENTAIRE
] as const;

const ACTIONS_RESTITUTION = [
  "Remise en stock disponible",
  "Envoi en maintenance / SAV",
  "Mise au rebut"
] as const;

// ── Stock : articles & mouvements ─────────────────────────────────────

const baseArticle = {
  name: z.string().trim().min(1, "Le nom de l'article est obligatoire.").max(160),
  category: z.enum(CATEGORIES_MATERIEL, { message: "Catégorie de matériel inconnue." }),
  brand: chaineOpt(120),
  model: chaineOpt(160),
  serialNumber: chaineOpt(160),
  quantity: quantiteEntiere.optional(),
  minThreshold: quantiteEntiere.optional(),
  unitPriceMAD: montantPositif.optional(),
  location: chaineOpt(200),
  status: z.enum(STATUTS_SAISISABLES).optional(),
  fournisseur: chaineOpt(200),
  notes: texteLibreOpt,
  performedBy: chaineOpt(160)
};

export const schemaCreationArticle = z.object(baseArticle).strict();

export const schemaModificationArticle = z
  .object({
    ...baseArticle,
    name: baseArticle.name.optional(),
    category: baseArticle.category.optional(),
    warrantyExpiry: dateSeuleOpt.nullable()
  })
  .strict();

export const schemaMouvementStock = z
  .object({
    type: z.enum(TYPES_MOUVEMENT_MANUELS, {
      message: `Type de mouvement inconnu. Types saisisables : ${TYPES_MOUVEMENT_MANUELS.join(", ")}.`
    }),
    quantity: z.coerce
      .number()
      .int("La quantité doit être un nombre entier.")
      .min(1, "La quantité mouvementée doit être au moins 1.")
      .max(1000000, "La quantité dépasse la limite autorisée.")
      .optional(),
    performedBy: chaineOpt(160),
    recipient: chaineOpt(160),
    department: chaineOpt(120),
    notes: texteLibreOpt
  })
  .strict();

export const schemaRechercheStock = z.object({
  q: chaineOpt(120),
  category: chaineOpt(80),
  availableOnly: z.string().optional()
});

// ── Affectations (formulaires hérités : mode strip documenté ci-dessus) ─

export const schemaLigneAffectation = z.object({
  stockItemId: chaineOpt(64),
  assetTag: chaineOpt(64),
  serialNumber: chaineOpt(160),
  quantity: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000, "La quantité affectée dépasse la limite autorisée.")
    .optional(),
  condition: z.enum(["Neuf / Excellent état", "Très bon état", "Bon état"]).optional(),
  accessories: z.array(z.string().trim().max(120)).max(20, "Trop d'accessoires listés.").optional()
});

export const schemaCreationAffectation = z.object({
  templateType: chaineOpt(60),
  formCode: chaineOpt(60),
  beneficiaryName: z.string().trim().min(1, "Le nom du bénéficiaire est obligatoire.").max(160),
  beneficiaryEmail: emailOpt,
  beneficiaryPhone: chaineOpt(40),
  beneficiaryCin: chaineOpt(40),
  beneficiaryJobTitle: chaineOpt(160),
  beneficiaryDepartment: z.string().trim().min(1, "Le département du bénéficiaire est obligatoire.").max(160),
  beneficiarySite: chaineOpt(160),
  assignedDate: dateSeuleOpt,
  authorizedBy: chaineOpt(160),
  dsiTitle: chaineOpt(160),
  resourceType: chaineOpt(80),
  hasSimCard: z.boolean().optional(),
  simOperator: chaineOpt(40),
  simPhoneNumber: chaineOpt(40),
  simPuk: chaineOpt(20),
  simPin: chaineOpt(10),
  hasSmartphone: z.boolean().optional(),
  deviceBrand: chaineOpt(120),
  deviceImei: chaineOpt(20),
  deviceModel: chaineOpt(160),
  deviceConfiguration: chaineOpt(500),
  operationType: chaineOpt(40),
  restitutionPreviousDevice: chaineOpt(300),
  restitutedDeviceCondition: chaineOpt(60),
  incidentRemarks: texteLibreOpt,
  items: z.array(schemaLigneAffectation).max(50, "Une fiche ne peut pas porter plus de 50 lignes.").optional(),
  notes: texteLibreOpt,
  reaffecteApresId: chaineOpt(64)
});

export const schemaRetourAffectation = z.object({
  returnDate: dateSeuleOpt,
  cause: chaineOpt(200),
  customCause: chaineOpt(400),
  equipmentCondition: z
    .enum(Object.values(ETATS_MATERIEL_CONSTATES) as [string, ...string[]])
    .optional(),
  accessoriesReturned: z.array(z.string().trim().max(120)).max(20).optional(),
  missingAccessories: z.array(z.string().trim().max(120)).max(20).optional(),
  dataWiped: z.boolean().optional(),
  bitlockerUnlocked: z.boolean().optional(),
  technicalDiagnosis: texteLibreOpt,
  actionTaken: z.enum(ACTIONS_RESTITUTION).optional(),
  inspectedBy: chaineOpt(160),
  notes: texteLibreOpt
});

// ── Sociétés ──────────────────────────────────────────────────────────

const baseSociete = {
  adresse: chaineOpt(300),
  ville: chaineOpt(120),
  telephone: chaineOpt(40),
  email: emailOpt,
  identifiantLegal: chaineOpt(80),
  notes: texteLibreOpt
};

export const schemaCreationSociete = z
  .object({
    nom: z.string().trim().min(1, "Le nom de la société est obligatoire.").max(160),
    codeCourt: z
      .string()
      .trim()
      .min(2, "Le code court doit contenir au moins 2 caractères.")
      .max(24, "Le code court ne peut pas dépasser 24 caractères."),
    ...baseSociete
  })
  .strict();

export const schemaModificationSociete = z
  .object({
    nom: z.string().trim().min(1).max(160).optional(),
    codeCourt: z.string().trim().min(2).max(24).optional(),
    ...baseSociete
  })
  .strict();

export const schemaActivationSociete = z
  .object({ actif: z.boolean({ message: "L'état « actif » doit être vrai ou faux." }) })
  .strict();

// ── Utilisateurs ──────────────────────────────────────────────────────

const baseUtilisateur = {
  username: z.string().trim().min(3, "L'identifiant de connexion doit contenir au moins 3 caractères.").max(50),
  name: z.string().trim().min(1, "Le nom complet est obligatoire.").max(160),
  email: z
    .string()
    .trim()
    .max(190)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Adresse e-mail invalide."),
  phone: chaineOpt(40),
  department: z.string().trim().min(1, "Le département est obligatoire.").max(120),
  jobTitle: chaineOpt(160),
  // Le code de rôle est résolu en base (resoudreRoleId) : un code inconnu
  // produit là-bas une erreur 400 listant les rôles acceptés — on ne fige
  // pas ici une seconde liste susceptible de diverger du seed.
  role: z.string().trim().min(2).max(40),
  status: z.enum(["Actif", "Inactif"], { message: "Le statut doit être « Actif » ou « Inactif »." }).optional(),
  societeId: z.string().trim().max(64).nullable().optional()
};

export const schemaCreationUtilisateur = z
  .object({
    ...baseUtilisateur,
    motDePasseTemporaire: z
      .string()
      .min(8, "Le mot de passe temporaire doit contenir au moins 8 caractères.")
      .max(200)
  })
  .strict();

export const schemaModificationUtilisateur = z.object(baseUtilisateur).strict();

export const schemaChangementStatutUtilisateur = z
  .object({ status: z.enum(["Actif", "Inactif"], { message: "Le statut doit être « Actif » ou « Inactif »." }) })
  .strict();
