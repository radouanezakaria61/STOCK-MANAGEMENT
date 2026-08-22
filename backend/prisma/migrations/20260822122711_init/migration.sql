-- CreateTable
CREATE TABLE "societes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "codeCourt" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "identifiant_legal" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "supprimeLe" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "societes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL DEFAULT '',
    "departement" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT,
    "doit_changer_mdp" BOOLEAN NOT NULL DEFAULT false,
    "role_id" TEXT NOT NULL,
    "societe_id" TEXT,
    "url_avatar" TEXT NOT NULL DEFAULT '',
    "derniereConnexion" TIMESTAMP(3),
    "supprimeLe" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "accorde_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "empreinte_jeton" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "adresse_ip" TEXT,
    "agent_utilisateur" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "derniere_activite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "utilisateur_id" TEXT,
    "identifiant_tente" TEXT,
    "entite" TEXT,
    "entite_id" TEXT,
    "details" JSONB,
    "adresse_ip" TEXT,
    "agent_utilisateur" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles_stock" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "etiquette" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantite_disponible" INTEGER NOT NULL,
    "quantite_affectee" INTEGER NOT NULL,
    "seuil_minimum" INTEGER NOT NULL,
    "prix_unitaire_mad" DECIMAL(12,2) NOT NULL,
    "valeur_totale_mad" DECIMAL(12,2) NOT NULL,
    "emplacement" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fournisseur" TEXT,
    "date_achat" TIMESTAMP(3),
    "fin_garantie" TIMESTAMP(3),
    "affecte_a" JSONB,
    "specs" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "supprimeLe" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "article_id" TEXT,
    "article_nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "effectue_par" TEXT NOT NULL,
    "destinataire" TEXT,
    "departement" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type_modele" TEXT NOT NULL,
    "code_formulaire" TEXT,
    "beneficiaire_nom" TEXT NOT NULL,
    "beneficiaire_email" TEXT NOT NULL DEFAULT '',
    "beneficiaire_telephone" TEXT NOT NULL DEFAULT '',
    "beneficiaire_cin" TEXT NOT NULL DEFAULT '',
    "beneficiaire_fonction" TEXT NOT NULL,
    "beneficiaire_departement" TEXT NOT NULL,
    "beneficiaire_site" TEXT NOT NULL,
    "date_affectation" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "autorise_par" TEXT NOT NULL,
    "intitule_dsi" TEXT NOT NULL,
    "type_ressource" TEXT,
    "avec_sim" BOOLEAN,
    "sim_operateur" TEXT,
    "sim_numero" TEXT,
    "sim_puk" TEXT,
    "sim_pin" TEXT,
    "avec_smartphone" BOOLEAN,
    "appareil_marque" TEXT,
    "appareil_imei" TEXT,
    "appareil_modele" TEXT,
    "appareil_configuration" TEXT,
    "type_operation" TEXT,
    "restitution_appareil_precedent" TEXT,
    "etat_appareil_restitue" TEXT,
    "remarques_incident" TEXT,
    "conditions_acceptees" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affectations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_affectation" (
    "id" SERIAL NOT NULL,
    "affectation_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "etiquette" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "numero_serie" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "etat" TEXT NOT NULL,
    "accessories" TEXT[],
    "specs" JSONB,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lignes_affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retours_affectation" (
    "id" TEXT NOT NULL,
    "affectation_id" TEXT NOT NULL,
    "date_retour" TIMESTAMP(3) NOT NULL,
    "cause" TEXT NOT NULL,
    "cause_personnalisee" TEXT NOT NULL DEFAULT '',
    "etat_equipement" TEXT NOT NULL,
    "accessoires_restitues" TEXT[],
    "accessoires_manquants" TEXT[],
    "donnees_effacees" BOOLEAN NOT NULL DEFAULT false,
    "bitlocker_deverrouille" BOOLEAN NOT NULL DEFAULT false,
    "diagnostic_technique" TEXT NOT NULL DEFAULT '',
    "action_effectuee" TEXT NOT NULL,
    "inspecte_par" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retours_affectation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "societes_reference_key" ON "societes"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "societes_codeCourt_key" ON "societes"("codeCourt");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_reference_key" ON "utilisateurs"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_username_key" ON "utilisateurs"("username");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE INDEX "utilisateurs_societe_id_idx" ON "utilisateurs"("societe_id");

-- CreateIndex
CREATE INDEX "utilisateurs_role_id_idx" ON "utilisateurs"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_empreinte_jeton_key" ON "sessions"("empreinte_jeton");

-- CreateIndex
CREATE INDEX "sessions_utilisateur_id_idx" ON "sessions"("utilisateur_id");

-- CreateIndex
CREATE INDEX "journal_audit_cree_le_idx" ON "journal_audit"("cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_action_idx" ON "journal_audit"("action");

-- CreateIndex
CREATE UNIQUE INDEX "articles_stock_reference_key" ON "articles_stock"("reference");

-- CreateIndex
CREATE INDEX "articles_stock_categorie_idx" ON "articles_stock"("categorie");

-- CreateIndex
CREATE INDEX "articles_stock_status_idx" ON "articles_stock"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_stock_reference_key" ON "mouvements_stock"("reference");

-- CreateIndex
CREATE INDEX "mouvements_stock_article_id_idx" ON "mouvements_stock"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_reference_key" ON "affectations"("reference");

-- CreateIndex
CREATE INDEX "affectations_status_idx" ON "affectations"("status");

-- CreateIndex
CREATE INDEX "lignes_affectation_affectation_id_idx" ON "lignes_affectation"("affectation_id");

-- CreateIndex
CREATE UNIQUE INDEX "retours_affectation_affectation_id_key" ON "retours_affectation"("affectation_id");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_societe_id_fkey" FOREIGN KEY ("societe_id") REFERENCES "societes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_affectation" ADD CONSTRAINT "lignes_affectation_affectation_id_fkey" FOREIGN KEY ("affectation_id") REFERENCES "affectations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_affectation" ADD CONSTRAINT "retours_affectation_affectation_id_fkey" FOREIGN KEY ("affectation_id") REFERENCES "affectations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
