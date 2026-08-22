import { ErreurMetier } from "./erreurs.js";

// Machine à états des matériels (chantier 3, point 15).
// Les libellés sont ceux de l'application existante (chaînes historiques) ;
// seules les transitions ci-dessous sont autorisées — toute autre combinaison
// lève INVALID_STATUS_TRANSITION. « Supprimé » est le marqueur du soft delete
// : il n'a pas de sortie.
//
//   En Stock ──→ Affecté ──→ En Stock / En Maintenance / Rebut
//      │                        (restitution selon état constaté)
//      ├──→ En Maintenance ──→ En Stock (prêt) / Rebut
//      └──→ Rebut / Fin de vie (terminal)

export const STATUTS_MATERIEL = {
  DISPONIBLE: "En Stock",
  AFFECTE: "Affecté",
  MAINTENANCE: "En Maintenance",
  REFORME: "Rebut / Fin de vie",
  SUPPRIME: "Supprimé"
} as const;

export type StatutMateriel = (typeof STATUTS_MATERIEL)[keyof typeof STATUTS_MATERIEL];

const TRANSITIONS_AUTORISEES: Record<string, readonly string[]> = {
  [STATUTS_MATERIEL.DISPONIBLE]: [
    STATUTS_MATERIEL.AFFECTE,
    STATUTS_MATERIEL.MAINTENANCE,
    STATUTS_MATERIEL.REFORME
  ],
  [STATUTS_MATERIEL.AFFECTE]: [
    STATUTS_MATERIEL.DISPONIBLE,
    STATUTS_MATERIEL.MAINTENANCE,
    STATUTS_MATERIEL.REFORME
  ],
  [STATUTS_MATERIEL.MAINTENANCE]: [
    STATUTS_MATERIEL.DISPONIBLE,
    STATUTS_MATERIEL.REFORME
  ],
  // Réformer un matériel réformé ou supprimé n'existe pas : une erreur se
  // corrige par un mouvement inverse documenté, jamais par un UPDATE (règle 3).
  [STATUTS_MATERIEL.REFORME]: [],
  [STATUTS_MATERIEL.SUPPRIME]: []
};

/** Vérifie la transition et renvoie le statut cible ; lève INVALID_STATUS_TRANSITION sinon. */
export function exigerTransition(actuel: string, cible: string): string {
  if (actuel === cible) return cible;
  const autorisees = TRANSITIONS_AUTORISEES[actuel];
  if (!autorisees || !autorisees.includes(cible)) {
    throw new ErreurMetier(
      409,
      `Transition de statut impossible : « ${actuel} » → « ${cible} ». ` +
        `Transitions autorisées depuis « ${actuel} » : ${
          autorisees && autorisees.length > 0 ? autorisees.join(", ") : "aucune (état terminal)"
        }.`,
      "INVALID_STATUS_TRANSITION"
    );
  }
  return cible;
}
