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
    prisma.fournisseur.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.bonCommande.findMany({
      orderBy: { creeLe: "desc" },
      include: { items: { orderBy: { id: "asc" } } }
    }),
    prisma.budget.findMany({ orderBy: { creeLe: "asc" } }),
    prisma.appelOffres.findMany({
      orderBy: { creeLe: "desc" },
      include: { bids: { orderBy: { creeLe: "asc" } } }
    }),
    prisma.utilisateur.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.articleStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.affectation.findMany({
      orderBy: { creeLe: "desc" },
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
