-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "titre" TEXT,
    "cree_par_id" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprimeLe" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBRE',
    "a_rejoint_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "a_quitte_le" TIMESTAMP(3),
    "derniere_vu_le" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "auteur_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXTE',
    "fichier_url" TEXT,
    "fichier_type" TEXT,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "supprimeLe" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_reference_key" ON "conversations"("reference");

-- CreateIndex
CREATE INDEX "conversations_cree_par_id_idx" ON "conversations"("cree_par_id");

-- CreateIndex
CREATE INDEX "conversation_participants_utilisateur_id_idx" ON "conversation_participants"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_utilisateur_id_key" ON "conversation_participants"("conversation_id", "utilisateur_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_cree_le_idx" ON "messages"("conversation_id", "cree_le");

-- CreateIndex
CREATE INDEX "messages_auteur_id_idx" ON "messages"("auteur_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
