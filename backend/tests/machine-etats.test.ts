import { describe, expect, it } from "vitest";
import {
  ETATS_MATERIEL_CONSTATES,
  LISTE_ETATS_CONSTATES,
  STATUTS_MATERIEL,
  TYPES_MOUVEMENT,
  estEtatDegrade,
  exigerTransition
} from "../src/lib/machine-etats.js";
import { ErreurMetier } from "../src/lib/erreurs.js";

// Chantier 3 (point 15) — la seule porte de modification des statuts matériel.
describe("exigerTransition", () => {
  it("autorise les transitions légales", () => {
    expect(exigerTransition(STATUTS_MATERIEL.DISPONIBLE, STATUTS_MATERIEL.AFFECTE)).toBe(
      "Affecté"
    );
    expect(
      exigerTransition(STATUTS_MATERIEL.AFFECTE, STATUTS_MATERIEL.MAINTENANCE)
    ).toBe("En Maintenance");
    expect(exigerTransition(STATUTS_MATERIEL.MAINTENANCE, STATUTS_MATERIEL.DISPONIBLE)).toBe(
      "En Stock"
    );
  });

  it("autorise de rester dans le même état (idempotence)", () => {
    expect(exigerTransition("En Stock", "En Stock")).toBe("En Stock");
  });

  it("refuse une transition illégale avec INVALID_STATUS_TRANSITION (409)", () => {
    try {
      exigerTransition(STATUTS_MATERIEL.REFORME, STATUTS_MATERIEL.DISPONIBLE);
      throw new Error("devait lever");
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurMetier);
      const err = e as ErreurMetier;
      expect(err.status).toBe(409);
      expect(err.code).toBe("INVALID_STATUS_TRANSITION");
    }
  });

  it("« Rebut / Fin de vie » et « Supprimé » sont des états terminaux", () => {
    for (const terminal of [STATUTS_MATERIEL.REFORME, STATUTS_MATERIEL.SUPPRIME]) {
      for (const cible of Object.values(STATUTS_MATERIEL)) {
        if (cible === terminal) continue;
        try {
          exigerTransition(terminal, cible);
          throw new Error(`devait lever : ${terminal} → ${cible}`);
        } catch (e) {
          expect((e as ErreurMetier).code).toBe("INVALID_STATUS_TRANSITION");
        }
      }
    }
  });
});

describe("états constatés & types de mouvement", () => {
  it("les états dégradés interdisent le retour automatique en stock", () => {
    expect(estEtatDegrade(ETATS_MATERIEL_CONSTATES.ENDOMMAGE)).toBe(true);
    expect(estEtatDegrade(ETATS_MATERIEL_CONSTATES.HORS_SERVICE)).toBe(true);
    expect(estEtatDegrade(ETATS_MATERIEL_CONSTATES.BON_ETAT)).toBe(false);
    expect(LISTE_ETATS_CONSTATES).toHaveLength(4);
  });

  it("la source de vérité des types de mouvement compte sept entrées", () => {
    expect(Object.values(TYPES_MOUVEMENT)).toHaveLength(7);
    expect(Object.values(TYPES_MOUVEMENT)).toContain("Ajustement Inventaire");
  });
});
