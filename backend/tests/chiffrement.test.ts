import { describe, expect, it } from "vitest";
import { chiffrer, dechiffrer } from "../src/lib/chiffrement.js";

// Chantier 3.5 (P1.4) — AES-256-GCM. La clé provient de backend/.env
// via `dotenv/config` (setupFiles du vitest.config.ts).
describe("chiffrement PIN/PUK", () => {
  it("boucle chiffrer → déchiffrer restitue la valeur d'origine", () => {
    const clair = "PIN-1234-éèàç";
    const chiffre = chiffrer(clair);
    expect(chiffre).toMatch(/^enc-v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(dechiffrer(chiffre)).toBe(clair);
  });

  it("deux chiffrements de la même valeur produisent des textes différents (nonce unique)", () => {
    const a = chiffrer("valeur-fixe");
    const b = chiffrer("valeur-fixe");
    expect(a).not.toBe(b);
    expect(dechiffrer(a)).toBe("valeur-fixe");
    expect(dechiffrer(b)).toBe("valeur-fixe");
  });

  it("une valeur corrompue est rejetée (tag GCM invalide) et jamais masquée", () => {
    const chiffre = chiffrer("secret-sim");
    const corrompu = `${chiffre.slice(0, -4)}AAAA`;
    expect(() => dechiffrer(corrompu)).toThrow();
  });

  it("les valeurs héritées en clair (sans préfixe) passent en transparence", () => {
    expect(dechiffrer("pin-clair-heritage")).toBe("pin-clair-heritage");
  });

  it("null, undefined et chaîne vide ⇒ null", () => {
    expect(chiffrer(null)).toBeNull();
    expect(chiffrer(undefined)).toBeNull();
    expect(chiffrer("")).toBeNull();
    expect(dechiffrer(null)).toBeNull();
    expect(dechiffrer("")).toBeNull();
  });

  it("une valeur malformée avec préfixe lève une erreur explicite", () => {
    expect(() => dechiffrer("enc-v1:incomplet")).toThrow(/malformée/);
  });
});
