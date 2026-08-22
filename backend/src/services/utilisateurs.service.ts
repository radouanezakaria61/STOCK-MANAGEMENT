import { prisma } from "../lib/prisma.js";
import { conflit, introuvable, requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";

// Rôles applicatifs après le retrait des rôles achats (plan v1.2 §3.2).
// Le RBAC serveur fin remplace ce simple contrôle au chantier 2.
const ROLES_AUTORISES = ["ADMIN", "AUDITOR", "UTILISATEUR"] as const;

const STATUTS_AUTORISES = ["Actif", "Inactif"] as const;

function validerRole(role: string): void {
  if (!ROLES_AUTORISES.includes(role as (typeof ROLES_AUTORISES)[number])) {
    throw requeteInvalide(
      `Rôle non reconnu : « ${role} ». Rôles acceptés : ${ROLES_AUTORISES.join(", ")}.`
    );
  }
}

function validerStatut(statut: string): void {
  if (!STATUTS_AUTORISES.includes(statut as (typeof STATUTS_AUTORISES)[number])) {
    throw requeteInvalide(
      `Statut non reconnu : « ${statut} ». Statuts acceptés : ${STATUTS_AUTORISES.join(", ")}.`
    );
  }
}

export interface EntreeUtilisateur {
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

export async function listerUtilisateurs() {
  const utilisateurs = await prisma.utilisateur.findMany({
    orderBy: { creeLe: "desc" },
    include: { societe: true }
  });
  return utilisateurs;
}

export async function creerUtilisateur(data: EntreeUtilisateur) {
  const { name, email, phone, department, jobTitle, role, status, societeId } = data;

  if (!name || !email || !department || !role) {
    throw requeteInvalide("Nom, email, département et rôle sont obligatoires.");
  }
  validerRole(role);
  if (status !== undefined) validerStatut(status);

  // Unicité d'email (contrôle insensible à la casse, comme l'existant)
  const existant = await prisma.utilisateur.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existant) {
    throw conflit("Un utilisateur avec cette adresse email existe déjà.");
  }

  const societeIdFinale = await resoudreSociete(societeId);

  const referencesExistantes = (
    await prisma.utilisateur.findMany({ select: { reference: true }, where: { reference: { startsWith: "usr-" } } })
  ).map((u) => u.reference);
  const numero = numeroSuivant(referencesExistantes, /^usr-(\d+)$/);

  const nouveau = await prisma.utilisateur.create({
    data: {
      reference: `usr-${numero}`,
      name,
      email,
      phone: phone || "",
      department,
      jobTitle: jobTitle || "Collaborateur",
      role,
      status: status || "Actif",
      societeId: societeIdFinale,
      avatarUrl: ""
    }
  });

  return { status: 201 as const, message: "Utilisateur créé avec succès.", data: nouveau };
}

export async function modifierUtilisateur(idOuReference: string, data: EntreeUtilisateur) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

  const donnees: Record<string, unknown> = {};
  if (data.role !== undefined) validerRole(data.role);
  if (data.status !== undefined) validerStatut(data.status);
  if (data.name !== undefined) donnees["name"] = data.name;
  if (data.email !== undefined) donnees["email"] = data.email;
  if (data.phone !== undefined) donnees["phone"] = data.phone;
  if (data.department !== undefined) donnees["department"] = data.department;
  if (data.jobTitle !== undefined) donnees["jobTitle"] = data.jobTitle;
  if (data.role !== undefined) donnees["role"] = data.role;
  if (data.status !== undefined) donnees["status"] = data.status;
  if (data.societeId !== undefined)
    donnees["societeId"] = await resoudreSociete(data.societeId);

  const misAJour = await prisma.utilisateur.update({ where: { id: utilisateur.id }, data: donnees });
  return { message: "Utilisateur mis à jour avec succès.", data: misAJour };
}

export async function changerStatutUtilisateur(idOuReference: string, statut: string) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");
  validerStatut(statut);

  // Empêche la désactivation du dernier administrateur actif
  if (utilisateur.role === "ADMIN" && statut !== "Actif") {
    const adminsActifs = await prisma.utilisateur.count({
      where: { role: "ADMIN", status: "Actif" }
    });
    if (adminsActifs <= 1) {
      throw requeteInvalide(
        "Impossible de désactiver le seul administrateur actif du système."
      );
    }
  }

  const misAJour = await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { status: statut }
  });
  return { message: `Statut utilisateur modifié en ${statut}.`, data: misAJour };
}

export async function supprimerUtilisateur(idOuReference: string) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

  if (utilisateur.role === "ADMIN") {
    const admins = await prisma.utilisateur.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw requeteInvalide("Impossible de supprimer le seul compte administrateur.");
    }
  }

  // Soft delete : l'historique et les références restent intacts.
  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { supprimeLe: new Date(), status: "Inactif" }
  });
  return { message: "Utilisateur supprimé avec succès." };
}
