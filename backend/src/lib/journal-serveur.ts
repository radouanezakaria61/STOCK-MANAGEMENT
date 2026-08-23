// Journalisation serveur centralisée (refactoring — standardisation).
//
// Un seul point de passage pour les messages serveur : horodatage ISO,
// niveau explicite, préfixe composant. Aucune donnée sensible ne doit
// transiter par ces fonctions (mêmes règles que le journal d'audit :
// jamais de mot de passe, hash, cookie ou secret).
//
// Priorité 6 du chantier « corrections restantes » : chaque requête HTTP
// reçoit un identifiant unique (`X-Requete-Id`), propagé aux logs via
// AsyncLocalStorage — sans modifier la signature des appelants. Le même id
// est renvoyé au client, ce qui permet de relier une réponse 5xx à la trace
// serveur exacte dans `docker logs`/`journalctl`.
//
// En sortie : stdout/stderr — un superviseur (PM2, systemd, Docker) les
// collecte ; pas de fichier géré par l'application.

import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

type Niveau = "DEBUG" | "INFO" | "WARN" | "ERROR";

const contexteRequete = new AsyncLocalStorage<{ requeteId: string }>();

/** Middleware : attribue l'identifiant de requête (ou honore celui fourni
 *  par un proxy de confiance déjà configuré via app.set("trust proxy")) puis
 *  exécute le reste de la pile DANS le contexte de journalisation. */
export function middlewareRequeteId(req: Request, res: Response, next: NextFunction): void {
  const recu = req.headers["x-requete-id"];
  const requeteId =
    typeof recu === "string" && /^[A-Za-z0-9-]{8,64}$/.test(recu)
      ? recu
      : crypto.randomUUID();
  res.setHeader("X-Requete-Id", requeteId);
  contexteRequete.run({ requeteId }, () => next());
}

function ecrire(niveau: Niveau, composant: string, message: string, details?: unknown): void {
  const requete = contexteRequete.getStore();
  const suffixe = requete ? ` [req:${requete.requeteId}]` : "";
  const ligne = `${new Date().toISOString()} [${niveau}] (${composant})${suffixe} ${message}`;
  const flux = niveau === "ERROR" ? console.error : niveau === "WARN" ? console.warn : console.log;
  if (details !== undefined) {
    // Les erreurs passent par stack (lisible) ; les objets par JSON borné.
    if (details instanceof Error) flux(ligne, "\n", details.stack ?? details.message);
    else flux(ligne, JSON.stringify(details));
  } else {
    flux(ligne);
  }
}

export function journaliser(composant: string) {
  return {
    info: (message: string, details?: unknown) => ecrire("INFO", composant, message, details),
    warn: (message: string, details?: unknown) => ecrire("WARN", composant, message, details),
    erreur: (message: string, details?: unknown) => ecrire("ERROR", composant, message, details)
  };
}
