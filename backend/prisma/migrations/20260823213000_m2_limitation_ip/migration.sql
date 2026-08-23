-- M2 (Phase 1) : compteur d'échecs de connexion par adresse IP.
-- Complète le limiteur par couple (ip|identifiant) contre les pulvérisations
-- qui varient l'identifiant. Même structure que tentatives_connexion :
-- décision atomique en base (INSERT … ON CONFLICT côté application),
-- horodatages en timestamptz comme le reste (cf. migration c2_tentatives).

CREATE TABLE "limitation_ip" (
    "cle" TEXT NOT NULL,
    "echecs" INTEGER NOT NULL DEFAULT 0,
    "bloque_jusqua" TIMESTAMPTZ(3),
    "fenetre_ouverte" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "limitation_ip_pkey" PRIMARY KEY ("cle")
);
