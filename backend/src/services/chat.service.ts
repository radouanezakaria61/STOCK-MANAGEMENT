import { prisma, type Tx } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { prochainNumero } from "../lib/ids.js";
import type { ContexteActeur } from "../lib/acteur.js";
import {
  bornerPagination,
  metaPagination,
  type ParametresPagination,
} from "../lib/pagination.js";

// ── Conversations ─────────────────────────────────────────────────────

interface CreerConversation {
  titre?: string;
  participantIds: string[];
}

export async function creerConversation(
  donnees: CreerConversation,
  contexte: ContexteActeur
) {
  const auteurId = contexte.utilisateurId;
  if (!auteurId) throw requeteInvalide("Utilisateur non identifié.");
  const allParticipantIds = Array.from(
    new Set([auteurId, ...donnees.participantIds])
  );

  if (allParticipantIds.length < 2) {
    throw requeteInvalide(
      "Une conversation nécessite au moins deux participants."
    );
  }

  return prisma.$transaction(async (tx: Tx) => {
    const numero = await prochainNumero(tx, "conversation");
    const reference = `MSG-${String(numero).padStart(3, "0")}`;

    const conversation = await tx.conversation.create({
      data: {
        reference,
        titre: donnees.titre || undefined,
        creeParId: auteurId,
        participants: {
          createMany: {
            data: allParticipantIds.map((uid) => ({
              utilisateurId: uid,
              role: uid === auteurId ? "CREATEUR" : "MEMBRE",
            })),
          },
        },
      },
      include: {
        participants: {
          include: { utilisateur: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });

    return conversation;
  });
}

export async function listerConversations(utilisateurId: string) {
  return prisma.conversation.findMany({
    where: {
      supprimeLe: null,
      participants: {
        some: { utilisateurId, aQuitteLe: null },
      },
    },
    include: {
      participants: {
        include: {
          utilisateur: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { creeLe: "desc" },
        take: 1,
        include: {
          auteur: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { modifieLe: "desc" },
  });
}

export async function obtenirConversation(id: string, utilisateurId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          utilisateur: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!conversation || conversation.supprimeLe) {
    throw introuvable("Conversation introuvable.");
  }

  const estParticipant = conversation.participants.some(
    (p) => p.utilisateurId === utilisateurId && !p.aQuitteLe
  );
  if (!estParticipant) {
    throw requeteInvalide(
      "Vous n'êtes pas membre de cette conversation."
    );
  }

  return conversation;
}

// ── Messages ──────────────────────────────────────────────────────────

interface EnvoyerMessage {
  contenu: string;
  type?: string;
  fichierUrl?: string;
  fichierType?: string;
}

export async function envoyerMessage(
  conversationId: string,
  donnees: EnvoyerMessage,
  contexte: ContexteActeur
) {
  const auteurId = contexte.utilisateurId;
  if (!auteurId) throw requeteInvalide("Utilisateur non identifié.");

  // Vérifier que l'utilisateur est participant actif
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_utilisateurId: { conversationId, utilisateurId: auteurId },
    },
  });

  if (!participation || participation.aQuitteLe) {
    throw requeteInvalide(
      "Vous n'êtes pas membre de cette conversation."
    );
  }

  if (!donnees.contenu || donnees.contenu.trim() === "") {
    throw requeteInvalide("Le message ne peut pas être vide.");
  }

  return prisma.$transaction(async (tx: Tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        auteurId,
        contenu: donnees.contenu.trim(),
        type: donnees.type || "TEXTE",
        fichierUrl: donnees.fichierUrl || undefined,
        fichierType: donnees.fichierType || undefined,
      },
      include: {
        auteur: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        piecesJointes: true,
      },
    });

    // Mettre à jour la date de modification de la conversation
    await tx.conversation.update({
      where: { id: conversationId },
      data: { modifieLe: new Date() },
    });

    return message;
  });
}

export async function listerMessages(
  conversationId: string,
  utilisateurId: string,
  parametres?: Partial<ParametresPagination> & { after?: string }
) {
  // Vérifier participation
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_utilisateurId: { conversationId, utilisateurId },
    },
  });
  if (!participation || participation.aQuitteLe) {
    throw requeteInvalide(
      "Vous n'êtes pas membre de cette conversation."
    );
  }

  const { page, limite, skip, take } = bornerPagination(parametres);

  const where: Record<string, unknown> = {
    conversationId,
    supprimeLe: null,
  };

  if (parametres?.after) {
    where.creeLe = { gt: new Date(parametres.after) };
  }

  const [total, items] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      orderBy: parametres?.after
        ? { creeLe: "asc" }
        : { creeLe: "desc" },
      skip: parametres?.after ? 0 : skip,
      take,
      include: {
        auteur: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        piecesJointes: true,
      },
    }),
  ]);

  const ordered = parametres?.after ? items.reverse() : items;

  return {
    items: ordered,
    pagination: metaPagination(page, limite, total),
  };
}

export async function marquerLu(
  conversationId: string,
  utilisateurId: string
) {
  await prisma.conversationParticipant.update({
    where: {
      conversationId_utilisateurId: { conversationId, utilisateurId },
    },
    data: { dernièreVuLe: new Date() },
  });
}

export async function compterNonLus(utilisateurId: string) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { utilisateurId, aQuitteLe: null },
    include: {
      conversation: {
        include: {
          messages: {
            where: {
              supprimeLe: null,
              auteurId: { not: utilisateurId },
            },
            orderBy: { creeLe: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  let total = 0;
  for (const p of participations) {
    const lastMsg = p.conversation.messages[0];
    if (lastMsg && (!p.dernièreVuLe || lastMsg.creeLe > p.dernièreVuLe)) {
      total++;
    }
  }
  return total;
}

// ── Recherche d'utilisateurs (pour démarrer une conversation) ─────────

export async function rechercherUtilisateurs(
  q: string,
  exclusIds: string[] = []
) {
  if (!q || q.trim().length < 2) return [];

  const where: Record<string, unknown> = {
    supprimeLe: null,
    status: "Actif",
  };

  if (exclusIds.length > 0) {
    where.id = { notIn: exclusIds };
  }

  const champTexte = { contains: q.trim(), mode: "insensitive" as const };
  where.OR = [
    { name: champTexte },
    { email: champTexte },
    { username: champTexte },
    { department: champTexte },
  ];

  return prisma.utilisateur.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
      jobTitle: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });
}
