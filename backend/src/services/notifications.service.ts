import { prisma } from "../lib/prisma.js";
import { introuvable } from "../lib/erreurs.js";

// Chantier 3 — service de lecture des notifications internes.
// La création passe par lib/notifications.ts (dédupliquée, post-commit) ;
// ici : consultation par l'interface et marquage « LUE ».

const LIMITE_LISTE = 50;

export async function listerNotifications() {
  const [items, nonLues] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { creeLe: "desc" },
      take: LIMITE_LISTE
    }),
    prisma.notification.count({ where: { statut: "OUVERTE" } })
  ]);
  return { items, nonLues };
}

export async function marquerCommeLue(id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw introuvable("Notification introuvable.");
  if (notification.statut === "OUVERTE") {
    await prisma.notification.update({
      where: { id },
      data: { statut: "LUE", lueLe: new Date() }
    });
  }
  return { message: "Notification marquée comme lue." };
}
