-- Chantier 3 — Invariant élargi : total = disponible + affectée + maintenance.
-- Les unités parties en maintenance (SAV) quittent le compteur « affectée »
-- sans redevenir disponibles ; la contrainte deux compartiments est remplacée.
ALTER TABLE "articles_stock" DROP CONSTRAINT IF EXISTS chk_stock_quantites_coherentes;
ALTER TABLE "articles_stock"
  ADD CONSTRAINT chk_stock_quantites_coherentes
  CHECK (
    "quantite_disponible" >= 0
    AND "quantite_affectee" >= 0
    AND "quantite_maintenance" >= 0
    AND "quantity" = "quantite_disponible" + "quantite_affectee" + "quantite_maintenance"
  );
