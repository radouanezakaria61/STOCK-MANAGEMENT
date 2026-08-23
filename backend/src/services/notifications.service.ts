import { prisma } from "../lib/prisma.js";
import { introuvable, interdit } from "../lib/erreurs.js";
import {
  bornerPagination,
  metaPagination,
  type ParametresPagination
} from "../lib/pagination.js";

// Chantier 3.5 (P1.5) — notifications PAR DESTINATAIRE.
//  - Lister / compter : uniquement les notifications visant l'utilisateur
//    courant (le filtre serveur est la seule source de vérité).
//  - Marquer « lue » : réservé au destinataire de la notification — lire la
//    sienne ne change rien pour les autres destinataires du même événement.
//  - Tout marquer : batch limité aux notifications OUVERTES du demandeur.

export async function listerNotifications(
  destinataireId: string,
  parametres?: Partial<ParametresPagination>
) {
  // Priorité 2 : la boîte de réception est paginée elle aussi (une boîte
  // ne se télécharge jamais « en entier »), compteur non-lues séparé.
  const { page, limite, skip, take } = bornerPagination(parametres);
  const [items, nonLues, total] = await Promise.all([
    prisma.notification.findMany({
      where: { destinataireId },
      orderBy: [{ creeLe: "desc" }, { id: "desc" }],
      skip,
      take
    }),
    prisma.notification.count({ where: { destinataireId, statut: "OUVERTE" } }),
    prisma.notification.count({ where: { destinataireId } })
  ]);
  return { items, nonLues, pagination: metaPagination(page, limite, total) };
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
