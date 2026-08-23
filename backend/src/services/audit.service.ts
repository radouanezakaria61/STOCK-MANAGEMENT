import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { versDate } from "../lib/ids.js";
// H4 (Phase 1) — consultation du journal d'audit.
// La permission « audit.consulter » est exigée par la ROUTE (exigerPermission) ;
// ce service ne connaît ni req ni res. Le journal reste en écriture seule
// (AGENTS.md règle 3) : ici, lecture paginée côté serveur uniquement.
//
// Garde-fou de restitution : les instantanés sont déjà écrits via une liste
// blanche (`instantane()`), mais la lecture re-filtre défensivement toute clé
// ressemblant à un secret avant d'envoyer les JSON au client. Une fuite ne
// peut donc venir que d'une régression simultanée de DEUX barrières.

const LIMITE_PAR_DEFAUT = 50;
const LIMITE_MAXIMALE = 200;

export interface FiltresJournalAudit {
  action?: string;
  utilisateurId?: string;
  identifiant?: string;
  entite?: string;
  entiteId?: string;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  limite?: number;
}

// Clés jamais restituées, même si un jour un appelant écrivait un objet
// brut dans details/valeursAvant/valeursApres (défense en profondeur).
const MOTIF_SECRET = /(motdepasse|password|token|hash|simpin|simpuk|clechiffrement|secret|cookie|authorization)/i;
const VALEUR_FILTREE = "[filtré]";

function filtrerSecrets(valeur: unknown, cle?: string): unknown {
  if (valeur === null || valeur === undefined) return valeur;
  if (Array.isArray(valeur)) return valeur.map((element) => filtrerSecrets(element));
  if (typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      if (MOTIF_SECRET.test(k)) {
        // Ne garder qu'un objet non vide pour signaler la présence d'un champ masqué.
        sortie[k] = VALEUR_FILTREE;
      } else {
        sortie[k] = filtrerSecrets(v, k);
      }
    }
    return sortie;
  }
  if (typeof cle === "string" && MOTIF_SECRET.test(cle)) return VALEUR_FILTREE;
  if (typeof valeur === "string" && valeur.length > 2000) {
    return `${valeur.slice(0, 2000)}…[tronqué]`;
  }
  return valeur;
}

export async function listerJournal(filtres: FiltresJournalAudit) {
  const page = Math.max(1, Math.floor(filtres.page ?? 1));
  const limite = Math.min(
    LIMITE_MAXIMALE,
    Math.max(1, Math.floor(filtres.limite ?? LIMITE_PAR_DEFAUT))
  );

  const conditions: Prisma.JournalAuditWhereInput[] = [];

  if (filtres.action && filtres.action.trim() !== "") {
    conditions.push({ action: filtres.action.trim().toUpperCase() });
  }
  if (filtres.utilisateurId && filtres.utilisateurId.trim() !== "") {
    conditions.push({ utilisateurId: filtres.utilisateurId.trim() });
  }
  if (filtres.identifiant && filtres.identifiant.trim() !== "") {
    conditions.push({
      identifiantTente: { contains: filtres.identifiant.trim(), mode: "insensitive" as const }
    });
  }
  if (filtres.entite && filtres.entite.trim() !== "") {
    conditions.push({ entite: filtres.entite.trim() });
  }
  if (filtres.entiteId && filtres.entiteId.trim() !== "") {
    conditions.push({ entiteId: filtres.entiteId.trim() });
  }
  // Dates métier au format AAAA-MM-JJ (versDate lève DATE_INVALIDE sur du bruit).
  const debut = versDate(filtres.dateDebut);
  if (debut) conditions.push({ creeLe: { gte: new Date(debut.getTime() - 12 * 3_600_000) } });
  if (filtres.dateFin != null && filtres.dateFin !== "") {
    const fin = versDate(filtres.dateFin);
    if (fin) conditions.push({ creeLe: { lt: new Date(fin.getTime() + 12 * 3_600_000) } });
  }

  const where: Prisma.JournalAuditWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  // Ordre stable et déterministe : plus récent d'abord, id comme tie-breaker
  // (deux entrées partageant la même milliseconde gardent toujours le même ordre).
  const [total, lignes] = await Promise.all([
    prisma.journalAudit.count({ where }),
    prisma.journalAudit.findMany({
      where,
      orderBy: [{ creeLe: "desc" }, { id: "desc" }],
      skip: (page - 1) * limite,
      take: limite,
      include: {
        utilisateur: { select: { id: true, username: true, name: true } }
      }
    })
  ]);

  return {
    items: lignes.map((entree) => ({
      id: entree.id,
      action: entree.action,
      utilisateurId: entree.utilisateurId,
      utilisateur: entree.utilisateur,
      identifiantTente: entree.identifiantTente,
      entite: entree.entite,
      entiteId: entree.entiteId,
      details: filtrerSecrets(entree.details),
      valeursAvant: filtrerSecrets(entree.valeursAvant),
      valeursApres: filtrerSecrets(entree.valeursApres),
      adresseIp: entree.adresseIp,
      creeLe: entree.creeLe
      // agentUtilisateur volontairement omis : technique, verbeux, sans valeur
      // pour l'auditeur métier dans l'interface.
    })),
    pagination: {
      page,
      limite,
      total,
      pages: Math.max(1, Math.ceil(total / limite))
    }
  };
}
