import { z } from "zod";

// Priorité 2 du chantier « corrections restantes » — pagination serveur.
// Toutes les listes métier renvoient désormais un contrat unique :
//   { items: [...], pagination: { page, limite, total, pages } }
// aligné sur celui du journal d'audit (H4). Le tri est TOUJOURS déterministe
// (creeLe desc puis id desc) : deux requêtes successives renvoient la même
// page, même en présence d'horodatages identiques. La limite est plafonnée
// à 200 lignes : aucune liste ne se télécharge plus « en entier » par défaut.

export const LIMITE_PAR_DEFAUT = 50;
export const LIMITE_MAXIMALE = 200;

export const schemaPagination = z.object({
  page: z.coerce
    .number({ message: "Le numéro de page doit être un nombre." })
    .int("Le numéro de page doit être un entier.")
    .min(1, "Le numéro de page doit être au moins 1.")
    .default(1),
  limite: z.coerce
    .number({ message: "La limite doit être un nombre." })
    .int("La limite doit être un entier.")
    .min(1, "La limite doit être au moins 1.")
    .max(LIMITE_MAXIMALE, `La limite ne peut pas dépasser ${LIMITE_MAXIMALE} entrées par page.`)
    .default(LIMITE_PAR_DEFAUT)
});

export type ParametresPagination = z.infer<typeof schemaPagination>;

/** Bornage défensif des paramètres (les services acceptent aussi des appels
 *  internes avec des objets partiels) + offset SQL prêt à l'emploi. */
export function bornerPagination(parametres?: Partial<ParametresPagination>) {
  const page = Math.max(1, Math.floor(parametres?.page ?? 1));
  const limite = Math.min(
    LIMITE_MAXIMALE,
    Math.max(1, Math.floor(parametres?.limite ?? LIMITE_PAR_DEFAUT))
  );
  return { page, limite, skip: (page - 1) * limite, take: limite };
}

/** Métadonnées de page — clé `pages` (contrat posé par H4 sur /api/audit). */
export function metaPagination(page: number, limite: number, total: number) {
  return { page, limite, total, pages: Math.max(1, Math.ceil(total / limite)) };
}
