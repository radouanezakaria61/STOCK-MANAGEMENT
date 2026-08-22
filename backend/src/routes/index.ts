import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { ErreurMetier } from "../lib/erreurs.js";
import { obtenirDonneesGlobales } from "../services/dashboard.service.js";
import {
  listerSocietes,
  creerSociete,
  modifierSociete,
  changerActivationSociete
} from "../services/societes.service.js";
import {
  listerUtilisateurs,
  creerUtilisateur,
  modifierUtilisateur,
  changerStatutUtilisateur,
  supprimerUtilisateur
} from "../services/utilisateurs.service.js";
import {
  listerStock,
  rechercherStock,
  creerArticle,
  modifierArticle,
  enregistrerMouvement,
  supprimerArticle
} from "../services/stock.service.js";
import {
  listerAffectations,
  creerAffectation,
  restituerAffectation,
  supprimerAffectation
} from "../services/affectations.service.js";

// Enveloppe async : transmet les ErreurMetier au gestionnaire central.
const h =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ── Routeurs par domaine ──────────────────────────────────────────────

export const routerApi = Router();

routerApi.get("/data", h(async (_req, res) => {
  const data = await obtenirDonneesGlobales();
  res.json({ status: "ok", data });
}));

// Sociétés — étiquette de rattachement (filtres), pas de suppression physique
routerApi.get("/societes", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerSocietes() });
}));
routerApi.post("/societes", h(async (req, res) => {
  const r = await creerSociete(req.body);
  res.status(201).json(r);
}));
routerApi.put("/societes/:id", h(async (req, res) => {
  const r = await modifierSociete(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.post("/societes/:id/statut", h(async (req, res) => {
  const r = await changerActivationSociete(req.params["id"]!, req.body["actif"] === true);
  res.json(r);
}));

routerApi.get("/users", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerUtilisateurs() });
}));
routerApi.post("/users", h(async (req, res) => {
  const r = await creerUtilisateur(req.body);
  res.status(201).json(r);
}));
routerApi.put("/users/:id", h(async (req, res) => {
  const r = await modifierUtilisateur(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.post("/users/:id/status", h(async (req, res) => {
  const r = await changerStatutUtilisateur(req.params["id"]!, req.body["status"]);
  res.json(r);
}));
routerApi.delete("/users/:id", h(async (req, res) => {
  res.json(await supprimerUtilisateur(req.params["id"]!));
}));

routerApi.get("/stock", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerStock() });
}));
routerApi.get("/stock/search", h(async (req, res) => {
  const data = await rechercherStock({
    q: req.query["q"] as string | undefined,
    category: req.query["category"] as string | undefined,
    availableOnly: req.query["availableOnly"] === "true" || req.query["availableOnly"] === "1"
  });
  res.json({ status: "ok", data });
}));
routerApi.post("/stock", h(async (req, res) => {
  const r = await creerArticle(req.body);
  res.status(201).json(r);
}));
routerApi.put("/stock/:id", h(async (req, res) => {
  const r = await modifierArticle(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.post("/stock/:id/movement", h(async (req, res) => {
  const r = await enregistrerMouvement(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.delete("/stock/:id", h(async (req, res) => {
  res.json(await supprimerArticle(req.params["id"]!));
}));

routerApi.get("/assignments", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerAffectations() });
}));
routerApi.post("/assignments", h(async (req, res) => {
  const r = await creerAffectation(req.body);
  res.status(201).json(r);
}));
routerApi.post("/assignments/:id/return", h(async (req, res) => {
  const r = await restituerAffectation(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.delete("/assignments/:id", h(async (req, res) => {
  res.json(await supprimerAffectation(req.params["id"]!));
}));

// ── Gestionnaire d'erreurs central ────────────────────────────────────

export function gestionnaireErreurs(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ErreurMetier) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("Erreur serveur inattendue :", err);
  res.status(500).json({ error: "Erreur interne du serveur." });
}

// Vérification de connexion DB au démarrage
export async function verifierBase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.error("Connexion PostgreSQL impossible :", e instanceof Error ? e.message : e);
    return false;
  }
}
