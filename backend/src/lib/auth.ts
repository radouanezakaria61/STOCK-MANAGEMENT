import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import { hash as argonHacher, verify as argonVerifier } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Chantier 2b — authentification et sessions serveur (plan §3.1).
//  - Mots de passe : Argon2id, paramètres recommandés par l'OWASP.
//    Aucun mot de passe en clair ni réversible, nulle part.
//  - Sessions en base : le cookie porte un jeton aléatoire (48 octets) ;
//    seule son empreinte SHA-256 est stockée — une fuite de la base ne
//    permet pas de rejouer les cookies. Expiration glissante prolongée par
//    l'activité, plafonnée par une durée maximale absolue.

const NOMBRE = (cleEnv: string, defaut: number): number => {
  const valeur = Number(process.env[cleEnv]);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : defaut;
};

export const CONFIG_SESSION = {
  nomCookie: process.env["NOM_COOKIE_SESSION"] ?? "gsit_session",
  minutesInactivite: NOMBRE("SESSION_INACTIVITE_MINUTES", 30),
  heuresGlissantes: NOMBRE("SESSION_DUREE_GLISSENTE_HEURES", 8),
  heuresMaximales: NOMBRE("SESSION_DUREE_MAX_HEURES", 12)
};

const OPTIONS_ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return argonHacher(motDePasse, OPTIONS_ARGON);
}

export async function verifierMotDePasse(hache: string, motDePasse: string): Promise<boolean> {
  try {
    return await argonVerifier(hache, motDePasse);
  } catch {
    return false;
  }
}

function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function lireCookie(req: Request, nom: string): string | null {
  const entete = req.headers.cookie;
  if (!entete) return null;
  for (const fragment of entete.split(";")) {
    const index = fragment.indexOf("=");
    if (index === -1) continue;
    if (fragment.slice(0, index).trim() === nom) {
      try {
        return decodeURIComponent(fragment.slice(index + 1).trim());
      } catch {
        return fragment.slice(index + 1).trim();
      }
    }
  }
  return null;
}

export function adresseIpDe(req: Request): string | null {
  const transmise = req.headers["x-forwarded-for"];
  if (typeof transmise === "string" && transmise.length > 0) {
    return transmise.split(",")[0]!.trim();
  }
  return req.ip ?? null;
}

function agentUtilisateurDe(req: Request): string | null {
  const agent = req.headers["user-agent"];
  return typeof agent === "string" && agent.length > 0 ? agent.slice(0, 250) : null;
}

function optionsCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: CONFIG_SESSION.heuresMaximales * 3_600_000
  };
}

type UtilisateurAvecRole = Prisma.UtilisateurGetPayload<{
  include: {
    societe: true;
    role: { include: { permissions: { include: { permission: true } } } };
  };
}>;

export interface ContexteSession {
  sessionId: string;
  utilisateurId: string;
  nomRole: string;
  permissions: ReadonlySet<string>;
  utilisateur: UtilisateurAvecRole;
}

/** Crée la session en base puis pose le cookie HttpOnly sur la réponse. */
export async function ouvrirSession(req: Request, res: Response, utilisateurId: string): Promise<void> {
  const jeton = randomBytes(48).toString("base64url");
  const maintenant = new Date();
  await prisma.session.create({
    data: {
      tokenHash: empreinteJeton(jeton),
      utilisateurId,
      adresseIp: adresseIpDe(req),
      agentUtilisateur: agentUtilisateurDe(req),
      creeLe: maintenant,
      derniereActivite: maintenant,
      expireLe: new Date(maintenant.getTime() + CONFIG_SESSION.heuresGlissantes * 3_600_000)
    }
  });
  res.cookie(CONFIG_SESSION.nomCookie, jeton, optionsCookie());
}

/**
 * Lit et valide la session portée par le cookie : plafond absolu, fenêtre
 * d'inactivité, compte toujours actif. Prolonge l'expiration glissante au
 * passage (une écriture au maximum toutes les cinq minutes).
 */
export async function lireContexteSession(req: Request): Promise<ContexteSession | null> {
  const jeton = lireCookie(req, CONFIG_SESSION.nomCookie);
  if (!jeton) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: empreinteJeton(jeton) },
    include: {
      utilisateur: {
        include: {
          societe: true,
          role: { include: { permissions: { include: { permission: true } } } }
        }
      }
    }
  });
  // Cookie périmé, révoqué ou jamais connu : rien à détruire côté serveur.
  if (!session) return null;

  const detruire = (): Promise<unknown> =>
    prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);

  const maintenant = Date.now();
  const dureeInactivite = maintenant - session.derniereActivite.getTime();

  if (
    session.expireLe.getTime() <= maintenant ||
    dureeInactivite > CONFIG_SESSION.minutesInactivite * 60_000 ||
    session.utilisateur.supprimeLe !== null ||
    session.utilisateur.status !== "Actif"
  ) {
    await detruire();
    return null;
  }

  let expireLe = session.expireLe;
  if (dureeInactivite > 300_000) {
    const plafondAbsolu = session.creeLe.getTime() + CONFIG_SESSION.heuresMaximales * 3_600_000;
    expireLe = new Date(Math.min(plafondAbsolu, maintenant + CONFIG_SESSION.heuresGlissantes * 3_600_000));
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expireLe, derniereActivite: new Date(maintenant) }
      })
      .catch(() => undefined);
  }

  return {
    sessionId: session.id,
    utilisateurId: session.utilisateurId,
    nomRole: session.utilisateur.role.code,
    permissions: new Set(session.utilisateur.role.permissions.map((rp) => rp.permission.code)),
    utilisateur: session.utilisateur
  };
}

/** Détruit la session courante en base et retire le cookie. */
export async function fermerSession(req: Request, res: Response): Promise<void> {
  const jeton = lireCookie(req, CONFIG_SESSION.nomCookie);
  res.clearCookie(CONFIG_SESSION.nomCookie, optionsCookie());
  if (jeton) {
    await prisma.session.deleteMany({ where: { tokenHash: empreinteJeton(jeton) } });
  }
}

/** Révoque toutes les sessions d'un utilisateur (changement de mot de passe, désactivation…). */
export async function invaliderSessions(utilisateurId: string, saufSessionId?: string): Promise<number> {
  const resultat = await prisma.session.deleteMany({
    where: saufSessionId
      ? { utilisateurId, id: { not: saufSessionId } }
      : { utilisateurId }
  });
  return resultat.count;
}

export interface EntreeAudit {
  action: string;
  utilisateurId?: string | null;
  identifiantTente?: string | null;
  entite?: string | null;
  entiteId?: string | null;
  details?: unknown;
  adresseIp?: string | null;
  agentUtilisateur?: string | null;
}

// Journal d'audit en écriture seule (AGENTS.md règle 3). Pour les événements
// d'authentification, l'écriture est « au mieux » : elle ne bloque jamais la
// réponse. Le chantier 3 placera les audits métier dans la transaction même
// des opérations. Jamais de mot de passe dans ce journal.
export async function journaliserAudit(entree: EntreeAudit, req?: Request): Promise<void> {
  try {
    await prisma.journalAudit.create({
      data: {
        action: entree.action,
        utilisateurId: entree.utilisateurId ?? null,
        identifiantTente: entree.identifiantTente ?? null,
        entite: entree.entite ?? null,
        entiteId: entree.entiteId ?? null,
        details: entree.details === undefined ? undefined : (entree.details as Prisma.InputJsonValue),
        adresseIp: entree.adresseIp ?? (req ? adresseIpDe(req) : null),
        agentUtilisateur: entree.agentUtilisateur ?? (req ? agentUtilisateurDe(req) : null)
      }
    });
  } catch (erreur) {
    console.error("Écriture au journal d'audit impossible :", erreur);
  }
}
