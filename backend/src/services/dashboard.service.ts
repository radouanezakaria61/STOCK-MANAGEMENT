import { prisma } from "../lib/prisma.js";

// Agrégat global consommé par le frontend au démarrage.
// Périmètre parc IT uniquement depuis la suppression des modules achats
// (02-plan-convergence.md §1.1) : les clés purchaseOrders, budgets et
// rfqComparisonPools n'existent plus. Depuis le plan v1.2 (chantier 2a),
// la clé vendors est remplacée par societes.
//
// H1 (audit du 22/08/2026) : l'annuaire des comptes (`utilisateurs`) est une
// donnée sensible à part — il n'est peuplé QUE pour les détenteurs de la
// permission dédiée `utilisateurs.consulter` (SUPER_ADMIN, IT_MANAGER,
// AUDITOR). Un rôle limité au parc (EMPLOYEE…) reçoit la clé vide : le
// contrat de forme du payload reste stable pour le frontend.
export async function obtenirDonneesGlobales(permissions: ReadonlySet<string>) {
  const annuaireAutorise = permissions.has("utilisateurs.consulter");
  const [societes, utilisateurs, articles, mouvements, affectations] = await Promise.all([
    prisma.societe.findMany({ orderBy: { creeLe: "desc" } }),
    annuaireAutorise
      ? prisma.utilisateur.findMany({
          orderBy: { creeLe: "desc" },
          include: { societe: true, role: { select: { code: true, nom: true } } }
        })
      : Promise.resolve([]),
    prisma.articleStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.affectation.findMany({
      orderBy: { creeLe: "desc" },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    })
  ]);

  // Clés en français comme le modèle (AGENTS.md « Langue des clés ») :
  // societes, utilisateurs, articles, mouvements, affectations.
  return {
    societes,
    utilisateurs,
    articles,
    mouvements,
    affectations
  };
}
