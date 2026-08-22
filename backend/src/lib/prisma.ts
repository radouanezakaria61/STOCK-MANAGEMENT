import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// Modèles métier portant `supprimeLe` : toutes leurs lectures filtrent
// automatiquement les enregistrements supprimés (soft delete).
// Les journaux (MouvementStock, RetourAffectation, lignes…) sont hors liste :
// ils ne se suppriment jamais (AGENTS.md règle 3).
const MODELES_SOFT_DELETE = new Set(["Utilisateur", "ArticleStock", "Societe"]);

const OPERATIONS_FILTRABLES = new Set([
  "findMany",
  "findFirst",
  "count",
  "aggregate",
  "updateMany",
  "deleteMany"
]);

// findUnique / findUniqueOrThrow n'acceptent qu'un where sur champs uniques :
// impossible d'y injecter `supprimeLe: null`. On filtre donc après lecture :
// une ligne archivée est renvoyée comme introuvable. Sans cela, le futur
// login (`findUnique({ where: { email } })`) laisserait passer un compte
// révoqué — prérequis documenté du chantier 2b.
const OPERATIONS_POST_LECTURE = new Set(["findUnique", "findUniqueOrThrow"]);

const client = new PrismaClient();

// Client sans le filtre soft delete : réservé aux rares besoins où une ligne
// archivée doit rester visible — notamment la génération de références
// métier uniques (`usr-N`, `soc-N`, `STK-NNN`) : une référence portée par un
// enregistrement supprimé reste occupée par son contrainte UNIQUE.
export const prismaSansFiltre = client;

export const prisma = client.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          model &&
          MODELES_SOFT_DELETE.has(model) &&
          OPERATIONS_FILTRABLES.has(operation)
        ) {
          const argumentsFiltres = { ...(args as Record<string, unknown>) } as Record<
            string,
            unknown
          >;
          const whereExistant = argumentsFiltres["where"] as object | undefined;
          argumentsFiltres["where"] = {
            AND: [whereExistant ?? {}, { supprimeLe: null }]
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return query(argumentsFiltres as any); // signature interne Prisma (union large)
        }

        if (
          model &&
          MODELES_SOFT_DELETE.has(model) &&
          OPERATIONS_POST_LECTURE.has(operation)
        ) {
          const resultat = (await query(args)) as Record<string, unknown> | null;
          if (resultat !== null && resultat["supprimeLe"] != null) return null;
          return resultat;
        }

        return query(args);
      }
    }
  }
});

// Client transactionnel : le type du callback $transaction du client ÉTENDU
// (les services ne reçoivent jamais un tx du client brut). Dérivé ici pour
// rester exact quelle que soit la version de Prisma.
export type Tx = Parameters<Parameters<(typeof prisma)["$transaction"]>[0]>[0];

/**
 * Verrou consultatif de TRANSACTION sérialisant la génération des références
 * métier entre créateurs concurrents : sans lui, deux écritures simultanées
 * calculent le même numéro et l'une viole l'unicité de `reference` après
 * avoir déjà écrit ses quantités. Libéré automatiquement au commit/rollback.
 *
 * `pg_advisory_xact_lock()` retourne `void`, colonne que $queryRaw refuse de
 * désérialiser (P2010) : on l'évalue dans un WHERE pour obtenir un Int.
 */
export async function verrouillerReferences(tx: Tx): Promise<void> {
  await tx.$queryRaw`SELECT 1 WHERE pg_advisory_xact_lock(hashtext('gsit.references')) IS NULL`;
}
