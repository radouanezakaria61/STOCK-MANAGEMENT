import type { NextFunction, Request, Response } from "express";
import { ErreurMetier } from "../lib/erreurs.js";
import { lireContexteSession, adresseIpDe, type ContexteSession } from "../lib/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    contexteAuth?: ContexteSession;
  }
}

// Charge la session depuis le cookie et l'attache à la requête.
// Ne bloque jamais : c'est exigerAuth qui décide ensuite.
export async function chargerSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.contexteAuth = (await lireContexteSession(req)) ?? undefined;
    next();
  } catch (erreur) {
    next(erreur);
  }
}

export function exigerAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.contexteAuth) {
    next(new ErreurMetier(401, "Authentification requise. Veuillez vous connecter."));
    return;
  }
  next();
}

// AGENTS.md règle 1 : contrôle côté serveur sur chaque route mutante.
// Masquer un bouton dans l'interface n'est pas un contrôle d'accès.
export function exigerPermission(code: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.contexteAuth) {
      next(new ErreurMetier(401, "Authentification requise. Veuillez vous connecter."));
      return;
    }
    if (!req.contexteAuth.permissions.has(code)) {
      next(
        new ErreurMetier(
          403,
          `Accès refusé : la permission « ${code} » est requise pour cette opération.`
        )
      );
      return;
    }
    next();
  };
}

// ── Limitation des tentatives de connexion (phases 12-13) ────────────
// 5 échecs en 15 minutes par couple IP + identifiant déclenchent une
// temporisation croissante. Jamais de verrou définitif : cela permettrait
// une négation de service ciblée contre un compte connu.

interface TentativesConnexion {
  echecs: number;
  bloqueJusqua: number;
  fenetreOuverte: number;
}

const FENETRE_MS = 15 * 60_000;
const MAX_ECHECS_AVANT_TEMPORISATION = 5;
const tentatives = new Map<string, TentativesConnexion>();

function purgerTentatives(maintenant: number): void {
  for (const [cle, entree] of tentatives) {
    if (
      maintenant - entree.fenetreOuverte > FENETRE_MS &&
      entree.bloqueJusqua < maintenant
    ) {
      tentatives.delete(cle);
    }
  }
}

export function cleLimiteurConnexion(req: Request, identifiant: string): string {
  return `${adresseIpDe(req) ?? "inconnue"}|${identifiant.trim().toLowerCase()}`;
}

/** Secondes d'attente restantes avant une nouvelle tentative, 0 si autorisée. */
export function verifierLimiteConnexion(cle: string): number {
  const maintenant = Date.now();
  purgerTentatives(maintenant);
  const entree = tentatives.get(cle);
  if (!entree || entree.bloqueJusqua <= maintenant) return 0;
  return Math.ceil((entree.bloqueJusqua - maintenant) / 1000);
}

export function enregistrerEchecConnexion(cle: string): void {
  const maintenant = Date.now();
  const entree = tentatives.get(cle) ?? { echecs: 0, bloqueJusqua: 0, fenetreOuverte: maintenant };
  if (maintenant - entree.fenetreOuverte > FENETRE_MS) {
    entree.echecs = 0;
    entree.fenetreOuverte = maintenant;
  }
  entree.echecs += 1;
  if (entree.echecs >= MAX_ECHECS_AVANT_TEMPORISATION) {
    const palier = Math.min(entree.echecs - MAX_ECHECS_AVANT_TEMPORISATION + 1, 4);
    entree.bloqueJusqua = Math.min(
      maintenant + 30_000 * 2 ** (palier - 1), // 30 s → 1 min → 2 min → 4 min
      maintenant + FENETRE_MS
    );
  }
  tentatives.set(cle, entree);
}

export function reinitialiserConnexion(cle: string): void {
  tentatives.delete(cle);
}

// ── Anti-CSRF léger (réseau interne) ─────────────────────────────────
// Sur une mutation, un en-tête Origin présent doit correspondre soit à une
// origine autorisée (ORIGINES_AUTORISEES), soit à l'origine du serveur lui-
// même (déploiement où le backend sert le SPA). Les clients non navigateurs
// (curl, intégrations internes) n'envoient pas d'Origin et passent.
const ORIGINES_AUTORISEES = (process.env["ORIGINES_AUTORISEES"] ?? "http://localhost:3000")
  .split(",")
  .map((origine) => origine.trim())
  .filter(Boolean);

export function verifierOrigine(req: Request, _res: Response, next: NextFunction): void {
  const methode = req.method.toUpperCase();
  if (methode === "GET" || methode === "HEAD" || methode === "OPTIONS") {
    next();
    return;
  }
  const origine = req.headers.origin;
  if (typeof origine !== "string" || origine.length === 0) {
    next();
    return;
  }
  if (ORIGINES_AUTORISEES.includes(origine)) {
    next();
    return;
  }
  try {
    if (new URL(origine).host === req.headers.host) {
      next();
      return;
    }
  } catch {
    // Origin malformé : traité ci-dessous comme non autorisé.
  }
  next(new ErreurMetier(403, "Origine de la requête non autorisée."));
}
