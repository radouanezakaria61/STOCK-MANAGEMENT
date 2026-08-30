import { randomUUID } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../lib/prisma.js";
import { requeteInvalide, introuvable } from "../lib/erreurs.js";

const UPLOAD_DIR = join(import.meta.dirname, "..", "..", "uploads", "chat");

const MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

/**
 * Upload sécurisé d'une pièce jointe image dans une conversation.
 *
 * Sécurité :
 *  - L'utilisateur doit être authentifié (garanti par le middleware).
 *  - L'utilisateur doit être membre actif de la conversation.
 *  - Seuls JPEG/PNG/WebP sont acceptés (vérification MIME côté serveur).
 *  - Taille max 5 Mo.
 *  - Le nom de fichier stocké est un UUID aléatoire : aucun chemin contrôlé
 *    par l'utilisateur n'atteint le filesystem.
 *  - Le chemin de stockage est strictement dans UPLOAD_DIR.
 */
export async function uploadPieceJointe(
  conversationId: string,
  utilisateurId: string,
  fichier: { buffer: Buffer; originalname: string; mimetype: string; size: number }
) {
  // 1. Vérifier appartenance à la conversation
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_utilisateurId: { conversationId, utilisateurId },
    },
  });
  if (!participation || participation.aQuitteLe) {
    throw requeteInvalide("Vous n'êtes pas membre de cette conversation.");
  }

  // 2. Vérifier le type MIME
  if (!MIME_ALLOWLIST.has(fichier.mimetype)) {
    throw requeteInvalide(
      `Type de fichier non autorisé : ${fichier.mimetype}. Formats acceptés : JPEG, PNG, WebP.`
    );
  }

  // 3. Vérifier la taille
  if (fichier.size > MAX_FILE_SIZE) {
    throw requeteInvalide(
      `Fichier trop volumineux : ${Math.round(fichier.size / 1024 / 1024)} Mo. Taille maximale : 5 Mo.`
    );
  }

  // 4. Générer un nom de stockage aléatoire (UUID)
  const ext = fichier.mimetype === "image/jpeg" ? ".jpg" :
              fichier.mimetype === "image/png" ? ".png" : ".webp";
  const nomStockage = `${randomUUID()}${ext}`;
  const cheminComplet = join(UPLOAD_DIR, nomStockage);

  // 5. Écrire le fichier de manière atomique
  await writeFile(cheminComplet, fichier.buffer);

  // 6. Retourner les métadonnées (sans créer en DB — le message doit exister d'abord)
  return {
    nomOriginal: fichier.originalname,
    nomStockage,
    mimeType: fichier.mimetype,
    tailleOctets: fichier.size,
  };
}

/**
 * Crée l'enregistrement PieceJointe en DB (appelé APRÈS la création du message).
 */
export async function creerEnregistrementPieceJointe(
  messageId: string,
  meta: { nomOriginal: string; nomStockage: string; mimeType: string; tailleOctets: number }
) {
  return prisma.pieceJointe.create({
    data: {
      messageId,
      nomOriginal: meta.nomOriginal,
      nomStockage: meta.nomStockage,
      mimeType: meta.mimeType,
      tailleOctets: meta.tailleOctets,
    },
  });
}

/**
 * Associe une pièce jointe existante à un message.
 */
export async function associerPieceJointe(
  pieceJointeId: string,
  messageId: string
) {
  await prisma.pieceJointe.update({
    where: { id: pieceJointeId },
    data: { messageId },
  });
}

/**
 * Récupère le fichier binaire d'une pièce jointe après vérification
 * de l'appartenance à la conversation.
 */
export async function lirePieceJointe(
  pieceJointeId: string,
  utilisateurId: string
) {
  const pj = await prisma.pieceJointe.findUnique({
    where: { id: pieceJointeId },
    include: {
      message: {
        select: { conversationId: true },
      },
    },
  });

  if (!pj) throw introuvable("Pièce jointe introuvable.");

  // Vérifier membership
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_utilisateurId: {
        conversationId: pj.message.conversationId,
        utilisateurId,
      },
    },
  });
  if (!participation || participation.aQuitteLe) {
    throw requeteInvalide("Accès non autorisé à cette pièce jointe.");
  }

  const cheminComplet = join(UPLOAD_DIR, pj.nomStockage);
  const buffer = await readFile(cheminComplet);

  return {
    buffer,
    mimeType: pj.mimeType,
    nomOriginal: pj.nomOriginal,
  };
}
