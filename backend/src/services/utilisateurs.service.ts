import { prisma } from "../lib/prisma.js";
import { conflit, introuvable, requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";

// Matrice des permissions par défaut selon le rôle (héritée de l'existant).
// Remplacée par le RBAC serveur au chantier 2 — ne pas étendre.
const PERMISSIONS_DEFAUT: Record<string, Record<string, boolean>> = {
  ADMIN: {
    canCreatePO: true,
    canApprovePO: true,
    canManageVendors: true,
    canEvaluateBids: true,
    canGenerateContracts: true,
    canManageUsers: true,
    canViewBudgets: true
  },
  PROCUREMENT_MANAGER: {
    canCreatePO: true,
    canApprovePO: true,
    canManageVendors: true,
    canEvaluateBids: true,
    canGenerateContracts: true,
    canManageUsers: false,
    canViewBudgets: true
  },
  BUYER: {
    canCreatePO: true,
    canApprovePO: false,
    canManageVendors: false,
    canEvaluateBids: true,
    canGenerateContracts: false,
    canManageUsers: false,
    canViewBudgets: true
  },
  AUDITOR: {
    canCreatePO: false,
    canApprovePO: false,
    canManageVendors: false,
    canEvaluateBids: false,
    canGenerateContracts: false,
    canManageUsers: false,
    canViewBudgets: true
  }
};

export interface EntreeUtilisateur {
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  role?: string;
  status?: string;
  spendingLimitMAD?: unknown;
  permissions?: Record<string, boolean>;
}

function plafondParDefaut(role: string): number {
  if (role === "ADMIN") return 1000000;
  if (role === "PROCUREMENT_MANAGER") return 300000;
  return 50000;

}

async function trouverUtilisateur(idOuReference: string) {
  return prisma.utilisateur.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
}

export async function listerUtilisateurs() {
  const utilisateurs = await prisma.utilisateur.findMany({ orderBy: { creeLe: "desc" } });
  return utilisateurs;
}

export async function creerUtilisateur(data: EntreeUtilisateur) {
  const {
    name,
    email,
    phone,
    department,
    jobTitle,
    role,
    status,
    spendingLimitMAD,
    permissions
  } = data;

  if (!name || !email || !department || !role) {
    throw requeteInvalide("Nom, email, département et rôle sont obligatoires.");
  }

  // Unicité d'email (contrôle insensible à la casse, comme l'existant)
  const existant = await prisma.utilisateur.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existant) {
    throw conflit("Un utilisateur avec cette adresse email existe déjà.");
  }

  const roleFinal = role || "BUYER";
  const permissionsFinales =
    permissions ||
    PERMISSIONS_DEFAUT[roleFinal] ||
    PERMISSIONS_DEFAUT["BUYER"]!;

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
      jobTitle: jobTitle || "Collaborateur Achats",
      role: roleFinal,
      status: status || "Actif",
      spendingLimitMAD:
        spendingLimitMAD !== undefined ? Number(spendingLimitMAD) : plafondParDefaut(roleFinal),
      permissions: permissionsFinales,
      avatarUrl: ""
    }
  });

  return { status: 201 as const, message: "Utilisateur créé avec succès.", data: nouveau };
}

export async function modifierUtilisateur(idOuReference: string, data: EntreeUtilisateur) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

  const donnees: Record<string, unknown> = {};
  if (data.name !== undefined) donnees["name"] = data.name;
  if (data.email !== undefined) donnees["email"] = data.email;
  if (data.phone !== undefined) donnees["phone"] = data.phone;
  if (data.department !== undefined) donnees["department"] = data.department;
  if (data.jobTitle !== undefined) donnees["jobTitle"] = data.jobTitle;
  if (data.role !== undefined) donnees["role"] = data.role;
  if (data.status !== undefined) donnees["status"] = data.status;
  if (data.spendingLimitMAD !== undefined)
    donnees["spendingLimitMAD"] = Number(data.spendingLimitMAD);
  if (data.permissions !== undefined) {
    const actuelles = utilisateur.permissions as Record<string, boolean>;
    donnees["permissions"] = { ...actuelles, ...data.permissions };
  }

  const misAJour = await prisma.utilisateur.update({ where: { id: utilisateur.id }, data: donnees });
  return { message: "Utilisateur mis à jour avec succès.", data: misAJour };
}

export async function changerStatutUtilisateur(idOuReference: string, statut: string) {
  const utilisateur = await trouverUtilisateur(idOuReference);
  if (!utilisateur) throw introuvable("Utilisateur introuvable.");

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
