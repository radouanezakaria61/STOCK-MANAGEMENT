import { describe, expect, it } from "vitest";
import {
  CATEGORIES_MATERIEL,
  schemaActivationSociete,
  schemaChangementStatutUtilisateur,
  schemaCreationArticle,
  schemaFiltresJournalAudit,
  schemaMouvementStock
} from "../src/lib/validation-zod.js";
import { TYPES_MOUVEMENT } from "../src/lib/machine-etats.js";

describe("schemaCreationArticle", () => {
  const valide = { name: "Souris ergonomique", category: "Périphériques & Accessoires" };

  it("accepte un payload minimal", () => {
    const lu = schemaCreationArticle.parse(valide);
    expect(lu.name).toBe("Souris ergonomique");
  });

  it("refuse toute clé supplémentaire (injection de masse impossible)", () => {
    expect(() => schemaCreationArticle.parse({ ...valide, isAdmin: true })).toThrow();
  });

  it("refuse une catégorie hors référentiel", () => {
    expect(() => schemaCreationArticle.parse({ name: "X", category: "Nourriture" })).toThrow();
  });

  it("refuse une quantité négative ou non entière", () => {
    expect(() => schemaCreationArticle.parse({ ...valide, quantity: -1 })).toThrow();
    expect(() => schemaCreationArticle.parse({ ...valide, quantity: 2.5 })).toThrow();
    expect(schemaCreationArticle.parse({ ...valide, quantity: "12" }).quantity).toBe(12);
  });

  it("convertit le montant textuel français (« 1 250,50 MAD »)", () => {
    const montant = schemaCreationArticle.parse({ ...valide, unitPriceMAD: " 1 250,50 MAD " }).unitPriceMAD;
    expect(montant).toBeCloseTo(1250.5, 2);
  });

  it("refuse un montant négatif", () => {
    expect(() => schemaCreationArticle.parse({ ...valide, unitPriceMAD: "-5" })).toThrow(/négatif/);
  });
});

describe("schemaMouvementStock", () => {
  it("accepte un type saisisable et convertit la quantité", () => {
    const lu = schemaMouvementStock.parse({ type: "Retour Stock", quantity: "3" });
    expect(lu.type).toBe(TYPES_MOUVEMENT.RETOUR_STOCK);
    expect(lu.quantity).toBe(3);
  });

  it("refuse un type produit par un flux métier (non saisisable)", () => {
    expect(() =>
      schemaMouvementStock.parse({ type: TYPES_MOUVEMENT.ENVOI_MAINTENANCE })
    ).toThrow(/Type de mouvement inconnu/);
    expect(() => schemaMouvementStock.parse({ type: "Téléportation" })).toThrow();
  });

  it("refuse une clé inconnue et une quantité nulle", () => {
    expect(() => schemaMouvementStock.parse({ type: "Retour Stock", extra: 1 })).toThrow();
    expect(() => schemaMouvementStock.parse({ type: "Retour Stock", quantity: 0 })).toThrow();
  });
});

describe("schémas société / utilisateur / audit", () => {
  it("schemaActivationSociete exige un booléen strict", () => {
    expect(schemaActivationSociete.parse({ actif: true }).actif).toBe(true);
    expect(() => schemaActivationSociete.parse({ actif: "oui" })).toThrow(/vrai ou faux/);
    expect(() => schemaActivationSociete.parse({ actif: true, extra: 1 })).toThrow();
  });

  it("schemaChangementStatutUtilisateur ferme la liste des statuts", () => {
    expect(schemaChangementStatutUtilisateur.parse({ status: "Actif" }).status).toBe("Actif");
    expect(() => schemaChangementStatutUtilisateur.parse({ status: "SuperAdmin" })).toThrow(
      /Actif.*Inactif|Inactif.*Actif/
    );
  });

  it("schemaFiltresJournalAudit convertit la pagination en chaînes et plafonne la limite", () => {
    const lu = schemaFiltresJournalAudit.parse({ page: "2" });
    expect(lu.page).toBe(2);
    expect(lu.limite).toBe(50);
    expect(() => schemaFiltresJournalAudit.parse({ limite: "300" })).toThrow(/200/);
    expect(() => schemaFiltresJournalAudit.parse({ dateDebut: "23/08/2026" })).toThrow(/AAAA-MM-JJ/);
  });

  it("le référentiel catégories est fermé et cohérent", () => {
    expect(CATEGORIES_MATERIEL).toContain("Laptops & Portables");
    expect(new Set(CATEGORIES_MATERIEL).size).toBe(CATEGORIES_MATERIEL.length);
  });
});
