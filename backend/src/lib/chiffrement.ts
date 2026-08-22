import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Chantier 3.5 (P1.4) — chiffrement authentifié des secrets au repos
// (PIN/PUK SIM). AES-256-GCM : nonce unique par valeur + tag d'authenticité.
// La clé ne vit QUE dans l'environnement (CLE_CHIFFREMENT) : jamais dans le
// dépôt, jamais journalisée. Format stocké : enc-v1:<iv>:<tag>:<données>.
//
// Lecture tolérante : une valeur sans préfixe est considérée comme donnée
// héritée en clair (pré-3.5) et renvoyée telle quelle — le temps que la
// migration de re-chiffrement passe.

const PREFIXE = "enc-v1";

let cleMemoisee: Buffer | null = null;

function cleChiffrement(): Buffer {
  if (cleMemoisee) return cleMemoisee;
  const brute = process.env.CLE_CHIFFREMENT;
  if (!brute) {
    throw new Error(
      "CLE_CHIFFREMENT manquante : les secrets au repos (PIN/PUK) ne peuvent pas être traités. " +
        "Générez une clé 32 octets : node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const cle = /^[0-9a-f]{64}$/i.test(brute)
    ? Buffer.from(brute, "hex")
    : Buffer.from(brute, "base64");
  if (cle.length !== 32) {
    throw new Error("CLE_CHIFFREMENT invalide : 32 octets (base64 ou hex) attendus.");
  }
  cleMemoisee = cle;
  return cle;
}

/** Chiffre une valeur secrète ; null/"" → null. */
export function chiffrer(clair: string | null | undefined): string | null {
  if (clair == null || clair === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cleChiffrement(), iv);
  const donnees = Buffer.concat([cipher.update(clair, "utf8"), cipher.final()]);
  return [
    PREFIXE,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    donnees.toString("base64")
  ].join(":");
}

/**
 * Déchiffre une valeur stockée. Les valeurs héritées en clair (sans préfixe)
 * passent en transparence ; une valeur corrompue (tag invalide) lève — un
 * secret illisible doit être signalé, pas masqué.
 */
export function dechiffrer(valeur: string | null | undefined): string | null {
  if (valeur == null || valeur === "") return null;
  if (!valeur.startsWith(`${PREFIXE}:`)) return valeur;
  const [, ivB64, tagB64, dataB64] = valeur.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Valeur chiffrée malformée.");
  }
  const decipher = createDecipheriv("aes-256-gcm", cleChiffrement(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]).toString("utf8");
}

/** Une valeur est-elle déjà chiffrée ? (utile à la migration idempotente) */
export function estChiffree(valeur: string | null | undefined): boolean {
  return typeof valeur === "string" && valeur.startsWith(`${PREFIXE}:`);
}
