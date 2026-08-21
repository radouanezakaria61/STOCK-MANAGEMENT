// Erreur métier : transportée jusqu'à la couche route qui la convertit en HTTP.
export class ErreurMetier extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}

export const introuvable = (message: string) => new ErreurMetier(404, message);
export const requeteInvalide = (message: string) => new ErreurMetier(400, message);
export const conflit = (message: string) => new ErreurMetier(409, message);
