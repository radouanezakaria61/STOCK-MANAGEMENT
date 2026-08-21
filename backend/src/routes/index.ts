import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { ErreurMetier } from "../lib/erreurs.js";
import { obtenirDonneesGlobales } from "../services/dashboard.service.js";
import { creerFournisseur, noterFournisseur } from "../services/fournisseurs.service.js";
import { creerBonCommande, changerStatutBonCommande } from "../services/bons-commande.service.js";
import { creerAppelOffres } from "../services/appels-offres.service.js";
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
  importerDepuisBonCommande,
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

// Tableau de bord / données globales
routerApi.get("/data", h(async (_req, res) => {
  const data = await obtenirDonneesGlobales();
  res.json({ status: "ok", data });
}));

// Bons de commande
routerApi.post("/pos", h(async (req, res) => {
  const r = await creerBonCommande(req.body);
  res.status(201).json(r);
}));
routerApi.post("/pos/:id/status", h(async (req, res) => {
  const r = await changerStatutBonCommande(req.params["id"]!, req.body["status"]);
  res.json(r);
}));

// Fournisseurs
routerApi.post("/vendors", h(async (req, res) => {
  const r = await creerFournisseur(req.body);
  res.status(201).json(r);
}));
routerApi.post("/vendors/:id/rating", h(async (req, res) => {
  const r = await noterFournisseur(req.params["id"]!, req.body);
  res.json(r);
}));

// Appels d'offres
routerApi.post("/rfq", h(async (req, res) => {
  const r = await creerAppelOffres(req.body);
  res.status(201).json(r);
}));

// Utilisateurs & permissions
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

// Stock IT
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
routerApi.post("/stock/import-po", h(async (req, res) => {
  const r = await importerDepuisBonCommande(req.body);
  res.status(r.status).json({ message: r.message, data: r.data });
}));
routerApi.delete("/stock/:id", h(async (req, res) => {
  res.json(await supprimerArticle(req.params["id"]!));
}));

// Affectations & restitutions
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

// Intelligence artificielle (Gemini + repli local)
import iaRoutes from "./ia.routes.js";
routerApi.use("/", iaRoutes);

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
