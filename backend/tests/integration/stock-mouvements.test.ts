import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma.js";
import { enregistrerMouvement } from "../../src/services/stock.service.js";
import type { ContexteActeur } from "../../src/lib/acteur.js";

// Invariants stock : quantités cohérentes, refus RETURN_QTY_EXCEEDS_ALLOCATED,
// types de mouvement fermés. L'article fixture est SOFT-DELETED après test :
// ses mouvements restent en base (journal immuable côté PostgreSQL).

const MARQUE = `vt-stock-${Date.now()}`;
const acteur: ContexteActeur = {
  utilisateurId: null,
  nomUtilisateur: "vitest",
  adresseIp: null,
  agentUtilisateur: null
};
let articleId = "";

beforeAll(async () => {
  const article = await prisma.articleStock.create({
    data: {
      reference: `VT-${MARQUE}`,
      assetTag: `VTAT${MARQUE}`,
      name: "Article fixture Vitest",
      category: "Consommables & Pièces",
      brand: "VitestBrand",
      model: "VT-100",
      serialNumber: `VTSN${MARQUE}`,
      quantity: 5,
      availableQty: 2,
      allocatedQty: 3,
      maintenanceQty: 0,
      minThreshold: 0,
      unitPriceMAD: new Prisma.Decimal("10.50"),
      totalValueMAD: new Prisma.Decimal("52.50"),
      location: "Local Vitest",
      status: "Affecté"
    }
  });
  articleId = article.id;
});

afterAll(async () => {
  // Règle 3/6 AGENTS.md : l'historique (mouvements) est immuable côté base —
  // le nettoyage passe par le soft delete applicatif de l'article fixture.
  if (articleId !== "") {
    await prisma.articleStock.update({
      where: { id: articleId },
      data: { supprimeLe: new Date(), status: "Supprimé", notes: "fixture vitest purgée" }
    });
  }
  await prisma.notification.deleteMany({ where: { entiteId: MARQUE } });
});

describe("enregistrerMouvement", () => {
  it("refuse un retour supérieur à la quantité affectée (RETURN_QTY_EXCEEDS_ALLOCATED)", async () => {
    try {
      await enregistrerMouvement(
        articleId,
        { type: "Retour Stock", quantity: 5, performedBy: "vitest" },
        acteur
      );
      throw new Error("devait lever");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("RETURN_QTY_EXCEEDS_ALLOCATED");
    }
  });

  it("refuse un type hors liste fermée (400)", async () => {
    try {
      await enregistrerMouvement(
        articleId,
        { type: "Téléportation", quantity: 1 },
        acteur
      );
      throw new Error("devait lever");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(400);
    }
  });

  it("un retour valide met à jour les compteurs et écrit l'historique", async () => {
    await enregistrerMouvement(
      articleId,
      { type: "Retour Stock", quantity: 2, performedBy: "vitest" },
      acteur
    );

    const article = await prisma.articleStock.findUnique({ where: { id: articleId } });
    expect(article!.availableQty).toBe(4);
    expect(article!.allocatedQty).toBe(1);
    expect(article!.quantity).toBe(5); // invariant total inchangé

    const mouvement = await prisma.mouvementStock.findFirst({
      where: { stockItemId: articleId, type: "Retour Stock" },
      orderBy: { creeLe: "desc" }
    });
    expect(mouvement).not.toBeNull();
    expect(mouvement!.quantity).toBe(2);
  });

  it("l'article reste adressable par sa référence métier (idOuReference)", async () => {
    const avant = await prisma.mouvementStock.count({ where: { stockItemId: articleId } });
    const reference = `VT-${MARQUE}`;
    await enregistrerMouvement(
      reference,
      { type: "Ajustement Inventaire", quantity: 1, performedBy: "vitest", notes: "ajout unité" },
      acteur
    );
    const apres = await prisma.mouvementStock.count({ where: { stockItemId: articleId } });
    expect(apres).toBe(avant + 1);
  });
});
