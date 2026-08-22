-- Chantier 3 — Contraintes de cohérence, unicités conditionnelles et
-- immuabilité des journaux (AGENTS.md règles 3 et 6).

-- ── Cohérence des quantités de stock ──────────────────────────────────────
-- Invariant métier : total = disponible + affecté, jamais négatif. La base
-- refuse désormais toute écriture qui violerait l'invariant, même en cas de
-- course concurrente mal verrouillée (dernière ligne de défense).
ALTER TABLE "articles_stock"
  ADD CONSTRAINT chk_stock_quantites_coherentes
  CHECK (
    "quantite_disponible" >= 0
    AND "quantite_affectee" >= 0
    AND "quantity" = "quantite_disponible" + "quantite_affectee"
  );

ALTER TABLE "articles_stock"
  ADD CONSTRAINT chk_stock_seuil_positif
  CHECK ("seuil_minimum" >= 0);

-- ── Unicités conditionnelles ──────────────────────────────────────────────
-- L'IMEI d'un smartphone affecté est unique dès qu'il est renseigné ; les
-- fiches sans IMEI coexistent sans contrainte.
CREATE UNIQUE INDEX "uq_affectation_imei"
  ON "affectations" ("appareil_imei")
  WHERE "appareil_imei" IS NOT NULL AND "appareil_imei" <> '';

-- Le numéro de série d'un article est unique dès qu'il est renseigné.
CREATE UNIQUE INDEX "uq_article_numero_serie"
  ON "articles_stock" ("numero_serie")
  WHERE "numero_serie" IS NOT NULL AND "numero_serie" <> '';

-- Déduplication des alertes persistantes : une seule notification OUVERTE
-- par (type, entité). Les résolutions rouvrent la porte à une nouvelle
-- occurrence. Garantit l'anti-doublon même sous concurrence.
CREATE UNIQUE INDEX "uq_notification_alerte_ouverte"
  ON "notifications" ("type", "entite_id")
  WHERE "statut" = 'OUVERTE' AND "entite_id" IS NOT NULL;

-- ── Immuabilité des journaux (écriture seule) ─────────────────────────────
-- Aucun UPDATE ni DELETE ne passe, sauf si la session a explicitement posé
-- `app.purge_journaux = 'autorisee'` : échappatoire réservée à la purge
-- administrative documentée (et au reseed de développement). L'application
-- ne pose jamais cette variable.
CREATE OR REPLACE FUNCTION interdire_ecriture_journal() RETURNS trigger AS $$
BEGIN
  IF COALESCE(current_setting('app.purge_journaux', true), '') <> 'autorisee' THEN
    RAISE EXCEPTION 'Journaux immuables : modification ou suppression interdite hors purge administrative.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_audit_immuable
  BEFORE UPDATE OR DELETE ON "journal_audit"
  FOR EACH ROW EXECUTE FUNCTION interdire_ecriture_journal();

CREATE TRIGGER mouvements_stock_immuables
  BEFORE UPDATE OR DELETE ON "mouvements_stock"
  FOR EACH ROW EXECUTE FUNCTION interdire_ecriture_journal();

CREATE TRIGGER retours_affectation_immuables
  BEFORE UPDATE OR DELETE ON "retours_affectation"
  FOR EACH ROW EXECUTE FUNCTION interdire_ecriture_journal();
