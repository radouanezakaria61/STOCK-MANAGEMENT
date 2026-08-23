import { Prisma } from "@prisma/client";

// Sérialiseur unique à la frontière HTTP (AGENTS.md règle 4).
//  - Decimal → number : le frontend reçoit toujours un nombre JSON,
//    son arithmétique est intacte.
//  - Date → string : tronquée au jour pour les champs historiquement
//    « date seule » du contrat d'API, ISO complet sinon.
//  - `derniereConnexion` null → sentinelle « Non connecté » (contrat conservé).
//
// Décision du 22 août (AGENTS.md « Langue des clés ») : les clés de réponse
// restent EXACTEMENT celles du modèle Prisma — creeLe, derniereConnexion…
// Aucun renommage à la frontière HTTP ; la cale de traduction vers
// l'anglais (createdAt, lastLogin) a été supprimée, frontend adapté dans
// le même commit.

const CHAMPS_DATE_SEULE = new Set([
  "purchaseDate",
  "warrantyExpiry",
  "date",
  "assignedDate",
  "returnDate"
]);

// Champs internes jamais exposés par le contrat d'API.
const CHAMPS_SUPPRIMES = new Set(["supprimeLe", "modifieLe", "motDePasseHash", "tokenHash"]);

function dateSeule(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateHeure(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function transformer(valeur: unknown, cle?: string): unknown {
  if (valeur === null || valeur === undefined) {
    if (cle === "derniereConnexion") return "Non connecté";
    return valeur;
  }

  if (valeur instanceof Prisma.Decimal || Prisma.Decimal.isDecimal(valeur)) {
    return (valeur as Prisma.Decimal).toNumber();
  }

  if (valeur instanceof Date) {
    if (cle === "derniereConnexion") return dateHeure(valeur);
    if (cle !== undefined && CHAMPS_DATE_SEULE.has(cle)) return dateSeule(valeur);
    return valeur.toISOString();
  }

  if (Array.isArray(valeur)) {
    return valeur.map((element) => transformer(element));
  }

  if (typeof valeur === "object") {
    const source = valeur as Record<string, unknown>;
    const sortie: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(source)) {
      if (CHAMPS_SUPPRIMES.has(k)) continue;
      sortie[k] = transformer(v, k);
    }
    return sortie;
  }

  return valeur;
}

export function serialiser<T>(donnees: T): unknown {
  return transformer(donnees);
}


