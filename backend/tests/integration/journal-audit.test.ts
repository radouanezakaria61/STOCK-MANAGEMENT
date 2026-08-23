import { describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { listerJournal } from "../../src/services/audit.service.js";

// H4 (Phase 1) — le journal d'audit reste en écriture seule (AGENTS.md règle 3)
// et sa lecture est paginée côté serveur avec un ordre déterministe.

describe("immutabilité du journal d'audit", () => {
  it("tout UPDATE direct en base est rejeté par le déclencheur PostgreSQL", async () => {
    const entree = await prisma.journalAudit.findFirst({ select: { id: true } });
    expect(entree).not.toBeNull();
    await expect(
      prisma.$executeRaw`UPDATE journal_audit SET details = '"falsifié"' WHERE id = ${entree!.id}::uuid`
    ).rejects.toThrow();
  });
});

describe("listerJournal — pagination serveur", () => {
  it("renvoie au plus « limite » entrées et des métadonnées exactes", async () => {
    const page = await listerJournal({ page: 1, limite: 3 });
    expect(page.items.length).toBeLessThanOrEqual(3);
    expect(page.pagination).toEqual({
      page: 1,
      limite: 3,
      total: page.pagination.total,
      pages: Math.max(1, Math.ceil(page.pagination.total / 3))
    });
    if (page.pagination.total > 3) {
      expect(page.items).toHaveLength(3);
    }
  });

  it("l'ordre est déterministe : deux appels identiques, mêmes résultats", async () => {
    const a = await listerJournal({ page: 1, limite: 5 });
    const b = await listerJournal({ page: 1, limite: 5 });
    expect(a.items.map((x) => x.id)).toEqual(b.items.map((x) => x.id));
  });

  it("une page hors bornes renvoie une liste vide sans erreur", async () => {
    const vide = await listerJournal({ page: 999_999, limite: 10 });
    expect(vide.items).toEqual([]);
  });

  it("le filtre action est normalisé en majuscules", async () => {
    const majuscule = await listerJournal({ action: "LOGIN", limite: 5 });
    const minuscule = await listerJournal({ action: "login", limite: 5 });
    expect(majuscule.pagination.total).toBe(minuscule.pagination.total);
  });

  it("les entrées restituées n'exposent jamais agentUtilisateur", async () => {
    const page = await listerJournal({ limite: 10 });
    for (const item of page.items) {
      expect(item).not.toHaveProperty("agentUtilisateur");
      expect(item).not.toHaveProperty("motDePasseHash");
    }
  });
});
