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
  annulerAffectation,
  revelerCodesConfidentiels
} from "../services/affectations.service.js";
import { ZodError } from "zod";
import { routerAuth } from "./auth.routes.js";
import { chargerSession, exigerAuth, exigerPermission, verifierOrigine } from "../middleware/auth.js";
import { avecIdempotence } from "../middleware/idempotence.js";
import { acteurDepuis } from "../lib/acteur.js";
import { listerNotifications, marquerCommeLue, marquerToutCommeLues } from "../services/notifications.service.js";
import { listerJournal } from "../services/audit.service.js";
import { schemaFiltresJournalAudit } from "../lib/validation-zod.js";

// Enveloppe async : transmet les ErreurMetier au gestionnaire central.
const h =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// ── Routeurs par domaine ──────────────────────────────────────────────

export const routerApi = Router();

// Authentification : montée en premier, le login reste public. Les autres
// routes d'auth gèrent elles-mêmes leur exigence de session.
routerApi.use("/auth", routerAuth);

// Tout le reste exige une session valide (chantier 2b) : plus aucun
// endpoint anonyme.
routerApi.use(chargerSession);
routerApi.use(exigerAuth);

// Anti-CSRF léger : sur mutation, un en-tête Origin doit être autorisé.
routerApi.use(verifierOrigine);

// Chantier 3.5 (P1.2) : les consultations sensibles exigent une permission
// de lecture explicite (anonyme=401, rôle interdit=403, autorisé=200).
// H1 : le service masque lui-même l'annuaire utilisateurs sans la permission
// dédiée — le contrôle ne repose jamais sur le frontend.
routerApi.get("/data", exigerPermission("parc.consulter"), h(async (req, res) => {
  const data = await obtenirDonneesGlobales(req.contexteAuth!.permissions);
  res.json({ status: "ok", data });
}));

// Sociétés — étiquette de rattachement (filtres), pas de suppression physique
routerApi.get("/societes", exigerPermission("parc.consulter"), h(async (_req, res) => {
  res.json({ status: "ok", data: await listerSocietes() });
}));
routerApi.post("/societes", exigerPermission("societes.gerer"), h(async (req, res) => {
  const r = await creerSociete(req.body);
  res.status(201).json(r);
}));
routerApi.put("/societes/:id", exigerPermission("societes.gerer"), h(async (req, res) => {
  const r = await modifierSociete(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.post("/societes/:id/statut", exigerPermission("societes.gerer"), h(async (req, res) => {
  const r = await changerActivationSociete(req.params["id"]!, req.body["actif"] === true);
  res.json(r);
}));

routerApi.get("/users", exigerPermission("utilisateurs.consulter"), h(async (_req, res) => {
  res.json({ status: "ok", data: await listerUtilisateurs() });
}));
routerApi.post("/users", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await creerUtilisateur(req.body);
  res.status(201).json(r);
}));
routerApi.put("/users/:id", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await modifierUtilisateur(req.params["id"]!, req.body);
  res.json(r);
}));
routerApi.post("/users/:id/status", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await changerStatutUtilisateur(req.params["id"]!, req.body["status"]);
  res.json(r);
}));
routerApi.delete("/users/:id", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  res.json(await supprimerUtilisateur(req.params["id"]!));
}));

routerApi.get("/stock", exigerPermission("parc.consulter"), h(async (_req, res) => {
  res.json({ status: "ok", data: await listerStock() });
}));
routerApi.get("/stock/search", exigerPermission("parc.consulter"), h(async (req, res) => {
  const data = await rechercherStock({
    q: req.query["q"] as string | undefined,
    category: req.query["category"] as string | undefined,
    availableOnly: req.query["availableOnly"] === "true" || req.query["availableOnly"] === "1"
  });
  res.json({ status: "ok", data });
}));
// Mutations créatrices de stock : enveloppe d'idempotence (en-tête
// `X-Cle-Idempotence` optionnel du client) + contexte acteur pour l'audit.
routerApi.post("/stock", exigerPermission("stock.ecrire"), avecIdempotence(async (req, res) => {
  const r = await creerArticle(req.body, acteurDepuis(req));
  res.status(201).json(r);
}));
routerApi.put("/stock/:id", exigerPermission("stock.ecrire"), h(async (req, res) => {
  const r = await modifierArticle(req.params["id"]!, req.body, acteurDepuis(req));
  res.json(r);
}));
routerApi.post("/stock/:id/movement", exigerPermission("stock.ecrire"), h(async (req, res) => {
  const r = await enregistrerMouvement(req.params["id"]!, req.body, acteurDepuis(req));
  res.json(r);
}));
routerApi.delete("/stock/:id", exigerPermission("stock.ecrire"), h(async (req, res) => {
  res.json(await supprimerArticle(req.params["id"]!, acteurDepuis(req)));
}));

routerApi.get("/assignments", exigerPermission("parc.consulter"), h(async (_req, res) => {
  res.json({ status: "ok", data: await listerAffectations() });
}));
// Consultation des PIN/PUK chiffrés : permission dédiée + trace d'audit
// (chantier 3.5, P1.4). Les listes n'exposent plus jamais ces secrets.
routerApi.get("/assignments/:id/confidentiels", exigerPermission("affectations.confidentiels"), h(async (req, res) => {
  res.json({ status: "ok", data: await revelerCodesConfidentiels(req.params["id"]!, acteurDepuis(req)) });
}));
routerApi.post("/assignments", exigerPermission("affectations.ecrire"), avecIdempotence(async (req, res) => {
  const r = await creerAffectation(req.body, acteurDepuis(req));
  res.status(201).json(r);
}));
routerApi.post("/assignments/:id/return", exigerPermission("affectations.ecrire"), h(async (req, res) => {
  const r = await restituerAffectation(req.params["id"]!, req.body, acteurDepuis(req));
  res.json(r);
}));
// Annulation d'une fiche active (remet les quantités en stock). L'historique
// des fiches restituées reste immuable : la route refuse au-delà.
routerApi.delete("/assignments/:id", exigerPermission("affectations.ecrire"), h(async (req, res) => {
  res.json(await annulerAffectation(req.params["id"]!, acteurDepuis(req)));
}));

// Notifications internes : consultables par tout utilisateur authentifié,
// MAIS filtrées par destinataire (chantier 3.5) — chacun ne voit que les
// siennes ; la lecture d'A n'affecte jamais B. Les alertes RESOLUES se
// closent seules.
routerApi.get("/notifications", h(async (req, res) => {
  res.json({ status: "ok", data: await listerNotifications(req.contexteAuth!.utilisateurId) });
}));
routerApi.post("/notifications/lue-tout", h(async (req, res) => {
  res.json(await marquerToutCommeLues(req.contexteAuth!.utilisateurId));
}));
routerApi.post("/notifications/:id/lue", h(async (req, res) => {
  res.json(await marquerCommeLue(req.params["id"]!, req.contexteAuth!.utilisateurId));
}));

// H4 (Phase 1) — consultation du journal d'audit : permission dédiée
// « audit.consulter » exigée côté serveur (SUPER_ADMIN, IT_MANAGER,
// AUDITOR). Pagination et filtres validés Zod, appliqués en SQL par le
// service ; l'ordre est stable (creeLe desc, id desc).
routerApi.get("/audit", exigerPermission("audit.consulter"), h(async (req, res) => {
  const filtres = schemaFiltresJournalAudit.parse(req.query);
  res.json({ status: "ok", data: await listerJournal(filtres) });
}));

// ── Gestionnaire d'erreurs central ────────────────────────────────────

export function gestionnaireErreurs(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ErreurMetier) {
    res.status(err.status).json(err.code ? { error: err.message, code: err.code } : { error: err.message });
    return;
  }
  // Corps JSON malformé : body-parser lève `entity.parse.failed`.
  // C'est une requête fautive (400), pas une panne serveur (500).
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    res.status(400).json({ error: "Corps de requête JSON invalide." });
    return;
  }
  // Échec de validation Zod (AGENTS.md règle 8) → 422 avec le premier
  // problème signalé, message en français.
  if (err instanceof ZodError) {
    const premier = err.issues[0];
    const chemin = premier && premier.path.length > 0 ? premier.path.join(".") : "";
    res.status(422).json({
      error: chemin ? `Champ « ${chemin} » : ${premier!.message}` : premier?.message ?? "Données invalides."
    });
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
