import { prisma } from "../lib/prisma.js";

export async function obtenirDonneesGlobales() {
  const [
    vendors,
    purchaseOrders,
    budgets,
    rfqComparisonPools,
    users,
    stockItems,
    stockMovements,
    assignments
  ] = await Promise.all([
    prisma.fournisseur.findMany({ orderBy: { seq: "desc" } }),
    prisma.bonCommande.findMany({
      orderBy: { seq: "desc" },
      include: { items: { orderBy: { id: "asc" } } }
    }),
    prisma.budget.findMany({ orderBy: { seq: "asc" } }),
    prisma.appelOffres.findMany({
      orderBy: { seq: "desc" },
      include: { bids: { orderBy: { id: "asc" } } }
    }),
    prisma.utilisateur.findMany({ orderBy: { seq: "desc" } }),
    prisma.articleStock.findMany({ orderBy: { seq: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { seq: "desc" } }),
    prisma.affectation.findMany({
      orderBy: { seq: "desc" },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    })
  ]);

  return {
    vendors,
    purchaseOrders,
    budgets,
    rfqComparisonPools,
    users,
    stockItems,
    stockMovements,
    assignments
  };
}
