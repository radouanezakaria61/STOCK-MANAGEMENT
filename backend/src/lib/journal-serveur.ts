// Journalisation serveur centralisée (refactoring — standardisation).
//
// Un seul point de passage pour les messages serveur : horodatage ISO,
// niveau explicite, préfixe composant. Aucune donnée sensible ne doit
// transiter par ces fonctions (mêmes règles que le journal d'audit :
// jamais de mot de passe, hash, cookie ou secret).
//
// En sortie : stdout/stderr — un superviseur (PM2, systemd, Docker) les
// collecte ; pas de fichier géré par l'application.

type Niveau = "DEBUG" | "INFO" | "WARN" | "ERROR";

function ecrire(niveau: Niveau, composant: string, message: string, details?: unknown): void {
  const ligne = `${new Date().toISOString()} [${niveau}] (${composant}) ${message}`;
  const flux = niveau === "ERROR" ? console.error : niveau === "WARN" ? console.warn : console.log;
  if (details !== undefined) {
    // Les erreurs passent par stack (lisible) ; les objets par JSON borné.
    if (details instanceof Error) flux(ligne, "\n", details.stack ?? details.message);
    else flux(ligne, JSON.stringify(details));
  } else {
    flux(ligne);
  }
}

export function journaliser(composant: string) {
  return {
    info: (message: string, details?: unknown) => ecrire("INFO", composant, message, details),
    warn: (message: string, details?: unknown) => ecrire("WARN", composant, message, details),
    erreur: (message: string, details?: unknown) => ecrire("ERROR", composant, message, details)
  };
}
