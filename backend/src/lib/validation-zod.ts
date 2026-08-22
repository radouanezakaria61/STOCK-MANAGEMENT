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
