import { Prisma } from "@prisma/client";
import type { Tx } from "./prisma.js";

// Chantier 3 — journal d'audit MÉTIER, écrit à l'intérieur de la transaction
// de l'opération (AGENTS.md règle 2) : si l'audit échoue, l'opération entière
// est annulée. Les événements d'authentification (hors transaction, best
// effort) restent dans lib/auth.ts.
//
// Codes d'action normalisés (demande du chantier 3, point 8). Ce sont des
// valeurs d'énumération : anglais, conformément aux conventions AGENTS.md.

export const ACTIONS_AUDIT = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DISABLED: "USER_DISABLED",
  ROLE_CHANGED: "ROLE_CHANGED",
  COMPANY_CREATED: "COMPANY_CREATED",
  COMPANY_UPDATED: "COMPANY_UPDATED",

  STOCK_ITEM_CREATED: "STOCK_ITEM_CREATED",
  STOCK_ITEM_UPDATED: "STOCK_ITEM_UPDATED",
  STOCK_ENTRY: "STOCK_ENTRY",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",

  ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
  ASSIGNMENT_CANCELLED: "ASSIGNMENT_CANCELLED",
  RETURN_CREATED: "RETURN_CREATED",
  REASSIGNMENT_CREATED: "REASSIGNMENT_CREATED",

  MAINTENANCE_STARTED: "MAINTENANCE_STARTED",
  MAINTENANCE_COMPLETED: "MAINTENANCE_COMPLETED",
  ITEM_RETIRED: "ITEM_RETIRED"
} as const;

export interface EntreeAuditTx {
  action: string;
  utilisateurId?: string | null;
  identifiantTente?: string | null;
  entite?: string | null;
  entiteId?: string | null;
  details?: unknown;
  valeursAvant?: unknown;
  valeursApres?: unknown;
  adresseIp?: string | null;
  agentUtilisateur?: string | null;
}

/**
 * Écrit une entrée d'audit DANS la transaction fournie. Lève en cas
 * d'échec : la transaction mère est annulée — jamais d'opération métier
 * sans sa trace. Aucun mot de passe, hash, cookie ou secret ne doit être
 * transmis dans `details` / `valeurs*` (règle documentée ; les services ne
 * passent que des instantanés de champs métier).
 */
export async function journaliserDansTx(
  tx: Tx,
  entree: EntreeAuditTx
): Promise<void> {
  await tx.journalAudit.create({
    data: {
      action: entree.action,
      utilisateurId: entree.utilisateurId ?? null,
      identifiantTente: entree.identifiantTente ?? null,
      entite: entree.entite ?? null,
      entiteId: entree.entiteId ?? null,
      details:
        entree.details === undefined ? Prisma.JsonNull : (entree.details as Prisma.InputJsonValue),
      valeursAvant:
        entree.valeursAvant === undefined
          ? Prisma.JsonNull
          : (entree.valeursAvant as Prisma.InputJsonValue),
      valeursApres:
        entree.valeursApres === undefined
          ? Prisma.JsonNull
          : (entree.valeursApres as Prisma.InputJsonValue),
      adresseIp: entree.adresseIp ?? null,
      agentUtilisateur: entree.agentUtilisateur ?? null
    }
  });
}

/**
 * Instantané « valeurs » sûr : ne retient que les clés listées. Utilisé pour
 * remplir valeursAvant/valeursApres sans risque de fuiter un champ interne
 * (motDePasseHash, tokenHash…) même si l'appelant passe l'objet entier.
 */
export function instantane<T extends Record<string, unknown>>(
  objet: T,
  champs: readonly string[]
): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  for (const champ of champs) {
    if (objet[champ] !== undefined) resultat[champ] = objet[champ];
  }
  return resultat;
}
