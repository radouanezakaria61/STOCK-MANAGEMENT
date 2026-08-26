import { Router, Request, Response, NextFunction } from "express";
import { journaliser } from "../lib/journal-serveur.js";

const journalHttp = journaliser("http");
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
  listerMouvements,
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
import { chargerSession, exigerAuth, exigerPermission, verifierOrigine, exigerMarqueurMutation } from "../middleware/auth.js";
import { avecIdempotence } from "../middleware/idempotence.js";
import { acteurDepuis } from "../lib/acteur.js";
import { schemaPagination } from "../lib/pagination.js";
import { listerNotifications, marquerCommeLue, marquerToutCommeLues } from "../services/notifications.service.js";
import { listerJournal } from "../services/audit.service.js";
import {
  schemaFiltresJournalAudit,
  schemaCreationArticle,
  schemaModificationArticle,
  schemaMouvementStock,
  schemaCreationAffectation,
  schemaRetourAffectation,
  schemaCreationSociete,
  schemaModificationSociete,
  schemaActivationSociete,
  schemaCreationUtilisateur,
  schemaModificationUtilisateur,
  schemaChangementStatutUtilisateur
} from "../lib/validation-zod.js";

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

// Sonde de santé (chantier 3.5, point 22) : SEULE route publique de l'API
// avec le login. Légère (une requête SELECT 1), sans aucun secret ni donnée
// métier : exploitable par un superviseur local ou un reverse proxy pour
// vérifier que le process et PostgreSQL répondent. Montée AVANT la session
// pour ne pas dépendre d'une table/cookie en cas d'incident de base.
routerApi.get("/health", h(async (_req, res) => {
  let base = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    base = "ko";
  }
  const etat = {
    serveur: "ok" as const,
    base,
    uptimeSecondes: Math.round(process.uptime()),
    horodatage: new Date().toISOString()
  };
  if (base === "ko") {
    res.status(503).json({ status: "ko", data: etat });
    return;
  }
  res.json({ status: "ok", data: etat });
}));

// Tout le reste exige une session valide (chantier 2b) : plus aucun
// endpoint anonyme.
routerApi.use(chargerSession);
routerApi.use(exigerAuth);

// Anti-CSRF (M1, Phase 1) : sur mutation, le marqueur X-Requested-With est
// obligatoire, puis l'Origin éventuel est validé. L'ordre importe : le
// marqueur filtre les soumissions de formulaires forgées avant toute lecture.
routerApi.use(exigerMarqueurMutation);
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
  const r = await creerSociete(schemaCreationSociete.parse(req.body));
  res.status(201).json(r);
}));
routerApi.put("/societes/:id", exigerPermission("societes.gerer"), h(async (req, res) => {
  const r = await modifierSociete(req.params["id"]!, schemaModificationSociete.parse(req.body));
  res.json(r);
}));
routerApi.post("/societes/:id/statut", exigerPermission("societes.gerer"), h(async (req, res) => {
  const r = await changerActivationSociete(
    req.params["id"]!,
    schemaActivationSociete.parse(req.body).actif
  );
  res.json(r);
}));

routerApi.get("/users", exigerPermission("utilisateurs.consulter"), h(async (req, res) => {
  res.json({ status: "ok", data: await listerUtilisateurs(schemaPagination.parse(req.query)) });
}));
routerApi.post("/users", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await creerUtilisateur(schemaCreationUtilisateur.parse(req.body));
  res.status(201).json(r);
}));
routerApi.put("/users/:id", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await modifierUtilisateur(req.params["id"]!, schemaModificationUtilisateur.parse(req.body));
  res.json(r);
}));
routerApi.post("/users/:id/status", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  const r = await changerStatutUtilisateur(
    req.params["id"]!,
    schemaChangementStatutUtilisateur.parse(req.body).status
  );
  res.json(r);
}));
routerApi.delete("/users/:id", exigerPermission("utilisateurs.gerer"), h(async (req, res) => {
  res.json(await supprimerUtilisateur(req.params["id"]!));
}));

routerApi.get("/stock", exigerPermission("parc.consulter"), h(async (req, res) => {
  res.json({ status: "ok", data: await listerStock(schemaPagination.parse(req.query)) });
}));
// Priorité 2 : l'historique des mouvements devient une ressource paginée à
// part entière (il ne fait que croître — plus de lecture « tout » possible).
routerApi.get("/mouvements", exigerPermission("parc.consulter"), h(async (req, res) => {
  res.json({ status: "ok", data: await listerMouvements(schemaPagination.parse(req.query)) });
}));
routerApi.get("/stock/search", exigerPermission("parc.consulter"), h(async (req, res) => {
  const pag = schemaPagination.parse(req.query);
  const result = await rechercherStock({
    q: req.query["q"] as string | undefined,
    category: req.query["category"] as string | undefined,
    availableOnly: req.query["availableOnly"] === "true" || req.query["availableOnly"] === "1",
    page: pag.page,
    limite: pag.limite
  });
  res.json({ status: "ok", data: result });
}));
// Mutations créatrices de stock : enveloppe d'idempotence (en-tête
// `X-Cle-Idempotence` optionnel du client) + contexte acteur pour l'audit.
routerApi.post("/stock", exigerPermission("stock.ecrire"), avecIdempotence(async (req, res) => {
  const r = await creerArticle(schemaCreationArticle.parse(req.body), acteurDepuis(req));
  res.status(201).json(r);
}));
routerApi.put("/stock/:id", exigerPermission("stock.ecrire"), h(async (req, res) => {
  const r = await modifierArticle(
    req.params["id"]!,
    schemaModificationArticle.parse(req.body),
    acteurDepuis(req)
  );
  res.json(r);
}));
routerApi.post("/stock/:id/movement", exigerPermission("stock.ecrire"), h(async (req, res) => {
  const r = await enregistrerMouvement(
    req.params["id"]!,
    schemaMouvementStock.parse(req.body),
    acteurDepuis(req)
  );
  res.json(r);
}));
routerApi.delete("/stock/:id", exigerPermission("stock.ecrire"), h(async (req, res) => {
  res.json(await supprimerArticle(req.params["id"]!, acteurDepuis(req)));
}));

routerApi.get("/assignments", exigerPermission("parc.consulter"), h(async (req, res) => {
  res.json({ status: "ok", data: await listerAffectations(schemaPagination.parse(req.query)) });
}));
// Consultation des PIN/PUK chiffrés : permission dédiée + trace d'audit
// (chantier 3.5, P1.4). Les listes n'exposent plus jamais ces secrets.
routerApi.get("/assignments/:id/confidentiels", exigerPermission("affectations.confidentiels"), h(async (req, res) => {
  res.json({ status: "ok", data: await revelerCodesConfidentiels(req.params["id"]!, acteurDepuis(req)) });
}));
routerApi.post("/assignments", exigerPermission("affectations.ecrire"), avecIdempotence(async (req, res) => {
  const r = await creerAffectation(schemaCreationAffectation.parse(req.body), acteurDepuis(req));
  res.status(201).json(r);
}));
routerApi.post("/assignments/:id/return", exigerPermission("affectations.ecrire"), h(async (req, res) => {
  const r = await restituerAffectation(
    req.params["id"]!,
    schemaRetourAffectation.parse(req.body),
    acteurDepuis(req)
  );
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
  res.json({
    status: "ok",
    data: await listerNotifications(
      req.contexteAuth!.utilisateurId,
      schemaPagination.parse(req.query)
    )
  });
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

// ── Messagerie interne (chat MVP poll-based) ─────────────────────────
import {
  creerConversation,
  listerConversations,
  obtenirConversation,
  envoyerMessage,
  listerMessages,
  marquerLu,
  compterNonLus,
  rechercherUtilisateurs,
} from "../services/chat.service.js";
import {
  uploadPieceJointe,
  creerEnregistrementPieceJointe,
  lirePieceJointe,
} from "../services/attachments.service.js";

routerApi.get("/chat/unread-count", h(async (req, res) => {
  res.json({ status: "ok", data: { count: await compterNonLus(req.contexteAuth!.utilisateurId) } });
}));

routerApi.get("/chat/users/search", h(async (req, res) => {
  const q = (req.query["q"] as string) || "";
  const me = req.contexteAuth!.utilisateurId;
  const users = await rechercherUtilisateurs(q, [me]);
  res.json({ status: "ok", data: users });
}));

routerApi.get("/chat/conversations", h(async (req, res) => {
  res.json({ status: "ok", data: await listerConversations(req.contexteAuth!.utilisateurId) });
}));

routerApi.post("/chat/conversations", h(async (req, res) => {
  const { titre, participantIds } = req.body as { titre?: string; participantIds: string[] };
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: "Au moins un participant requis." });
    return;
  }
  const conv = await creerConversation({ titre, participantIds }, acteurDepuis(req));
  res.status(201).json({ status: "ok", data: conv });
}));

routerApi.get("/chat/conversations/:id", h(async (req, res) => {
  res.json({
    status: "ok",
    data: await obtenirConversation(req.params["id"]!, req.contexteAuth!.utilisateurId),
  });
}));

routerApi.get("/chat/conversations/:id/messages", h(async (req, res) => {
  const pag = schemaPagination.parse(req.query);
  const after = req.query["after"] as string | undefined;
  res.json({
    status: "ok",
    data: await listerMessages(
      req.params["id"]!,
      req.contexteAuth!.utilisateurId,
      { page: pag.page, limite: pag.limite, after }
    ),
  });
}));

routerApi.post("/chat/conversations/:id/messages", h(async (req, res) => {
  const { contenu, type, imageBase64, imageMime, imageNom } = req.body as {
    contenu: string;
    type?: string;
    imageBase64?: string;
    imageMime?: string;
    imageNom?: string;
  };
  if (!contenu || contenu.trim() === "") {
    res.status(400).json({ error: "Le message ne peut pas être vide." });
    return;
  }

  const userId = req.contexteAuth!.utilisateurId;
  let pieceJointeMeta: Awaited<ReturnType<typeof uploadPieceJointe>> | undefined;

  // Si une image est fournie, sauvegarder le fichier sur disque (pas encore en DB)
  if (imageBase64 && imageMime) {
    const buffer = Buffer.from(imageBase64, "base64");
    pieceJointeMeta = await uploadPieceJointe(
      req.params["id"]!,
      userId,
      {
        buffer,
        originalname: imageNom || "image",
        mimetype: imageMime,
        size: buffer.length,
      }
    );
  }

  // Créer le message (IMAGE si pièce jointe, sinon TEXTE)
  const msg = await envoyerMessage(
    req.params["id"]!,
    {
      contenu: contenu.trim() || (pieceJointeMeta ? `[Image: ${imageNom || "image"}]` : contenu),
      type: pieceJointeMeta ? "IMAGE" : (type || "TEXTE"),
    },
    acteurDepuis(req)
  );

  // Si image : créer l'enregistrement PieceJointe avec le vrai messageId, puis update le message
  if (pieceJointeMeta) {
    const pj = await creerEnregistrementPieceJointe(msg.id, pieceJointeMeta);
    const fichierUrl = `/api/chat/attachments/${pj.id}`;
    // Mettre à jour le message avec l'URL de la pièce jointe
    await prisma.message.update({
      where: { id: msg.id },
      data: { fichierUrl, fichierType: imageMime! },
    });
    msg.fichierUrl = fichierUrl;
    msg.fichierType = imageMime!;
  }

  res.status(201).json({ status: "ok", data: msg });
}));

routerApi.get("/chat/attachments/:id", h(async (req, res) => {
  const data = await lirePieceJointe(req.params["id"]!, req.contexteAuth!.utilisateurId);
  res.setHeader("Content-Type", data.mimeType);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(data.buffer);
}));

routerApi.post("/chat/conversations/:id/read", h(async (req, res) => {
  await marquerLu(req.params["id"]!, req.contexteAuth!.utilisateurId);
  res.json({ status: "ok" });
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
  journalHttp.erreur("Erreur serveur inattendue", err);
  res.status(500).json({ error: "Erreur interne du serveur." });
}

// Vérification de connexion DB au démarrage
export async function verifierBase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    journalHttp.erreur("Connexion PostgreSQL impossible", e instanceof Error ? e : new Error(String(e)));
    return false;
  }
}
