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

// ── Chantier 3.5 (P2.7) — source de vérité unique des types de mouvements ──
// Aucun service ne doit inventer une chaîne hors liste : les libellés
// validés à la frontière HTTP et écrits en base proviennent tous d'ici.
export const TYPES_MOUVEMENT = {
  ENTREE_ACHAT: "Entrée Achat",
  SORTIE_AFFECTATION: "Sortie Affectation",
  RETOUR_STOCK: "Retour Stock",
  ENVOI_MAINTENANCE: "Envoi Maintenance",
  ANNULATION_AFFECTATION: "Annulation Affectation",
  MISE_AU_REBUT: "Mise au Rebut",
  AJUSTEMENT_INVENTAIRE: "Ajustement Inventaire"
} as const;

export type TypeMouvement = (typeof TYPES_MOUVEMENT)[keyof typeof TYPES_MOUVEMENT];

// ── Statuts de fiche d'affectation (contrainte CHECK côté base) ─────────
export const STATUTS_AFFECTATION = {
  ACTIVE: "Active",
  RESTITUEE: "Restitué",
  ANNULEE: "Annulée"
} as const;

// ── Chantier 3.5 (P2.9) — état matériel STRUCTURÉ ────────────────────────
// Liste fermée validée Zod à la frontière HTTP : l'état constaté pilote les
// transitions critiques (ex. maintenance forcée). Le commentaire libre
// (diagnostic technique) reste possible mais ne décide plus rien.
export const ETATS_MATERIEL_CONSTATES = {
  BON_ETAT: "Bon état",
  ENDOMMAGE: "Endommagé",
  MAINTENANCE_REQUISE: "Maintenance requise",
  HORS_SERVICE: "Hors service"
} as const;

export type EtatMaterielConstate =
  (typeof ETATS_MATERIEL_CONSTATES)[keyof typeof ETATS_MATERIEL_CONSTATES];

export const LISTE_ETATS_CONSTATES = Object.values(ETATS_MATERIEL_CONSTATES);

/** États qui interdisent la remise en disponibilité automatique. */
const ETATS_DEGRADES: ReadonlySet<string> = new Set([
  ETATS_MATERIEL_CONSTATES.ENDOMMAGE,
  ETATS_MATERIEL_CONSTATES.MAINTENANCE_REQUISE,
  ETATS_MATERIEL_CONSTATES.HORS_SERVICE
]);

export function estEtatDegrade(etat: string): boolean {
  return ETATS_DEGRADES.has(etat);
}
