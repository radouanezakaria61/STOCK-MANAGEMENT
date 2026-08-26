-- CreateTable
CREATE TABLE "pieces_jointes" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "nom_original" TEXT NOT NULL,
    "nom_stockage" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "largeur_px" INTEGER,
    "hauteur_px" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_nom_stockage_key" ON "pieces_jointes"("nom_stockage");

-- CreateIndex
CREATE INDEX "pieces_jointes_message_id_idx" ON "pieces_jointes"("message_id");

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
