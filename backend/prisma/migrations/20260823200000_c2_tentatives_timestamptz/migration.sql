-- C2 — tentatives_connexion : colonnes temporelles en timestamptz(3).
-- La table créée au chantier 3.5 utilisait TIMESTAMP sans fuseau : NOW() y
-- écrivait l'heure LOCALE du serveur PostgreSQL (session Africa/Casablanca,
-- UTC+01) alors que le client Prisma relit ces valeurs comme des UTC.
-- Résultat : un décalage pur entre écriture et lecture — le Retry-After du
-- limiteur était gonflé du décalage horaire entier.
-- L'état du limiteur est éphémère par conception (fenêtre glissante de
-- 15 minutes, jamais de verrou définitif) : on purge la table avant la
-- conversion plutôt que d'interpréter des timestamps naïfs ambigus.
DELETE FROM "tentatives_connexion";

ALTER TABLE "tentatives_connexion"
  ALTER COLUMN "bloque_jusqua" TYPE timestamptz(3);

ALTER TABLE "tentatives_connexion"
  ALTER COLUMN "fenetre_ouverte" TYPE timestamptz(3),
  ALTER COLUMN "fenetre_ouverte" SET DEFAULT now();
