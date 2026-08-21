import { prisma } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { dateDans, dateDuJour } from "../lib/ids.js";

export interface LigneCommandeEntree {
  desc: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface EntreeBonCommande {
  title?: string;
  vendorId?: string;
  amount?: unknown;
  department?: string;
  requester?: string;
  items?: LigneCommandeEntree[];
  notes?: string;
}

export async function creerBonCommande(data: EntreeBonCommande) {
  const { title, vendorId, amount, department, requester, items, notes } = data;

  if (!title || !vendorId || !amount || !department || !requester) {
    throw requeteInvalide("Missing required fields for PO creation.");
  }

  const vendor = await prisma.fournisseur.findUnique({ where: { id: vendorId } });
  if (!vendor) throw introuvable("Selected supplier not found.");

  // Score d'audit : risque fournisseur, montant élevé, qualité insuffisante
  let auditScore = 100;
  if (vendor.riskLevel === "High") auditScore -= 30;
  if (vendor.riskLevel === "Medium") auditScore -= 15;
  if (Number(amount) > 50000) auditScore -= 10;
  if (vendor.qualityScore < 85) auditScore -= 10;

  const count = await prisma.bonCommande.count();
  const montant = parseFloat(String(amount));

  const nouveau = await prisma.$transaction(async (tx) => {
    const bc = await tx.bonCommande.create({
      data: {
        id: `PO-2026-00${count + 1}`,
        title,
        vendorId,
        vendorName: vendor.name,
        amount: montant,
        category: vendor.category,
        department,
        requester,
        status: "Pending Approval",
        createdDate: dateDuJour(),
        deliveryDate: dateDans(30),
        auditScore,
        notes: notes || "",
        items: { create: items || [] }
      },
      include: { items: true }
    });

    // Imputation budgétaire : mise à jour ou création du budget du département.
    // Écrites dans la même transaction que le bon de commande (01architecture.md §1.1).
    const budgetExistant = await tx.budget.findUnique({ where: { name: department } });
    if (budgetExistant) {
      await tx.budget.update({
        where: { name: department },
        data: { spent: { increment: montant } }
      });
    } else {
      const derniereSeq = await tx.budget.aggregate({ _max: { seq: true } });
      await tx.budget.create({
        data: {
          name: department,
          allocated: 100000,
          spent: montant,
          seq: (derniereSeq._max.seq ?? 0) + 1
        }
      });
    }

    await tx.fournisseur.update({
      where: { id: vendorId },
      data: { totalSpend: { increment: montant } }
    });

    return bc;
  });

  return { message: "Purchase Order created.", data: nouveau };
}

const STATUTS_SORTIE_BUDGET = ["Declined", "Cancelled"];

export async function changerStatutBonCommande(id: string, statut: string) {
  const misAJour = await prisma.$transaction(async (tx) => {
    const po = await tx.bonCommande.findUnique({ where: { id }, include: { items: true } });
    if (!po) throw introuvable("Purchase Order not found.");

    const ancienStatut = po.status;

    // Sortie du budget si rejet / annulation
    if (STATUTS_SORTIE_BUDGET.includes(statut) && !STATUTS_SORTIE_BUDGET.includes(ancienStatut)) {
      const budgetObj = await tx.budget.findUnique({ where: { name: po.department } });
      if (budgetObj) {
        await tx.budget.update({
          where: { name: po.department },
          data: { spent: Math.max(0, budgetObj.spent - po.amount) }
        });
      }
      if (po.vendorId) {
        const vendor = await tx.fournisseur.findUnique({ where: { id: po.vendorId } });
        if (vendor) {
          await tx.fournisseur.update({
            where: { id: vendor.id },
            data: { totalSpend: Math.max(0, vendor.totalSpend - po.amount) }
          });
        }
      }
    } else if (STATUTS_SORTIE_BUDGET.includes(ancienStatut)) {
      // Réactivation : réimputation du budget
      if (statut === "Approved" || statut === "Pending Approval") {
        const budgetObj = await tx.budget.findUnique({ where: { name: po.department } });
        if (budgetObj) {
          await tx.budget.update({
            where: { name: po.department },
            data: { spent: budgetObj.spent + po.amount }
          });
        }
        if (po.vendorId) {
          const vendor = await tx.fournisseur.findUnique({ where: { id: po.vendorId } });
          if (vendor) {
            await tx.fournisseur.update({
              where: { id: vendor.id },
              data: { totalSpend: vendor.totalSpend + po.amount }
            });
          }
        }
      }
    }

    return tx.bonCommande.update({
      where: { id },
      data: { status: statut },
      include: { items: true }
    });
  });

  return { message: "PO status updated successfully.", data: misAJour };
}

// Lecture partagée (utilisée par l'import de stock côté service Stock)
export async function trouverBonCommande(id: string) {
  return prisma.bonCommande.findUnique({ where: { id }, include: { items: true } });
}

export async function marquerCommeLivre(id: string) {
  await prisma.bonCommande.update({ where: { id }, data: { status: "Fulfilled" } });
}
