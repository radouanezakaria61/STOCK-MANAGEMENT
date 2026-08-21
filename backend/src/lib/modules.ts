import dotenv from "dotenv";

dotenv.config();

// Périmètre gelé (02-plan-convergence.md §1.1) : les modules achats
// (achats, appels-offres, ia) restent codés mais ne sont plus montés
// tant qu'ils ne figurent pas dans MODULES_ACTIFS.
const ACTIFS = new Set(
  (process.env.MODULES_ACTIFS ?? "dashboard,fournisseurs,utilisateurs,stock,affectations")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
);

export function estActif(module: string): boolean {
  return ACTIFS.has(module);
}
