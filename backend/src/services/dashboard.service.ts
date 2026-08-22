import { prisma } from "../lib/prisma.js";

// Agrégat global consommé par le frontend au démarrage.
// Périmètre parc IT uniquement depuis la suppression des modules achats
// (02-plan-convergence.md §1.1) : les clés purchaseOrders, budgets et
// rfqComparisonPools n'existent plus. Depuis le plan v1.2 (chantier 2a),
// la clé vendors est remplacée par societes.
export async function obtenirDonneesGlobales() {
  const [societes, users, stockItems, stockMovements, assignments] = await Promise.all([
    prisma.societe.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.utilisateur.findMany({
      orderBy: { creeLe: "desc" },
      include: { societe: true }
    }),
    prisma.articleStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.affectation.findMany({
      orderBy: { creeLe: "desc" },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    })
  ]);

  return {
    societes,
    users,
    stockItems,
    stockMovements,
    assignments
  };
}
