import { createHash } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { conflit } from "../lib/erreurs.js";

// Chantier 3 — idempotence serveur (point 4).
// Le client envoie un en-tête `X-Cle-Idempotence` sur les mutations créatrices
// ; la première exécution enregistre clé + corps + réponse, toute
// retransmission ultérieure (double clic, retry réseau) reçoit la réponse
// d'origine sans réexécuter l'opération. Deux requêtes simultanées portant la
// même clé : l'une traite, l'autre attend puis rejoue sa réponse.
//
// Sans en-tête, le comportement reste celui d'avant (compatibilité).

const EN_TETE_CLE = "x-cle-idempotence";
const DUREE_CONSERVATION_MS = 24 * 3_600_000;
const DELAI_ATTENTE_EN_VOL_MS = 5_000;
const PAUSE_SONDAGE_MS = 150;
const PROBA_PURGE = 0.05;

function empreinteCorps(req: Request): string {
  return createHash("sha256").update(JSON.stringify(req.body ?? {})).digest("hex");
}

async function purgerExpirees(): Promise<void> {
  try {
    await prisma.requeteIdempotente.deleteMany({
      where: { creeLe: { lt: new Date(Date.now() - DUREE_CONSERVATION_MS) } }
    });
  } catch {
    // La purge est un service rendu, jamais une exigence.
  }
}

/**
 * Enveloppe une mutation créatrice avec garantie d'idempotence. Le gestionnaire
 * suit la convention maison : fonction async qui soit répond en 2xx, soit
 * lève (l'erreur part alors vers le gestionnaire central et la réservation
 * est libérée — le client peut corriger et retenter).
 */
export function avecIdempotence(
  fn: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const brut = req.headers[EN_TETE_CLE];
    if (typeof brut !== "string" || brut.trim().length === 0 || brut.length > 200) {
      fn(req, res).catch(next);
      return;
    }

    executerAvecIdempotence(req, res, brut.trim(), fn).catch(next);
  };
}

async function executerAvecIdempotence(
  req: Request,
  res: Response,
  cleBrute: string,
  fn: (req: Request, res: Response) => Promise<void>
): Promise<void> {
  // Clé scopée par méthode+chemin : la même valeur envoyée à deux opérations
  // différentes ne doit jamais masquer l'une d'elles.
  const cheminBase = req.baseUrl.split("?")[0]!;
  const cle = `${req.method} ${cheminBase}#${cleBrute}`;
  const empreinte = empreinteCorps(req);

  if (Math.random() < PROBA_PURGE) await purgerExpirees();

  let reservee = false;
  try {
    await prisma.requeteIdempotente.create({ data: { cle, empreinteCorps: empreinte } });
    reservee = true;
  } catch (erreur) {
    const connue = erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002";
    if (!connue) throw erreur;

    const existante = await prisma.requeteIdempotente.findUnique({ where: { cle } });
    if (existante && existante.empreinteCorps !== empreinte) {
      throw conflit(
        "Cette clé d'idempotence a déjà été utilisée avec un contenu de requête différent. Générez une nouvelle clé pour une nouvelle opération."
      );
    }
    if (!existante) {
      // La première tentative vient d'échouer et a libéré la clé : on peut exécuter.
      reservee = true;
      await prisma.requeteIdempotente.create({ data: { cle, empreinteCorps: empreinte } });
    }
  }

  if (!reservee) {
    // Une exécution est en vol : on attend sa réponse pour la rejouer.
    const debut = Date.now();
    while (Date.now() - debut < DELAI_ATTENTE_EN_VOL_MS) {
      await new Promise((r) => setTimeout(r, PAUSE_SONDAGE_MS));
      const enCours = await prisma.requeteIdempotente.findUnique({ where: { cle } });
      if (!enCours) {
        // L'exécution initiale a échoué : la clé est libre, on tente.
        return executerAvecIdempotence(req, res, cleBrute, fn);
      }
      if (enCours.corpsReponse != null) {
        res.status(enCours.statusReponse).json(enCours.corpsReponse);
        return;
      }
    }
    throw conflit("Une requête identique (même clé d'idempotence) est déjà en cours de traitement.");
  }

  // Capture de la réponse réussie pour stockage.
  let corpsCapture: unknown;
  const jsonOriginel = res.json.bind(res);
  res.json = (corps: unknown) => {
    corpsCapture = corps;
    return jsonOriginel(corps);
  };

  try {
    await fn(req, res);
    if (res.statusCode < 400 && corpsCapture !== undefined) {
      await prisma.requeteIdempotente.update({
        where: { cle },
        data: { statusReponse: res.statusCode, corpsReponse: corpsCapture as Prisma.InputJsonValue }
      });
    }
  } catch (erreur) {
    // Échec : la clé est libérée pour permettre une nouvelle tentative.
    await prisma.requeteIdempotente.deleteMany({ where: { cle } }).catch(() => undefined);
    throw erreur;
  }
}
