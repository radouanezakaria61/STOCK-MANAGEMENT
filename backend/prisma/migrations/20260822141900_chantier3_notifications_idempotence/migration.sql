-- AlterTable
ALTER TABLE "journal_audit" ADD COLUMN     "valeurs_apres" JSONB,
ADD COLUMN     "valeurs_avant" JSONB;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "entite" TEXT,
    "entite_id" TEXT,
    "cible_onglet" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lue_le" TIMESTAMP(3),
    "resolue_le" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requetes_idempotentes" (
    "cle" TEXT NOT NULL,
    "empreinte_corps" TEXT NOT NULL,
    "status_reponse" INTEGER NOT NULL,
    "corps_reponse" JSONB NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requetes_idempotentes_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE INDEX "notifications_statut_cree_le_idx" ON "notifications"("statut", "cree_le");

-- CreateIndex
CREATE INDEX "notifications_type_entite_id_idx" ON "notifications"("type", "entite_id");

-- CreateIndex
CREATE INDEX "journal_audit_utilisateur_id_idx" ON "journal_audit"("utilisateur_id");

-- CreateIndex
CREATE INDEX "journal_audit_entite_entite_id_idx" ON "journal_audit"("entite", "entite_id");
