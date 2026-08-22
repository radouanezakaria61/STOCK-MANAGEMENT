-- Chantier 3.5 — durcissement post-audits Hermes.
-- 1) Notifications par destinataire (fan-out, lecture indépendante).
-- 2) Compteurs de références transactionnels (remplace les scans O(n)).
-- 3) Tentatives de connexion persistantes (limiteur anti-bruteforce).
-- 4) Statuts contraints par CHECK (machine à états garantie en base).

-- ── 1. Notifications : destinataire obligatoire ─────────────────────────
ALTER TABLE "notifications" ADD COLUMN "destinataire_id" TEXT;

-- Backfill : les notifications globales préexistantes sont réattribuées au
-- premier SUPER_ADMIN (données de démonstration ; le seed régénère ensuite
-- un état propre où toute notification naît ciblée).
UPDATE "notifications" SET "destinataire_id" = (
  SELECT u."id" FROM "utilisateurs" u
  JOIN "roles" r ON r."id" = u."role_id"
  WHERE r."code" = 'SUPER_ADMIN'
  ORDER BY u."cree_le" ASC
  LIMIT 1
)
WHERE "destinataire_id" IS NULL;

ALTER TABLE "notifications" ALTER COLUMN "destinataire_id" SET NOT NULL;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_destinataire_id_fkey"
  FOREIGN KEY ("destinataire_id") REFERENCES "utilisateurs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La déduplication devient PAR DESTINATAIRE : une même entité peut alerter
-- plusieurs comptes, mais jamais deux fois le même pour une alerte ouverte.
DROP INDEX IF EXISTS "uq_notification_alerte_ouverte";
CREATE UNIQUE INDEX "uq_notification_alerte_ouverte_destinataire"
  ON "notifications"("type", "entite_id", "destinataire_id")
  WHERE "statut" = 'OUVERTE' AND "entite_id" IS NOT NULL;

CREATE INDEX "notifications_destinataire_id_statut_idx"
  ON "notifications"("destinataire_id", "statut");

-- ── 2. Compteurs de références ──────────────────────────────────────────
CREATE TABLE "compteurs" (
  "nom" TEXT NOT NULL,
  "valeur" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "compteurs_pkey" PRIMARY KEY ("nom")
);

-- Initialisation sur les maximums EXISTANTS (archivés compris : la référence
-- unique reste réservée après soft delete).
INSERT INTO "compteurs" ("nom", "valeur")
SELECT 'article', COALESCE(MAX(substring(reference from 5)::int), 0)
FROM articles_stock WHERE reference ~ '^STK-\d+$';

INSERT INTO "compteurs" ("nom", "valeur")
SELECT 'mouvement', COALESCE(MAX(substring(reference from 5)::int), 0)
FROM mouvements_stock WHERE reference ~ '^MVT-\d+$';

INSERT INTO "compteurs" ("nom", "valeur")
SELECT 'affectation-' || substring(r.ref from 9 for 4),
       MAX(substring(r.ref from 14)::int)
FROM (
  SELECT reference AS ref FROM affectations
  WHERE reference ~ '^AFF-DSI-\d{4}-\d+$'
) r
GROUP BY 1;

-- ── 3. Tentatives de connexion persistantes ─────────────────────────────
CREATE TABLE "tentatives_connexion" (
  "cle" TEXT NOT NULL,
  "echecs" INTEGER NOT NULL DEFAULT 0,
  "bloque_jusqua" TIMESTAMP(3),
  "fenetre_ouverte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tentatives_connexion_pkey" PRIMARY KEY ("cle")
);

-- ── 4. Statuts contraints (CHECK) ───────────────────────────────────────
ALTER TABLE "affectations"
  ADD CONSTRAINT "ck_affectation_statut"
  CHECK ("status" IN ('Active', 'Restitué', 'Annulée'));

ALTER TABLE "articles_stock"
  ADD CONSTRAINT "ck_article_statut"
  CHECK ("status" IN ('En Stock', 'Affecté', 'En Maintenance', 'Rebut / Fin de vie', 'Supprimé'));
