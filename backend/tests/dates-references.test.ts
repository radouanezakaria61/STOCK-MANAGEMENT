import { describe, expect, it } from "vitest";
import {
  dateDuJour,
  pad3,
  referenceAleatoire,
  versDate
} from "../src/lib/ids.js";
import { ErreurMetier } from "../src/lib/erreurs.js";

describe("versDate", () => {
  it("convertit AAAA-MM-JJ en Date à midi UTC", () => {
    const d = versDate("2026-08-23");
    expect(d).toEqual(new Date("2026-08-23T12:00:00Z"));
  });

  it("absent ou vide ⇒ undefined (aucune date fournie)", () => {
    expect(versDate(undefined)).toBeUndefined();
    expect(versDate(null)).toBeUndefined();
    expect(versDate("")).toBeUndefined();
  });

  it("une valeur fournie mais invalide lève DATE_INVALIDE (400) — plus de bascule silencieuse", () => {
    for (const brut of ["15/01/2026", "2026-02-30", "pas-une-date", "20260823"]) {
      let attrape: unknown;
      try {
        versDate(brut);
      } catch (e) {
        attrape = e;
      }
      expect(attrape).toBeInstanceOf(ErreurMetier);
      expect((attrape as ErreurMetier).status).toBe(400);
      expect((attrape as ErreurMetier).code).toBe("DATE_INVALIDE");
    }
  });
});

describe("dateDuJour / pad3", () => {
  it("dateDuJour respecte le format ISO court", () => {
    expect(dateDuJour()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("pad3 complète sur trois chiffres", () => {
    expect(pad3(7)).toBe("007");
    expect(pad3(42)).toBe("042");
    expect(pad3(123)).toBe("123");
  });
});

// M5 (Phase 1) : suffixe cryptographique — deux créations dans la même
// milliseconde ne peuvent plus entrer en collision.
describe("referenceAleatoire", () => {
  it("respecte le motif PREFIXE-HEX8", () => {
    expect(referenceAleatoire("SN")).toMatch(/^SN-[0-9A-F]{8}$/);
    expect(referenceAleatoire("IT-TEL")).toMatch(/^IT-TEL-[0-9A-F]{8}$/);
  });

  it("honore le paramètre octets", () => {
    expect(referenceAleatoire("STK", 8)).toMatch(/^STK-[0-9A-F]{16}$/);
  });

  it("1000 tirages consécutifs sont tous distincts", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 1000; i++) vus.add(referenceAleatoire("VT"));
    expect(vus.size).toBe(1000);
  });
});
