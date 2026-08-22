import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Chantier 3 → 3.5 — notifications internes.
// Chantier 3.5 (P1.5) : FINI le modèle global. Chaque notification vise UN
// destinataire (fan-out à la création) : la lecture par A ne marque plus
// « lue » pour B. Audience par défaut = comptes actifs portant les
// permissions opérationnelles (stock/affectations) ou le rôle SUPER_ADMIN ;
// un appelant peut imposer une liste précise de destinataires.
// Déduplication : index unique partiel (type, entité, destinataire) — une
// seule alerte OUVERTE par entité ET par destinataire, même sous concurrence.

export const TYPES_NOTIFICATION = {
  STOCK_FAIBLE: "STOCK_FAIBLE",
  MATERIEL_ENDOMMAGE: "MATERIEL_ENDOMMAGE",
  MAINTENANCE_DEMARREE: "MAINTENANCE_DEMARREE",
  MAINTENANCE_TERMINEE: "MAINTENANCE_TERMINEE",
  INCOHERENCE_DONNEES: "INCOHERENCE_DONNEES",
  INTERVENTION_ADMIN: "INTERVENTION_ADMIN"
} as const;

export interface DonneesNotification {
  type: string;
  titre: string;
  message: string;
  entite?: string | null;
  entiteId?: string | null;
  cibleOnglet?: string | null;
  /** Destinataires explicites ; à défaut, l'audience opérationnelle par défaut. */
  destinataireIds?: string[];
}

/** IDs des membres de l'audience opérationnelle (comptes actifs). */
async function audienceParDefaut(): Promise<string[]> {
  const lignes = await prisma.utilisateur.findMany({
    where: {
      supprimeLe: null,
      status: "Actif",
      OR: [
        { role: { code: "SUPER_ADMIN" } },
        { role: { permissions: { some: { permission: { code: { in: ["stock.ecrire", "affectations.ecrire"] } } } } } }
      ]
    },
    select: { id: true }
  });
  return lignes.map((l) => l.id);
}

/**
 * Crée la notification pour chaque destinataire (fan-out). Un doublon
 * (alerte déjà OUVERTE même type/entité/destinataire, P2002 sur l'index
 * partiel) est ignoré silencieusement. Une notification manquante ne fait
 * jamais échouer l'opération métier qui la déclenche.
 */
export async function notifier(donnees: DonneesNotification): Promise<void> {
  const destinataires =
    donnees.destinataireIds && donnees.destinataireIds.length > 0
      ? donnees.destinataireIds
      : await audienceParDefaut();

  for (const destinataireId of destinataires) {
    try {
      await prisma.notification.create({
        data: {
          type: donnees.type,
          titre: donnees.titre,
          message: donnees.message,
          entite: donnees.entite ?? null,
          entiteId: donnees.entiteId ?? null,
          cibleOnglet: donnees.cibleOnglet ?? null,
          destinataireId
        }
      });
    } catch (erreur) {
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === "P2002"
      ) {
        continue; // déjà ouverte pour ce destinataire : déduplication
      }
      console.error(`Notification non envoyée à ${destinataireId} :`, erreur);
    }
  }
}

/**
 * Résout les alertes ouvertes d'un type pour une entité, TOUS destinataires
 * confondus (ex. stock remonté au-dessus du seuil). Idempotent.
 */
export async function resoudreNotifications(type: string, entiteId: string): Promise<number> {
  const resultat = await prisma.notification.updateMany({
    where: { type, entiteId, statut: "OUVERTE" },
    data: { statut: "RESOLUE", resolueLe: new Date() }
  });
  return resultat.count;
}

/**
 * Contrôle de seuil après toute mutation de stock : crée STOCK_FAIBLE si le
 * disponible passe sous le seuil, résout l'alerte ouverte s'il le dépasse.
 * À appeler avec l'état APRÈS écriture.
 */
export async function verifierSeuilStock(article: {
  id: string;
  name: string;
  reference: string;
  availableQty: number;
  minThreshold: number;
}): Promise<void> {
  if (article.minThreshold <= 0) return;
  if (article.availableQty <= article.minThreshold) {
    await notifier({
      type: TYPES_NOTIFICATION.STOCK_FAIBLE,
      titre: "Stock sous le seuil d'alerte",
      message: `« ${article.name} » (${article.reference}) : ${article.availableQty} unité(s) disponible(s) pour un seuil minimal de ${article.minThreshold}.`,
      entite: "ArticleStock",
      entiteId: article.id,
      cibleOnglet: "stock"
    });
  } else {
    await resoudreNotifications(TYPES_NOTIFICATION.STOCK_FAIBLE, article.id);
  }
}
