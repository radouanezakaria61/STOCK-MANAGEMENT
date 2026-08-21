// Aides à la génération d'identifiants métier lisibles (DA-2026-001, STK-008…).
// Les identifiants sont des références affichées aux utilisateurs : ils restent
// donc séquentiels et formatés comme dans l'application d'origine.

export function dateDuJour(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function dateDans(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
}

/**
 * Retourne le prochain numéro libre à partir des identifiants existants.
 * Résiste aux suppressions (contrairement à un simple comptage de lignes).
 */
export function numeroSuivant(existingIds: string[], matcher: RegExp): number {
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(matcher);
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
