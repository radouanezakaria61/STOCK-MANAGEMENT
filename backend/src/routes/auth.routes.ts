import { Router, Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { ErreurMetier, introuvable, requeteInvalide } from "../lib/erreurs.js";
import { prisma } from "../lib/prisma.js";
import {
  ouvrirSession,
  fermerSession,
  invaliderSessions,
  hacherMotDePasse,
  verifierMotDePasse,
  journaliserAudit,
  adresseIpDe,
  type ContexteSession
} from "../lib/auth.js";
import {
  chargerSession,
  exigerAuth,
  enregistrerEchecConnexion,
  reinitialiserConnexion,
  verifierLimiteConnexion,
  verifierOrigine
} from "../middleware/auth.js";
import { schemaChangementMotDePasse, schemaConnexion } from "../lib/validation-zod.js";

// Enveloppe async locale : transmet les erreurs au gestionnaire central.
const h =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const routerAuth = Router();

function construireProfil(utilisateur: ContexteSession["utilisateur"], permissions: ReadonlySet<string>) {
  return {
    id: utilisateur.id,
    reference: utilisateur.reference,
    username: utilisateur.username,
    name: utilisateur.name,
    email: utilisateur.email,
    avatarUrl: utilisateur.avatarUrl,
    department: utilisateur.department,
    jobTitle: utilisateur.jobTitle,
    status: utilisateur.status,
    role: { code: utilisateur.role.code, nom: utilisateur.role.nom },
    societe: utilisateur.societe ? { id: utilisateur.societe.id, nom: utilisateur.societe.nom } : null,
    derniereConnexion: utilisateur.derniereConnexion,
    doitChangerMdp: utilisateur.doitChangerMdp,
    permissions: [...permissions]
  };
}

// Message volontairement identique pour compte inexistant, mot de passe
// erroné ou compte sans accès local : aucune énumération de comptes.
const MESSAGE_ECHEC_CONNEXION = "Identifiant ou mot de passe incorrect.";

// Hash leurre calculé une seule fois, utilisé pour égaliser la durée des
// réponses quand le compte visé n'existe pas.
let hacheLeurreEnCours: Promise<string> | null = null;
function hacheLeurreAsync(): Promise<string> {
  hacheLeurreEnCours ??= hacherMotDePasse(randomBytes(18).toString("base64url"));
  return hacheLeurreEnCours;
}

routerAuth.post(
  "/login",
  verifierOrigine,
  h(async (req, res) => {
    const { identifiant, motDePasse } = schemaConnexion.parse(req.body);
    const cleLimiteur = `${adresseIpDe(req) ?? "inconnue"}|${identifiant.trim().toLowerCase()}`;

    const attenteSecondes = verifierLimiteConnexion(cleLimiteur);
    if (attenteSecondes > 0) {
      res.setHeader("Retry-After", String(attenteSecondes));
      throw new ErreurMetier(
        429,
        `Trop de tentatives de connexion. Réessayez dans ${attenteSecondes} secondes.`
      );
    }

    // Connexion par username OU email (plan §3.1), insensible à la casse.
    const identifiantNormalise = identifiant.trim().toLowerCase();
    const utilisateur = await prisma.utilisateur.findFirst({
      where: {
        OR: [
          { username: identifiantNormalise },
          { email: { equals: identifiantNormalise, mode: "insensitive" } }
        ]
      },
      include: {
        societe: true,
        role: { include: { permissions: { include: { permission: true } } } }
      }
    });

    // Vérification à temps quasi constant : quand le compte n'existe pas ou
    // n'a pas d'accès local, un hash leurre est vérifié quand même, pour que
    // la réponse ne révèle rien par sa latence.
    let hacheLeurre: string | null = null;
    if (!utilisateur?.motDePasseHash) {
      hacheLeurre ??= await hacheLeurreAsync();
    }
    const hacheAVerifier = utilisateur?.motDePasseHash ?? hacheLeurre;
    const motDePasseValide = await verifierMotDePasse(hacheAVerifier!, motDePasse);

    const compteUtilisable =
      utilisateur !== null &&
      utilisateur.motDePasseHash !== null &&
      utilisateur.supprimeLe === null &&
      utilisateur.status === "Actif";

    if (!(compteUtilisable && motDePasseValide)) {
      enregistrerEchecConnexion(cleLimiteur);
      await journaliserAudit(
        {
          action: "LOGIN_REFUSE",
          utilisateurId: utilisateur?.id ?? null,
          identifiantTente: identifiantNormalise
        },
        req
      );
      throw new ErreurMetier(401, MESSAGE_ECHEC_CONNEXION);
    }

    reinitialiserConnexion(cleLimiteur);
    await ouvrirSession(req, res, utilisateur.id);
    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { derniereConnexion: new Date() }
    });
    await journaliserAudit({
      action: "LOGIN",
      utilisateurId: utilisateur.id,
      identifiantTente: utilisateur.username
    }, req);

    const permissions = new Set(utilisateur.role.permissions.map((rp) => rp.permission.code));
    res.json({ status: "ok", data: construireProfil(utilisateur, permissions) });
  })
);

routerAuth.post(
  "/logout",
  chargerSession,
  verifierOrigine,
  h(async (req, res) => {
    const contexte = req.contexteAuth;
    await fermerSession(req, res);
    if (contexte) {
      await journaliserAudit({
        action: "LOGOUT",
        utilisateurId: contexte.utilisateurId,
        identifiantTente: contexte.utilisateur.username
      }, req);
    }
    res.json({ message: "Déconnexion effectuée." });
  })
);

routerAuth.get(
  "/me",
  chargerSession,
  exigerAuth,
  h(async (req, res) => {
    const contexte = req.contexteAuth!;
    res.json({ status: "ok", data: construireProfil(contexte.utilisateur, contexte.permissions) });
  })
);

routerAuth.post(
  "/changer-mot-de-passe",
  chargerSession,
  exigerAuth,
  verifierOrigine,
  h(async (req, res) => {
    const contexte = req.contexteAuth!;
    const { motDePasseActuel, nouveauMotDePasse } = schemaChangementMotDePasse.parse(req.body);

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: contexte.utilisateurId }
    });
    if (!utilisateur || !utilisateur.motDePasseHash) {
      throw introuvable("Compte introuvable ou sans accès local.");
    }
    if (!(await verifierMotDePasse(utilisateur.motDePasseHash, motDePasseActuel))) {
      throw requeteInvalide("Le mot de passe actuel est incorrect.");
    }
    if (await verifierMotDePasse(utilisateur.motDePasseHash, nouveauMotDePasse)) {
      throw requeteInvalide("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        motDePasseHash: await hacherMotDePasse(nouveauMotDePasse),
        doitChangerMdp: false
      }
    });

    // Toutes les autres sessions sont révoquées ; la session courante survit.
    const sessionsRevoked = await invaliderSessions(utilisateur.id, contexte.sessionId);
    await journaliserAudit({
      action: "CHANGEMENT_MOT_DE_PASSE",
      utilisateurId: utilisateur.id,
      identifiantTente: utilisateur.username,
      entite: "Utilisateur",
      entiteId: utilisateur.id
    }, req);

    res.json({
      message:
        sessionsRevoked > 0
          ? `Mot de passe modifié avec succès. ${sessionsRevoked} autre(s) session(s) ont été déconnectée(s).`
          : "Mot de passe modifié avec succès.",
      data: { doitChangerMdp: false }
    });
  })
);
