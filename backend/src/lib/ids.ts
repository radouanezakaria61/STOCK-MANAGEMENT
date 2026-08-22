// Aides dates & références métier lisibles (DA-2026-001, STK-008…).
// Chantier 1 : les dates métier sont des DateTime ; les chaînes ISO
// ne subsistent que dans les champs JSON d'affichage (assignedTo…).

/** Maintenant, en Date. */
export function maintenant(): Date {
  return new Date();
}

/** Date du jour au format ISO court (réservée aux chaînes d'affichage JSON). */
export function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convertit une entrée « yyyy-MM-dd » (formulaire) en Date midi UTC. */
export function versDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime()) ? undefined : d;
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
