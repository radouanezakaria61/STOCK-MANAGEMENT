-- CreateTable
CREATE TABLE "fournisseurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "score_qualite" INTEGER NOT NULL,
    "taux_ponctualite" INTEGER NOT NULL,
    "contrats_actifs" INTEGER NOT NULL DEFAULT 0,
    "depense_totale" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "niveau_risque" TEXT NOT NULL DEFAULT 'Low',
    "status" TEXT NOT NULL DEFAULT 'Approved',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_commande" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "fournisseur_id" TEXT,
    "fournisseur_nom" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "categorie" TEXT NOT NULL,
    "departement" TEXT NOT NULL,
    "demandeur" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date_creation" TEXT NOT NULL,
    "date_livraison" TEXT NOT NULL,
    "score_audit" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "bons_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande" (
    "id" SERIAL NOT NULL,
    "bc_id" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "nom" TEXT NOT NULL,
    "allocated" DOUBLE PRECISION NOT NULL,
    "depense" DOUBLE PRECISION NOT NULL,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("nom")
);

-- CreateTable
CREATE TABLE "appels_offres" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "departement" TEXT NOT NULL,
    "budget_cible" DOUBLE PRECISION NOT NULL,
    "besoins" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "appels_offres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offres" (
    "id" TEXT NOT NULL,
    "appel_offres_id" TEXT NOT NULL,
    "fournisseur_nom" TEXT NOT NULL,
    "prix_unitaire" DOUBLE PRECISION NOT NULL,
    "prix_total" DOUBLE PRECISION NOT NULL,
    "delai_jours" INTEGER NOT NULL,
    "garantie_ans" INTEGER NOT NULL,
    "conformite" TEXT NOT NULL,
    "signaux_risque" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "offres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL DEFAULT '',
    "departement" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plafond_depense_mad" DOUBLE PRECISION NOT NULL,
    "permissions" JSONB NOT NULL,
    "url_avatar" TEXT NOT NULL DEFAULT '',
    "cree_le" TEXT NOT NULL,
    "derniere_connexion" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles_stock" (
    "id" TEXT NOT NULL,
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
    "prix_unitaire_mad" DOUBLE PRECISION NOT NULL,
    "valeur_totale_mad" DOUBLE PRECISION NOT NULL,
    "emplacement" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bc_id" TEXT,
    "bc_titre" TEXT,
    "fournisseur_nom" TEXT,
    "date_achat" TEXT,
    "fin_garantie" TEXT,
    "affecte_a" JSONB,
    "specs" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "articles_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "article_nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "effectue_par" TEXT NOT NULL,
    "destinataire" TEXT,
    "departement" TEXT,
    "date" TEXT NOT NULL,
    "bc_id" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" SERIAL NOT NULL,

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
    "date_affectation" TEXT NOT NULL,
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
    "seq" SERIAL NOT NULL,

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

    CONSTRAINT "lignes_affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retours_affectation" (
    "id" TEXT NOT NULL,
    "affectation_id" TEXT NOT NULL,
    "date_retour" TEXT NOT NULL,
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

    CONSTRAINT "retours_affectation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fournisseurs_seq_key" ON "fournisseurs"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "bons_commande_seq_key" ON "bons_commande"("seq");

-- CreateIndex
CREATE INDEX "bons_commande_fournisseur_id_idx" ON "bons_commande"("fournisseur_id");

-- CreateIndex
CREATE INDEX "lignes_commande_bc_id_idx" ON "lignes_commande"("bc_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_seq_key" ON "budgets"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "appels_offres_seq_key" ON "appels_offres"("seq");

-- CreateIndex
CREATE INDEX "offres_appel_offres_id_idx" ON "offres"("appel_offres_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_seq_key" ON "utilisateurs"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "articles_stock_seq_key" ON "articles_stock"("seq");

-- CreateIndex
CREATE INDEX "articles_stock_categorie_idx" ON "articles_stock"("categorie");

-- CreateIndex
CREATE INDEX "articles_stock_status_idx" ON "articles_stock"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_stock_seq_key" ON "mouvements_stock"("seq");

-- CreateIndex
CREATE INDEX "mouvements_stock_article_id_idx" ON "mouvements_stock"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_reference_key" ON "affectations"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_seq_key" ON "affectations"("seq");

-- CreateIndex
CREATE INDEX "affectations_status_idx" ON "affectations"("status");

-- CreateIndex
CREATE INDEX "lignes_affectation_affectation_id_idx" ON "lignes_affectation"("affectation_id");

-- CreateIndex
CREATE UNIQUE INDEX "retours_affectation_affectation_id_key" ON "retours_affectation"("affectation_id");

-- AddForeignKey
ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_bc_id_fkey" FOREIGN KEY ("bc_id") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offres" ADD CONSTRAINT "offres_appel_offres_id_fkey" FOREIGN KEY ("appel_offres_id") REFERENCES "appels_offres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_stock" ADD CONSTRAINT "articles_stock_bc_id_fkey" FOREIGN KEY ("bc_id") REFERENCES "bons_commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_affectation" ADD CONSTRAINT "lignes_affectation_affectation_id_fkey" FOREIGN KEY ("affectation_id") REFERENCES "affectations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retours_affectation" ADD CONSTRAINT "retours_affectation_affectation_id_fkey" FOREIGN KEY ("affectation_id") REFERENCES "affectations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
