// Erreur métier : transportée jusqu'à la couche route qui la convertit en HTTP.
// Chantier 3 : chaque erreur métier porte un code stable et lisible
// (STOCK_NOT_AVAILABLE, INVALID_STATUS_TRANSITION…) exposé au frontend dans
// la réponse JSON — le message reste en français pour l'utilisateur final.
export class ErreurMetier extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}

export const introuvable = (message: string) => new ErreurMetier(404, message);
export const requeteInvalide = (message: string) => new ErreurMetier(400, message);
export const conflit = (message: string, code?: string) => new ErreurMetier(409, message, code);

// ── Codes normalisés du chantier 3 ───────────────────────────────────────

/** Stock insuffisant pour honorer une sortie ou une affectation. */
export const stockIndisponible = (message: string) =>
  new ErreurMetier(409, message, "STOCK_NOT_AVAILABLE");

/** Matériel unitaire déjà porté par une affectation active. */
export const dejaAffecte = (message: string) =>
  new ErreurMetier(409, message, "ITEM_ALREADY_ASSIGNED");

/** Deuxième restitution d'une même fiche (double clic ou retransmission). */
export const retourDejaEffectue = (message: string) =>
  new ErreurMetier(409, message, "ASSIGNMENT_ALREADY_RETURNED");

/** Restitution de plus d'unités qu'il n'y en a d'affectées — chantier 3.5 :
 *  l'écrêtage silencieux du surplus disparaît. */
export const retourExcedent = (message: string) =>
  new ErreurMetier(409, message, "RETURN_QTY_EXCEEDS_ALLOCATED");

/** Changement de statut hors machine à états. */
export const transitionInvalide = (message: string) =>
  new ErreurMetier(409, message, "INVALID_STATUS_TRANSITION");

/** Opération sur un compte désactivé. */
export const utilisateurInactif = (message: string) =>
  new ErreurMetier(409, message, "USER_INACTIVE");

/** Permission refusée (redondant avec exigerPermission, disponible aux services). */
export const interdit = (message: string) =>
  new ErreurMetier(403, message, "FORBIDDEN");
