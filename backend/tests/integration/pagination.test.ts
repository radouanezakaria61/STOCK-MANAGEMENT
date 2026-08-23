import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma.js";
import { listerStock, listerMouvements } from "../../src/services/stock.service.js";
import { listerUtilisateurs } from "../../src/services/utilisateurs.service.js";
import { listerAffectations } from "../../src/services/affectations.service.js";
import {
  bornerPagination,
  LIMITE_MAXIMALE,
  metaPagination,
  schemaPagination
} from "../../src/lib/pagination.js";

// Priorité 2 — contrat de pagination commun à toutes les listes :
// { items, pagination: { page, limite, total, pages } }, ordre déterministe
// (creeLe desc, id desc), plafond serveur à 200 lignes.

const MARQUE = `vt-pag-${Date.now()}`;
const idsArticles: string[] = [];

beforeAll(async () => {
  for (let i = 0; i < 7; i++) {
    const article = await prisma.articleStock.create({
      data: {
        reference: `${MARQUE}-${i}`,
        assetTag: `AT${MARQUE}${i}`,
        name: `Fixture pagination ${i}`,
        category: "Consommables & Pièces",
        brand: "VitestBrand",
        model: "VT-PAG",
        serialNumber: `SN${MARQUE}${i}`,
        quantity: 1,
        availableQty: 1,
        allocatedQty: 0,
        minThreshold: 0,
        unitPriceMAD: new Prisma.Decimal(1),
        totalValueMAD: new Prisma.Decimal(1),
        location: "Local Vitest",
        status: "En Stock"
      }
    });
    idsArticles.push(article.id);
  }
});

afterAll(async () => {
  // Les fixtures n'ont aucun mouvement : soft delete suffisant et propre.
  await prisma.articleStock.updateMany({
    where: { id: { in: idsArticles } },
    data: { supprimeLe: new Date(), status: "Supprimé", notes: "fixture vitest purgée" }
  });
});

describe("contrat de pagination", () => {
  it("schemaPagination convertit les chaînes de requête et applique les défauts", () => {
    expect(schemaPagination.parse({})).toEqual({ page: 1, limite: 50 });
    expect(schemaPagination.parse({ page: "3", limite: "25" })).toEqual({ page: 3, limite: 25 });
    expect(() => schemaPagination.parse({ page: "0" })).toThrow();
    expect(() => schemaPagination.parse({ limite: "201" })).toThrow(/200/);
  });

  it("bornerPagination résiste aux appels internes partiels ou aberrants", () => {
    expect(bornerPagination()).toEqual({ page: 1, limite: 50, skip: 0, take: 50 });
    expect(bornerPagination({ page: -5, limite: 99999 })).toEqual({
      page: 1,
      limite: LIMITE_MAXIMALE,
      skip: 0,
      take: LIMITE_MAXIMALE
    });
  });

  it("metaPagination calcule des pages cohérentes (jamais zéro)", () => {
    expect(metaPagination(1, 50, 0)).toEqual({ page: 1, limite: 50, total: 0, pages: 1 });
    expect(metaPagination(2, 10, 41).pages).toBe(5);
  });
});

describe("listerStock paginé", () => {
  it("renvoie exactement « limite » items par page dans l'ordre déterministe", async () => {
    const page1 = await listerStock({ page: 1, limite: 3 });
    const page2 = await listerStock({ page: 2, limite: 3 });

    expect(page1.items).toHaveLength(3);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(7);
    expect(page1.pagination.pages).toBe(Math.ceil(page1.pagination.total / 3));

    // Ordre stable : deux lectures successives donnent les mêmes ids.
    const relecture = await listerStock({ page: 1, limite: 3 });
    expect(page1.items.map((a) => a.id)).toEqual(relecture.items.map((a) => a.id));

    // Pages disjointes (id est unique, un même article ne peut pas chevaucher).
    const idsP1 = new Set(page1.items.map((a) => a.id));
    for (const a of page2.items) expect(idsP1.has(a.id)).toBe(false);
  });

  it("les articles soft-deleted n'apparaissent jamais", async () => {
    const tout = await listerStock({ page: 1, limite: LIMITE_MAXIMALE });
    expect(tout.items.some((a) => a.reference.startsWith(MARQUE))).toBe(true);
    await prisma.articleStock.update({
      where: { reference: `${MARQUE}-0` },
      data: { supprimeLe: new Date() }
    });
    const apres = await listerStock({ page: 1, limite: LIMITE_MAXIMALE });
    expect(apres.items.some((a) => a.reference === `${MARQUE}-0`)).toBe(false);
  });
});

describe("listerMouvements / listerUtilisateurs / listerAffectations paginés", () => {
  it("listerMouvements respecte le contrat {items, pagination}", async () => {
    const page = await listerMouvements({ page: 1, limite: 5 });
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.pagination.limite).toBe(5);
  });

  it("listerUtilisateurs expose le DTO allowlist (aucun hash, aucune colonne interne)", async () => {
    const page = await listerUtilisateurs({ page: 1, limite: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const u of page.items) {
      expect(u).not.toHaveProperty("motDePasseHash");
      expect(u).not.toHaveProperty("tokenHash");
      expect(u).not.toHaveProperty("supprimeLe");
      expect(u).not.toHaveProperty("modifieLe");
      expect(u.role).toHaveProperty("code");
      expect(typeof u.doitChangerMdp).toBe("boolean");
    }
  });

  it("listerAffectations masque les secrets SIM sur chaque fiche", async () => {
    const page = await listerAffectations({ page: 1, limite: 20 });
    for (const fiche of page.items) {
      expect(fiche.simPin).toBeUndefined();
      expect(JSON.stringify(fiche)).not.toMatch(/simPinChiffre/i);
    }
  });
});
