import { prisma, prismaSansFiltre } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";

export interface EntreeSociete {
  nom?: string;
  codeCourt?: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  identifiantLegal?: string;
  notes?: string;
}

async function trouverSociete(idOuReference: string) {
  return prisma.societe.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
}

function validerEntree(data: EntreeSociete) {
  if (!data.nom || !data.nom.trim()) {
    throw requeteInvalide("Le nom de la société est obligatoire.");
  }
  if (!data.codeCourt || !data.codeCourt.trim()) {
    throw requeteInvalide("Le code court de la société est obligatoire.");
  }
}

// ── Lectures ──────────────────────────────────────────────────────────

export async function listerSocietes() {
  const societes = await prisma.societe.findMany({
    orderBy: { creeLe: "desc" },
    include: { _count: { select: { utilisateurs: true } } }
  });
  return societes;
}

// ── Création ──────────────────────────────────────────────────────────

export async function creerSociete(data: EntreeSociete) {
  validerEntree(data);
  const codeCourt = data.codeCourt!.trim();

  const codeExistant = await prisma.societe.findUnique({ where: { codeCourt } });
  if (codeExistant) {
    throw requeteInvalide(`Le code court « ${codeCourt} » est déjà utilisé par une autre société.`);
  }

  // Scan incluant les sociétés archivées : leur référence reste réservée.
  const referencesExistantes = (
    await prismaSansFiltre.societe.findMany({ select: { reference: true }, where: { reference: { startsWith: "soc-" } } })
  ).map((s) => s.reference);
  const numero = numeroSuivant(referencesExistantes, /^soc-(\d+)$/);

  const societe = await prisma.societe.create({
    data: {
      reference: `soc-${numero}`,
      nom: data.nom!.trim(),
      codeCourt,
      adresse: data.adresse?.trim() || null,
      ville: data.ville?.trim() || null,
      telephone: data.telephone?.trim() || null,
      email: data.email?.trim() || null,
      identifiantLegal: data.identifiantLegal?.trim() || null,
      notes: data.notes?.trim() || null
    }
  });

  return { status: 201 as const, message: "Société créée avec succès.", data: societe };
}

// ── Mise à jour ───────────────────────────────────────────────────────

export async function modifierSociete(idOuReference: string, data: EntreeSociete) {
  const societe = await trouverSociete(idOuReference);
  if (!societe) throw introuvable("Société introuvable.");

  const donnees: Record<string, unknown> = {};
  if (data.nom !== undefined) {
    if (!data.nom.trim()) throw requeteInvalide("Le nom de la société est obligatoire.");
    donnees["nom"] = data.nom.trim();
  }
  if (data.codeCourt !== undefined) {
    const codeCourt = data.codeCourt.trim();
    if (!codeCourt) throw requeteInvalide("Le code court de la société est obligatoire.");
    if (codeCourt !== societe.codeCourt) {
      const codeExistant = await prisma.societe.findUnique({ where: { codeCourt } });
      if (codeExistant && codeExistant.id !== societe.id) {
        throw requeteInvalide(`Le code court « ${codeCourt} » est déjà utilisé par une autre société.`);
      }
    }
    donnees["codeCourt"] = codeCourt;
  }
  for (const champ of ["adresse", "ville", "telephone", "email", "identifiantLegal", "notes"] as const) {
    if (data[champ] !== undefined) donnees[champ] = data[champ]?.trim() || null;
  }

  const misAJour = await prisma.societe.update({ where: { id: societe.id }, data: donnees });
  return { message: "Société mise à jour avec succès.", data: misAJour };
}

// ── Activation / désactivation ────────────────────────────────────────
// Pas de suppression physique : une société fermée est désactivée.

export async function changerActivationSociete(idOuReference: string, actif: boolean) {
  const societe = await trouverSociete(idOuReference);
  if (!societe) throw introuvable("Société introuvable.");

  const misAJour = await prisma.societe.update({
    where: { id: societe.id },
    data: { actif }
  });
  return {
    message: actif
      ? `La société ${misAJour.nom} est de nouveau active.`
      : `La société ${misAJour.nom} a été désactivée.`,
    data: misAJour
  };
}
