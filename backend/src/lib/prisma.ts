import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// Modèles métier portant `supprimeLe` : toutes leurs lectures filtrent
// automatiquement les enregistrements supprimés (soft delete).
// Les journaux (MouvementStock, RetourAffectation, lignes…) sont hors liste :
// ils ne se suppriment jamais (AGENTS.md règle 3).
const MODELES_SOFT_DELETE = new Set([
  "Fournisseur",
  "BonCommande",
  "Budget",
  "AppelOffres",
  "Offre",
  "Utilisateur",
  "ArticleStock"
]);

const OPERATIONS_FILTRABLES = new Set([
  "findMany",
  "findFirst",
  "count",
  "aggregate",
  "updateMany",
  "deleteMany"
]);

const client = new PrismaClient();

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
        return query(args);
      }
    }
  }
});
