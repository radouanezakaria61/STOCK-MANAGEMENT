import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { ErreurMetier } from "../lib/erreurs.js";
import { estActif } from "../lib/modules.js";
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
import iaRoutes from "./ia.routes.js";

// Enveloppe async : transmet les ErreurMetier au gestionnaire central.
const h =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ── Routeurs par domaine (montage conditionnel selon MODULES_ACTIFS) ──

const rDashboard = Router();
rDashboard.get("/data", h(async (_req, res) => {
  const data = await obtenirDonneesGlobales();
  res.json({ status: "ok", data });
}));

const rAchats = Router(); // module gelé
rAchats.post("/pos", h(async (req, res) => {
  const r = await creerBonCommande(req.body);
  res.status(201).json(r);
}));
rAchats.post("/pos/:id/status", h(async (req, res) => {
  const r = await changerStatutBonCommande(req.params["id"]!, req.body["status"]);
  res.json(r);
}));

const rFournisseurs = Router(); // partagé achats/parc IT — reste actif
rFournisseurs.post("/vendors", h(async (req, res) => {
  const r = await creerFournisseur(req.body);
  res.status(201).json(r);
}));
rFournisseurs.post("/vendors/:id/rating", h(async (req, res) => {
  const r = await noterFournisseur(req.params["id"]!, req.body);
  res.json(r);
}));

const rAppelsOffres = Router(); // module gelé
rAppelsOffres.post("/rfq", h(async (req, res) => {
  const r = await creerAppelOffres(req.body);
  res.status(201).json(r);
}));

const rUtilisateurs = Router();
rUtilisateurs.get("/users", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerUtilisateurs() });
}));
rUtilisateurs.post("/users", h(async (req, res) => {
  const r = await creerUtilisateur(req.body);
  res.status(201).json(r);
}));
rUtilisateurs.put("/users/:id", h(async (req, res) => {
  const r = await modifierUtilisateur(req.params["id"]!, req.body);
  res.json(r);
}));
rUtilisateurs.post("/users/:id/status", h(async (req, res) => {
  const r = await changerStatutUtilisateur(req.params["id"]!, req.body["status"]);
  res.json(r);
}));
rUtilisateurs.delete("/users/:id", h(async (req, res) => {
  res.json(await supprimerUtilisateur(req.params["id"]!));
}));

const rStock = Router();
rStock.get("/stock", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerStock() });
}));
rStock.get("/stock/search", h(async (req, res) => {
  const data = await rechercherStock({
    q: req.query["q"] as string | undefined,
    category: req.query["category"] as string | undefined,
    availableOnly: req.query["availableOnly"] === "true" || req.query["availableOnly"] === "1"
  });
  res.json({ status: "ok", data });
}));
rStock.post("/stock", h(async (req, res) => {
  const r = await creerArticle(req.body);
  res.status(201).json(r);
}));
rStock.put("/stock/:id", h(async (req, res) => {
  const r = await modifierArticle(req.params["id"]!, req.body);
  res.json(r);
}));
rStock.post("/stock/:id/movement", h(async (req, res) => {
  const r = await enregistrerMouvement(req.params["id"]!, req.body);
  res.json(r);
}));
rStock.post("/stock/import-po", h(async (req, res) => {
  const r = await importerDepuisBonCommande(req.body);
  res.status(r.status).json({ message: r.message, data: r.data });
}));
rStock.delete("/stock/:id", h(async (req, res) => {
  res.json(await supprimerArticle(req.params["id"]!));
}));

const rAffectations = Router();
rAffectations.get("/assignments", h(async (_req, res) => {
  res.json({ status: "ok", data: await listerAffectations() });
}));
rAffectations.post("/assignments", h(async (req, res) => {
  const r = await creerAffectation(req.body);
  res.status(201).json(r);
}));
rAffectations.post("/assignments/:id/return", h(async (req, res) => {
  const r = await restituerAffectation(req.params["id"]!, req.body);
  res.json(r);
}));
rAffectations.delete("/assignments/:id", h(async (req, res) => {
  res.json(await supprimerAffectation(req.params["id"]!));
}));

// ── Montage conditionnel ──────────────────────────────────────────────

function monter(nom: string, routeur: Router): void {
  if (estActif(nom)) {
    routerApi.use("/", routeur);
  } else {
    // Module gelé : réponse 404 JSON explicite, le code reste en place.
    routerApi.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith(prefixeDe(nom))) {
        res.status(404).json({ error: `Module « ${nom} » désactivé (périmètre gelé).` });
        return;
      }
      next();
    });
  }
}

// Préfixes de chemins par module, pour les réponses 404 ciblées.
function prefixeDe(nom: string): string {
  switch (nom) {
    case "achats": return "/pos";
    case "appels-offres": return "/rfq";
    case "ia": return "/ai";
    default: return "\u0000"; // modules actifs : jamais en 404
  }
}

export const routerApi = Router();

monter("dashboard", rDashboard);
monter("achats", rAchats);
monter("fournisseurs", rFournisseurs);
monter("appels-offres", rAppelsOffres);
monter("ia", iaRoutes); // module gelé : le stub 404 s'applique quand il est inactif

monter("utilisateurs", rUtilisateurs);
monter("stock", rStock);
monter("affectations", rAffectations);

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
