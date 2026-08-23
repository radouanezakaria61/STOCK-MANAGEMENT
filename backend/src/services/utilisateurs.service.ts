import { Prisma } from "@prisma/client";
import { prisma, prismaSansFiltre } from "../lib/prisma.js";
import { conflit, introuvable, requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";
import { hacherMotDePasse, invaliderSessions } from "../lib/auth.js";
import { schemaNouveauMotDePasse } from "../lib/validation-zod.js";
import {
  bornerPagination,
  metaPagination,
  type ParametresPagination
} from "../lib/pagination.js";

// Chantier 2b : la matrice de permissions codée en dur est remplacée par le
// RBAC serveur (tables Role/Permission/RolePermission). Le rôle d'un
// utilisateur est une FK vers roles ; un code inconnu est refusé ici, et
// l'autorisation effective est vérifiée par exigerPermission sur les routes.
const STATUTS_AUTORISES = ["Actif", "Inactif"] as const;

const SCHEMA_USERNAME = /^[a-z0-9](?:[a-z0-9._-]{1,48}[a-z0-9])?$/;

function validerStatut(statut: string): void {
  if (!STATUTS_AUTORISES.includes(statut as (typeof STATUTS_AUTORISES)[number])) {
    throw requeteInvalide(
      `Statut non reconnu : « ${statut} ». Statuts acceptés : ${STATUTS_AUTORISES.join(", ")}.`
    );
  }
}

function normaliserUsername(username: string): string {
  const normalise = username.trim().toLowerCase();
  if (!SCHEMA_USERNAME.test(normalise)) {
    throw requeteInvalide(
      "Identifiant de connexion invalide : 3 à 50 caractères parmi lettres minuscules, chiffres, point, tiret ou underscore."
    );
  }
  return normalise;
}

async function resoudreRoleId(codeRole: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { code: codeRole } });
  if (!role) {
    const codes = await prisma.role.findMany({ select: { code: true }, orderBy: { code: "asc" } });
    throw requeteInvalide(
      `Rôle non reconnu : « ${codeRole} ». Rôles acceptés : ${codes.map((r) => r.code).join(", ")}.`
    );
  }
  return role.id;
}

export interface EntreeUtilisateur {
  username?: string;
  motDePasseTemporaire?: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  role?: string;
  status?: string;
  societeId?: string | null;
}

async function trouverUtilisateur(idOuReference: string) {
  return prisma.utilisateur.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
}

async function resoudreSociete(idOuReference: string | null | undefined) {
  if (idOuReference === undefined || idOuReference === null || idOuReference === "") return null;
  const societe = await prisma.societe.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
  if (!societe) throw requeteInvalide("La société indiquée n'existe pas.");
  return societe.id;
}

function verifierDernierSuperAdmin(utilisateur: { roleId: string }, action: "désactiver" | "supprimer") {
  return prisma.role
    .findUnique({ where: { id: utilisateur.roleId } })
    .then(async (role) => {
      if (role?.code !== "SUPER_ADMIN") return false;
      const adminsActifs = await prisma.utilisateur.count({
        where: { role: { code: "SUPER_ADMIN" }, status: "Actif", supprimeLe: null }
      });
      if (adminsActifs <= 1) {
        throw requeteInvalide(`Impossible de ${action} le seul compte Super administrateur actif.`);
      }
      return true;
    });
}

// Priorité 8 — DTO par allowlist : le contrat d'un utilisateur exposé est
// EXPLICITE. Toute colonne ajoutée demain au modèle (hash, jeton, note
// interne…) reste invisible tant qu'elle n'est pas déclarée ici — la
// sérialisation par blacklist (serialiser) reste en dernière barrière.
export type UtilisateurComplet = Prisma.UtilisateurGetPayload<{
  include: { societe: true; role: { select: { code: true; nom: true } } };
}>;

function dtoUtilisateur(u: UtilisateurComplet) {
  return {
    id: u.id,
    reference: u.reference,
    username: u.username,
    name: u.name,
    email: u.email,
    phone: u.phone,
    department: u.department,
    jobTitle: u.jobTitle,
    status: u.status,
    role: u.role,
    societeId: u.societeId,
    societe: u.societe,
    doitChangerMdp: u.doitChangerMdp,
    derniereConnexion: u.derniereConnexion,
    creeLe: u.creeLe
  };
}

export async function listerUtilisateurs(parametres?: Partial<ParametresPagination>) {
  // Priorité 2 : pagination serveur, ordre déterministe (creeLe desc, id desc).
  const { page, limite, skip, take } = bornerPagination(parametres);
  const [total, lignes] = await Promise.all([
    prisma.utilisateur.count(),
    prisma.utilisateur.findMany({
      orderBy: [{ creeLe: "desc" }, { id: "desc" }],
      include: { societe: true, role: { select: { code: true, nom: true } } },
      skip,
      take
    })
  ]);
  return {
    items: lignes.map(dtoUtilisateur),
    pagination: metaPagination(page, limite, total)
  };
}

export async function creerUtilisateur(data: EntreeUtilisateur) {
  const { username, motDePasseTemporaire, name, email, phone, department, jobTitle, role, status, societeId } =
    data;

  if (!name || !email || !department || !role || !username || !motDePasseTemporaire) {
    throw requeteInvalide(
      "Nom, email, département, identifiant de connexion, mot de passe temporaire et rôle sont obligatoires."
    );
  }
  if (status !== undefined) validerStatut(status);

  const usernameFinal = normaliserUsername(username);
  // Politique de mot de passe : au moins 12 caractères, majuscule,
  // minuscule et chiffre. Le bénéficiaire devra le changer à sa première
  // connexion (doitChangerMdp).
  schemaNouveauMotDePasse.parse(motDePasseTemporaire);

  const existantEmail = await prisma.utilisateur.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existantEmail) {
    throw conflit("Un utilisateur avec cette adresse email existe déjà.");
  }

  const existantUsername = await prisma.utilisateur.findUnique({ where: { username: usernameFinal } });
  if (existantUsername) {
    throw conflit("Un utilisateur avec cet identifiant de connexion existe déjà.");
  }

  const roleId = await resoudreRoleId(role);
  const societeIdFinale = await resoudreSociete(societeId);

  // Le scan inclut les enregistrements archivés (soft delete) : leur
  // référence unique reste réservée et ne doit jamais être réattribuée.
  const referencesExistantes = (
    await prismaSansFiltre.utilisateur.findMany({
      select: { reference: true },
      where: { reference: { startsWith: "usr-" } }
    })
  ).map((u) => u.reference);
  const numero = numeroSuivant(referencesExistantes, /^usr-(\d+)$/);

  const nouveau = await prisma.utilisateur.create({
    data: {
      reference: `usr-${numero}`,
      username: usernameFinal,
      name,
      email,
      phone: phone || "",
      department,
      jobTitle: jobTitle || "Collaborateur",
      motDePasseHash: await hacherMotDePasse(motDePasseTemporaire),
      doitChangerMdp: true,
      roleId,
      status: status || "Actif",
      societeId: societeIdFinale,
      avatarUrl: ""
    },
    include: { societe: true, role: { select: { code: true, nom: true } } }
  });

  return {
    status: 201 as const,
    message: "Utilisateur créé. Communiquez le mot de passe temporaire à son titulaire : il devra le changer à sa première connexion.",
    data: nouveau
  };
}

export async function modifierUtilisateur(idOuReference: string, data: EntreeUtilisateur) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

  if (data.status !== undefined) validerStatut(data.status);

  const donnees: Record<string, unknown> = {};
  let sessionsARevoquer = false;

  if (data.name !== undefined) donnees["name"] = data.name;
  if (data.email !== undefined) donnees["email"] = data.email;
  if (data.phone !== undefined) donnees["phone"] = data.phone;
  if (data.department !== undefined) donnees["department"] = data.department;
  if (data.jobTitle !== undefined) donnees["jobTitle"] = data.jobTitle;
  if (data.role !== undefined) donnees["roleId"] = await resoudreRoleId(data.role);
  if (data.status !== undefined) {
    donnees["status"] = data.status;
    if (data.status !== utilisateur.status) sessionsARevoquer = true;
  }
  if (data.societeId !== undefined) donnees["societeId"] = await resoudreSociete(data.societeId);
  if (data.username !== undefined) {
    const usernameFinal = normaliserUsername(data.username);
    const conflitUsername = await prisma.utilisateur.findFirst({
      where: { username: usernameFinal, NOT: { id: utilisateur.id } }
    });
    if (conflitUsername) {
      throw conflit("Un utilisateur avec cet identifiant de connexion existe déjà.");
    }
    donnees["username"] = usernameFinal;
  }
  // Réinitialisation du mot de passe par un administrateur.
  if (data.motDePasseTemporaire !== undefined && data.motDePasseTemporaire !== "") {
    schemaNouveauMotDePasse.parse(data.motDePasseTemporaire);
    donnees["motDePasseHash"] = await hacherMotDePasse(data.motDePasseTemporaire);
    donnees["doitChangerMdp"] = true;
    sessionsARevoquer = true;
  }

  if (data.status === "Inactif") {
    await verifierDernierSuperAdmin(utilisateur, "désactiver");
  }

  const misAJour = await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: donnees,
    include: { societe: true, role: { select: { code: true, nom: true } } }
  });
  if (sessionsARevoquer) await invaliderSessions(utilisateur.id);

  return { message: "Utilisateur mis à jour avec succès.", data: misAJour };
}

export async function changerStatutUtilisateur(idOuReference: string, statut: string) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");
  validerStatut(statut);

  if (statut === "Inactif") {
    await verifierDernierSuperAdmin(utilisateur, "désactiver");
  }

  const misAJour = await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { status: statut },
    include: { societe: true, role: { select: { code: true, nom: true } } }
  });

  // Un compte désactivé perd immédiatement toutes ses sessions ouvertes.
  if (statut === "Inactif") await invaliderSessions(utilisateur.id);

  return { message: `Statut utilisateur modifié en ${statut}.`, data: misAJour };
}

export async function supprimerUtilisateur(idOuReference: string) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

  await verifierDernierSuperAdmin(utilisateur, "supprimer");

  // Soft delete + révocation immédiate des sessions.
  await prisma.$transaction([
    prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { supprimeLe: new Date(), status: "Inactif" }
    }),
    prisma.session.deleteMany({ where: { utilisateurId: utilisateur.id } })
  ]);
  return { message: "Utilisateur supprimé avec succès." };
}
