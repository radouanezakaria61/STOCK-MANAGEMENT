import { describe, expect, it } from "vitest";
import { interpreterTrustProxy } from "../src/lib/confiance-proxy.js";

// Cas calqués sur verifier-phase1.ts (section M4) : grammaire Express stricte,
// échec explicite sinon (fail fast au démarrage).
describe("interpreterTrustProxy", () => {
  it("absent ou vide ⇒ aucune confiance", () => {
    expect(interpreterTrustProxy(undefined)).toBe(false);
    expect(interpreterTrustProxy("")).toBe(false);
    expect(interpreterTrustProxy("   ")).toBe(false);
  });

  it("accepte un saut numérique entre 1 et 10", () => {
    expect(interpreterTrustProxy("1")).toBe(1);
    expect(interpreterTrustProxy("3")).toBe(3);
  });

  it("accepte les mots-clés Express et un CIDR", () => {
    expect(interpreterTrustProxy("loopback")).toBe("loopback");
    expect(interpreterTrustProxy("LINKLOCAL")).toBe("linklocal");
    expect(interpreterTrustProxy("uniquelocal")).toBe("uniquelocal");
    expect(interpreterTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(interpreterTrustProxy("192.168.1.10")).toBe("192.168.1.10");
  });

  it("combine les morceaux en liste ordonnée", () => {
    const combo = interpreterTrustProxy("1, loopback");
    expect(Array.isArray(combo)).toBe(true);
    expect(combo).toEqual([1, "loopback"]);
  });

  it("rejette explicitement une valeur non reconnue", () => {
    expect(() => interpreterTrustProxy("banane")).toThrow(/non reconnue/);
    expect(() => interpreterTrustProxy("true")).toThrow();
    expect(() => interpreterTrustProxy("yes")).toThrow();
  });

  it("rejette les bornes invalides (0 saut, 11 sauts, CIDR trop large)", () => {
    expect(() => interpreterTrustProxy("0")).toThrow(/entre 1 et 10/);
    expect(() => interpreterTrustProxy("11")).toThrow(/entre 1 et 10/);
    expect(() => interpreterTrustProxy("10.0.0.0/33")).toThrow(/Préfixe CIDR invalide/);
  });
});
