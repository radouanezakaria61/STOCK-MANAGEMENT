import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { serialiser } from "../src/lib/serialisation.js";

// AGENTS.md règle 4 — sérialiseur unique à la frontière HTTP.
describe("serialiser", () => {
  it("convertit Decimal → number", () => {
    const lu = serialiser({ unitPriceMAD: new Prisma.Decimal("1250.50") }) as Record<string, unknown>;
    expect(lu.unitPriceMAD).toBe(1250.5);
  });

  it("convertit les dates en ISO et tronque les champs « date seule »", () => {
    const lu = serialiser({
      creeLe: new Date("2026-08-23T10:30:00Z"),
      purchaseDate: new Date("2026-01-15T12:00:00Z")
    }) as Record<string, unknown>;
    expect(lu.creeLe).toBe("2026-08-23T10:30:00.000Z");
    expect(lu.purchaseDate).toBe("2026-01-15");
  });

  it("filtre les champs internes jamais exposés", () => {
    const lu = serialiser({
      name: "X",
      motDePasseHash: "$argon2id$…",
      tokenHash: "abc",
      supprimeLe: null,
      modifieLe: new Date()
    }) as Record<string, unknown>;
    expect(Object.keys(lu)).toEqual(["name"]);
  });

  it("derniereConnexion null ⇒ sentinelle « Non connecté », Date ⇒ heure lisible", () => {
    const lu = serialiser({
      a: { derniereConnexion: null },
      b: { derniereConnexion: new Date("2026-08-23T09:05:00Z") }
    }) as Record<string, Record<string, unknown>>;
    expect(lu.a.derniereConnexion).toBe("Non connecté");
    expect(lu.b.derniereConnexion).toBe("2026-08-23 09:05");
  });

  it("traite récursivement tableaux et objets imbriqués", () => {
    const lu = serialiser([
      { prix: new Prisma.Decimal(3), motDePasseHash: "x" },
      {
        liste: [
          { date: new Date("2026-03-01T12:00:00Z"), horodatage: new Date("2026-03-01T12:00:00Z") }
        ]
      }
    ]) as Array<Record<string, unknown>>;
    expect(lu[0]!.prix).toBe(3);
    expect(lu[0]!.motDePasseHash).toBeUndefined();
    const imbrique = lu[1]!.liste as Array<Record<string, unknown>>;
    // « date » est un champ historique « date seule », tronqué même en profondeur…
    expect(imbrique[0]!.date).toBe("2026-03-01");
    // …tandis qu'une clé quelconque reste en ISO complet.
    expect(imbrique[0]!.horodatage).toBe("2026-03-01T12:00:00.000Z");
  });

  it("préserve les valeurs primitives et nulles telles quelles", () => {
    expect(serialiser({ n: null, ok: true, t: "texte", x: 42 })).toEqual({
      n: null,
      ok: true,
      t: "texte",
      x: 42
    });
  });
});
