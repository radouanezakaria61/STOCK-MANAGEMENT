import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Chantier 3 — notifications internes (points 11 à 14).
//  - Aucun email/SMS simulé : le seul canal est l'application elle-même.
//    L'interface CanalNotification prépare l'ajout futur d'un vrai canal
//    (SMTP configuré, webhook…) sans toucher aux services.
//  - Déduplication : les alertes persistantes (stock sous seuil) ne sont
//    créées qu'une fois — l'index unique partiel `uq_notification_alerte_ouverte`
//    garantit une seule notification OUVERTE par (type, entité), même sous
//    concurrence. Une résolution (stock remonté au-dessus du seuil) rouvre
//    la porte à une occurrence future.

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
}

/** Canal de notification (point 14) : interne aujourd'hui, SMTP/webhook plus tard. */
export interface CanalNotification {
  readonly nom: string;
  envoyer(donnees: DonneesNotification): Promise<void>;
}

const canalInterne: CanalNotification = {
  nom: "interne",
  async envoyer(donnees) {
    await prisma.notification.create({
      data: {
        type: donnees.type,
        titre: donnees.titre,
        message: donnees.message,
        entite: donnees.entite ?? null,
        entiteId: donnees.entiteId ?? null,
        cibleOnglet: donnees.cibleOnglet ?? null
      }
    });
  }
};

const canaux: readonly CanalNotification[] = [canalInterne];

/**
 * Crée une notification dédupliquée. Le doublon éventuel (alerte déjà
 * OUVERTE pour la même entité) est ignoré silencieusement : rafraîchir un
 * écran ou retomber sous le seuil ne doit jamais empiler des copies.
 */
export async function notifier(donnees: DonneesNotification): Promise<void> {
  for (const canal of canaux) {
    try {
      await canal.envoyer(donnees);
    } catch (erreur) {
      if (
        erreur instanceof Prisma.PrismaClientKnownRequestError &&
        erreur.code === "P2002"
      ) {
        return; // alerte déjà ouverte : déduplication
      }
      // Une notification manquante ne doit jamais faire échouer l'opération
      // métier qui la déclenche : on trace et on continue.
      console.error(`Canal « ${canal.nom} » : notification non envoyée :`, erreur);
    }
  }
}

/**
 * Résout les alertes ouvertes d'un type pour une entité (ex. stock revenu
 * au-dessus du seuil). Appelée après les opérations qui peuvent fermer une
 * alerte ; idempotent.
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
 * disponible passe sous le seuil (alerte activée), résout l'alerte ouverte
 * s'il le dépasse à nouveau. À appeler avec l'état APRÈS écriture.
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
