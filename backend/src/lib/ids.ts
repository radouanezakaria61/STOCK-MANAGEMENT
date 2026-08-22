// Aides dates & références métier lisibles (DA-2026-001, STK-008…).
// Chantier 1 : les dates métier sont des DateTime ; les chaînes ISO
// ne subsistent que dans les champs JSON d'affichage (assignedTo…).
// Chantier 3.5 : les numéros de référence proviennent d'un compteur
// transactionnel (`compteurs`) — plus aucun scan O(n) des tables.
import { ErreurMetier } from "./erreurs.js";
import type { Tx } from "./prisma.js";

/** Maintenant, en Date. */
export function maintenant(): Date {
  return new Date();
}

/** Date du jour au format ISO court (réservée aux chaînes d'affichage JSON). */
export function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convertit une entrée « yyyy-MM-dd » (formulaire) en Date midi UTC.
 *  Chantier 3.5 : une valeur FOURNIE mais invalide lève une erreur 400 —
 *  plus jamais de bascule silencieuse vers la date du jour. */
export function versDate(iso?: string | null): Date | undefined {
  if (iso == null || iso === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(new Date(`${iso}T12:00:00Z`).getTime())) {
    throw new ErreurMetier(
      400,
      `Date invalide : « ${iso} ». Format attendu : AAAA-MM-JJ.`,
      "DATE_INVALIDE"
    );
  }
  return new Date(`${iso}T12:00:00Z`);
}

/**
 * Numéro suivant d'une séquence métier via le compteur transactionnel.
 * L'upsert … RETURNING est atomique en PostgreSQL : deux transactions
 * concurrentes obtiennent nécessairement des numéros distincts, et le coût
 * est O(1) quel que soit le volume de la table (remplace numeroSuivant).
 */
export async function prochainNumero(tx: Tx, sequence: string): Promise<number> {
  const lignes = await tx.$queryRaw<{ valeur: number }[]>`
    INSERT INTO compteurs (nom, valeur)
    VALUES (${sequence}, 1)
    ON CONFLICT (nom) DO UPDATE SET valeur = compteurs.valeur + 1
    RETURNING valeur`;
  return Number(lignes[0]!.valeur);
}

/**
 * Retourne le prochain numéro libre à partir des références existantes.
 * Résiste aux suppressions soft (contrairement à un simple comptage de lignes).
 */
export function numeroSuivant(references: string[], matcher: RegExp): number {
  let max = 0;
  for (const ref of references) {
    const match = ref.match(matcher);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
