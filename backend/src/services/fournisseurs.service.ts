import { prisma } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";

export interface EntreeFournisseur {
  name?: string;
  contact?: string;
  email?: string;
  category?: string;
  qualityScore?: unknown;
  onTimeDelivery?: unknown;
  riskLevel?: string;
}

export async function creerFournisseur(data: EntreeFournisseur) {
  const { name, contact, email, category, qualityScore, onTimeDelivery, riskLevel } = data;

  if (!name || !contact || !email || !category) {
    throw requeteInvalide("Missing required vendor fields.");
  }

  const references = (
    await prisma.fournisseur.findMany({ select: { reference: true }, where: { reference: { startsWith: "v-" } } })
  ).map((f) => f.reference);
  const numero = numeroSuivant(references, /^v-(\d+)$/);

  const nouveau = await prisma.fournisseur.create({
    data: {
      reference: `v-${numero}`,
      name,
      contact,
      email,
      category,
      qualityScore: parseInt(String(qualityScore)) || 90,
      onTimeDelivery: parseInt(String(onTimeDelivery)) || 92,
      activeContracts: 0,
      totalSpend: 0,
      riskLevel: riskLevel || "Low",
      status: "Approved"
    }
  });

  return { message: "Vendor vendor listed.", data: nouveau };
}

export async function noterFournisseur(
  idOuReference: string,
  data: { qualityScore?: unknown; onTimeDelivery?: unknown; riskLevel?: string }
) {
  const fournisseur = await prisma.fournisseur.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
  if (!fournisseur) throw introuvable("Supplier not found.");

  const donnees: Record<string, unknown> = {};
  if (data.qualityScore !== undefined) donnees["qualityScore"] = parseInt(String(data.qualityScore));
  if (data.onTimeDelivery !== undefined) donnees["onTimeDelivery"] = parseInt(String(data.onTimeDelivery));
  if (data.riskLevel !== undefined) {
    donnees["riskLevel"] = data.riskLevel;
    if (data.riskLevel === "High") {
      donnees["status"] = "On Probation";
    } else if (fournisseur.status === "On Probation") {
      donnees["status"] = "Approved";
    }
  }

  const misAJour = await prisma.fournisseur.update({ where: { id: fournisseur.id }, data: donnees });
  return { message: "Vendor attributes updated.", data: misAJour };
}
