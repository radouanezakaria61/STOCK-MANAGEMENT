import { prisma } from "../lib/prisma.js";
import { introuvable, interdit } from "../lib/erreurs.js";

// Chantier 3.5 (P1.5) — notifications PAR DESTINATAIRE.
//  - Lister / compter : uniquement les notifications visant l'utilisateur
//    courant (le filtre serveur est la seule source de vérité).
//  - Marquer « lue » : réservé au destinataire de la notification — lire la
//    sienne ne change rien pour les autres destinataires du même événement.
//  - Tout marquer : batch limité aux notifications OUVERTES du demandeur.

const LIMITE_LISTE = 50;

export async function listerNotifications(destinataireId: string) {
  const [items, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where: { destinataireId },
      orderBy: { creeLe: "desc" },
      take: LIMITE_LISTE
    }),
    prisma.notification.count({ where: { destinataireId, statut: "OUVERTE" } })
  ]);
  return { items, nonLues };
}

export async function marquerCommeLue(id: string, destinataireId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw introuvable("Notification introuvable.");
  if (notification.destinataireId !== destinataireId) {
    throw interdit("Cette notification n'est pas adressée à votre compte.");
  }
  if (notification.statut === "OUVERTE") {
    await prisma.notification.update({
      where: { id },
      data: { statut: "LUE", lueLe: new Date() }
    });
  }
  return { message: "Notification marquée comme lue." };
}

/** Batch « tout marquer comme lu » : périmètre strictement personnel. */
export async function marquerToutCommeLues(destinataireId: string) {
  const resultat = await prisma.notification.updateMany({
    where: { destinataireId, statut: "OUVERTE" },
    data: { statut: "LUE", lueLe: new Date() }
  });
  return { message: `${resultat.count} notification(s) marquée(s) comme lue(s).`, total: resultat.count };
}
