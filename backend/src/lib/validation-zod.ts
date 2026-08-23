import { z } from "zod";

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
