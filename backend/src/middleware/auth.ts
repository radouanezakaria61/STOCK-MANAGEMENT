import type { NextFunction, Request, Response } from "express";
import { ErreurMetier } from "../lib/erreurs.js";
import { lireContexteSession, adresseIpDe, type ContexteSession } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

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

// ── Limitation des tentatives de connexion (phases 12-13, chantier 3.5) ──
// 5 échecs en 15 minutes par couple IP + identifiant déclenchent une
// temporisation croissante. Jamais de verrou définitif : cela permettrait
// une négation de service ciblée contre un compte connu.
// Chantier 3.5 : état persisté dans la table `tentatives_connexion` —
// survit aux redémarrages du serveur et est partagé entre instances.

const FENETRE_S = 15 * 60; // secondes
const MAX_ECHECS_AVANT_TEMPORISATION = 5;

export function cleLimiteurConnexion(req: Request, identifiant: string): string {
  return `${adresseIpDe(req) ?? "inconnue"}|${identifiant.trim().toLowerCase()}`;
}

// Purge opportuniste (~5 % des vérifications) des entrées entièrement
// expirées : fenêtre écoulée ET blocage terminé. Fire-and-forget : ne doit
// jamais retarder ni faire échouer une tentative de connexion.
function purgerSiNecessaire(): void {
  if (Math.random() >= 0.05) return;
  const frontiereFenetre = new Date(Date.now() - FENETRE_S * 1000);
  prisma.tentativeConnexion
    .deleteMany({
      where: {
        fenetreOuverte: { lte: frontiereFenetre },
        OR: [{ bloqueJusqua: null }, { bloqueJusqua: { lte: new Date() } }]
      }
    })
    .catch(() => undefined);
}

/** Secondes d'attente restantes avant une nouvelle tentative, 0 si autorisée. */
export async function verifierLimiteConnexion(cle: string): Promise<number> {
  purgerSiNecessaire();
  const entree = await prisma.tentativeConnexion.findUnique({ where: { cle } });
  if (!entree?.bloqueJusqua || entree.bloqueJusqua.getTime() <= Date.now()) return 0;
  return Math.ceil((entree.bloqueJusqua.getTime() - Date.now()) / 1000);
}

// Upsert ATOMIQUE côté PostgreSQL : la décision (nouveau compteur, fenêtre
// réinitialisée, palier de temporisation) est évaluée dans la même requête
// que l'écriture, donc deux échecs simultanés ne peuvent pas se perdre.
// Paliers identiques à l'ancienne version mémoire :
//   5ᵉ échec → 30 s, 6ᵉ → 1 min, 7ᵉ → 2 min, 8ᵉ et plus → 4 min,
// plafonnés à la durée de la fenêtre.
export async function enregistrerEchecConnexion(cle: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO tentatives_connexion (cle, echecs, bloque_jusqua, fenetre_ouverte)
    VALUES (${cle}, 1, NULL, NOW())
    ON CONFLICT (cle) DO UPDATE SET
      fenetre_ouverte =
        CASE WHEN tentatives_connexion.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_S})
             THEN tentatives_connexion.fenetre_ouverte ELSE NOW() END,
      echecs =
        CASE WHEN tentatives_connexion.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_S})
             THEN tentatives_connexion.echecs + 1 ELSE 1 END,
      bloque_jusqua =
        CASE
          WHEN tentatives_connexion.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_S})
               AND tentatives_connexion.echecs + 1 >= ${MAX_ECHECS_AVANT_TEMPORISATION}
          THEN LEAST(
                 NOW() + make_interval(secs =>
                   CASE LEAST(tentatives_connexion.echecs - ${MAX_ECHECS_AVANT_TEMPORISATION} + 2, 4)
                     WHEN 1 THEN 30 WHEN 2 THEN 60 WHEN 3 THEN 120 ELSE 240 END),
                 NOW() + make_interval(secs => ${FENETRE_S}))
          ELSE NULL
        END
  `;
}

export async function reinitialiserConnexion(cle: string): Promise<void> {
  await prisma.tentativeConnexion.deleteMany({ where: { cle } });
}

// ── Limitation complémentaire PAR ADRESSE IP (M2, Phase 1) ────────────
// Le limiteur par couple (IP, identifiant) ne voit pas les pulvérisations
// qui changent d'identifiant à chaque essai. Politique miroir, état en base :
//   30 échecs en 1 h depuis la même IP → blocage de 15 min.
// Décision ATOMIQUE (INSERT … ON CONFLICT), même mécanisme que C2 : deux
// échecs simultanés ne peuvent pas se perdre. Le succès d'une connexion ne
// réinitialise PAS ce compteur : une adresse qui pulvérise des identifiants
// avant de réussir un essai reste sous surveillance jusqu'à l'expiration de
// sa fenêtre (documenté dans le rapport M2).
const FENETRE_IP_S = 60 * 60; // fenêtre glissante : 1 h
const MAX_ECHECS_IP = 30; // seuil de déclenchement du blocage
const BLOCAGE_IP_S = 15 * 60; // durée du blocage

export async function verifierLimiteIp(ip: string): Promise<number> {
  const entree = await prisma.limitationIp.findUnique({ where: { cle: ip } });
  if (!entree?.bloqueJusqua || entree.bloqueJusqua.getTime() <= Date.now()) return 0;
  return Math.ceil((entree.bloqueJusqua.getTime() - Date.now()) / 1000);
}

export async function enregistrerEchecIp(ip: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO limitation_ip (cle, echecs, bloque_jusqua, fenetre_ouverte)
    VALUES (${ip}, 1, NULL, NOW())
    ON CONFLICT (cle) DO UPDATE SET
      fenetre_ouverte =
        CASE WHEN limitation_ip.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_IP_S})
             THEN limitation_ip.fenetre_ouverte ELSE NOW() END,
      echecs =
        CASE WHEN limitation_ip.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_IP_S})
             THEN limitation_ip.echecs + 1 ELSE 1 END,
      bloque_jusqua =
        CASE
          WHEN limitation_ip.fenetre_ouverte > NOW() - make_interval(secs => ${FENETRE_IP_S})
               AND limitation_ip.echecs + 1 >= ${MAX_ECHECS_IP}
          THEN NOW() + make_interval(secs => ${BLOCAGE_IP_S})
          ELSE limitation_ip.bloque_jusqua
        END
  `;
}

// ── Anti-CSRF (M1, Phase 1) ──────────────────────────────────────────
// Deux couches complémentaires sur toute mutation :
//   1. exigerMarqueurMutation : l'en-tête personnalisé
//      « X-Requested-With: XMLHttpRequest » est OBLIGATOIRE. Un formulaire
//      HTML forgé cross-site ne peut pas poser d'en-tête personnalisé ni
//      passer par fetch sur une autre origine : la requête forgée est donc
//      refusée sans état côté serveur (pas de jeton à gérer).
//   2. verifierOrigine : si un en-tête Origin est présent, il doit être
//      autorisé (défense complémentaire, conserve la détection d'un appel
//      navigateur depuis un site tiers même s'il falsifiait le marqueur).
// Les clients non navigateurs (scripts internes, intégrations) posent cet
// en-tête explicitement — cf. docs/DEPLOIEMENT.md (M4).

export function exigerMarqueurMutation(req: Request, _res: Response, next: NextFunction): void {
  const methode = req.method.toUpperCase();
  if (methode === "GET" || methode === "HEAD" || methode === "OPTIONS") {
    next();
    return;
  }
  const marqueur = req.headers["x-requested-with"];
  if (typeof marqueur === "string" && marqueur.trim().toLowerCase() === "xmlhttprequest") {
    next();
    return;
  }
  next(
    new ErreurMetier(
      403,
      "Requête mutante refusée : le marqueur d'origine légitime est absent (en-tête X-Requested-With)."
    )
  );
}

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
