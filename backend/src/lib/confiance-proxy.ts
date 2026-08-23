import net from "node:net";

// ══════════════════════════════════════════════════════════════════════
// M4 (Phase 1) — interprétation STRICTE de TRUST_PROXY.
//
// Une valeur mal orthographiée dans l'environnement ne doit jamais être
// silencieusement ignorée : soit elle est valide et appliquée, soit le
// démarrage ÉCHOUE avec un message explicite (fail fast). Sans cette
// validation, un TRUST_PROXY="1 " mal typé laisserait croire le serveur
// directement exposé alors qu'un proxy est devant lui — les limiteurs
// attribueraient tous les échecs à l'adresse du proxy.
// ══════════════════════════════════════════════════════════════════════

const MOTS_CLES_EXPRESS = ["loopback", "linklocal", "uniquelocal"] as const;
const SAUTS_MAX = 10;

export type ConfianceProxy = boolean | number | string | Array<string | number>;

function interpreterUnMorceau(morceau: string): number | string {
  if (/^\d+$/.test(morceau)) {
    const sauts = parseInt(morceau, 10);
    if (sauts < 1 || sauts > SAUTS_MAX) {
      throw new Error(
        `Nombre de sauts invalide « ${morceau} » : attendu entre 1 et ${SAUTS_MAX}.`
      );
    }
    return sauts;
  }
  const minusculse = morceau.toLowerCase();
  if ((MOTS_CLES_EXPRESS as readonly string[]).includes(minusculse)) {
    return minusculse;
  }
  const [base, prefixe] = morceau.split("/");
  const familleIp = base ? net.isIP(base) : 0;
  if (familleIp === 4 || familleIp === 6) {
    if (prefixe === undefined) return morceau;
    const bits = Number(prefixe);
    const maxBits = familleIp === 4 ? 32 : 128;
    if (!/^\d+$/.test(prefixe) || bits < 0 || bits > maxBits) {
      throw new Error(
        `Préfixe CIDR invalide « /${prefixe} » pour une adresse IPv${familleIp} (max ${maxBits}).`
      );
    }
    return morceau;
  }
  throw new Error(
    `Valeur non reconnue « ${morceau} » : attendu un entier (sauts), ` +
      `${MOTS_CLES_EXPRESS.join(", ")}, une adresse IP ou un CIDR.`
  );
}

/** Analyse TRUST_PROXY ; lève une erreur explicite si la valeur est invalide.
 *  Renvoie false si absente/vide (aucune confiance, comportement sûr). */
export function interpreterTrustProxy(valeur: string | undefined): ConfianceProxy {
  const brut = (valeur ?? "").trim();
  if (brut === "") return false;
  const morceaux = brut.split(",").map((m) => m.trim()).filter(Boolean);
  if (morceaux.length === 0) return false;
  const interpretes = morceaux.map(interpreterUnMorceau);
  return interpretes.length === 1 ? interpretes[0]! : interpretes;
}
