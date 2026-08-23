import { prisma } from "./prisma.js";
import { journaliser } from "./journal-serveur.js";

const journalPurge = journaliser("purge");

// ══════════════════════════════════════════════════════════════════════
// M3 (Phase 1) — purge maîtrisée des DONNÉES TECHNIQUES expirées.
//
// Périmètre strictement technique : sessions expirées, réservations
// d'idempotence périmées, compteurs morts du limiteur de connexion.
//
// Ne sont JAMAIS touchés par cette purge :
//   • journal_audit — immuable et conservé (règle 3 AGENTS.md, trigger SQL) ;
//   • notifications — données métier adressées aux utilisateurs ; leur cycle
//     de vie (OUVERTE/LUE/RÉSOLUE) reste une politique produit, pas une
//     affaire de stockage ;
//   • tout contenu métier (articles, mouvements, affectations…).
// ══════════════════════════════════════════════════════════════════════

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;

/** Grace de conservation après expiration : une session dont `expireLe` date
 *  de moins d'une heure n'est pas supprimée — tolère un léger décalage
 *  d'horloge et évite de couper la session d'un onglet encore ouvert. */
const GRACE_SESSIONS_MS = HEURE_MS;

/** Rétention des clés d'idempotence : alignée sur DUREE_CONSERVATION_MS du
 *  middleware (24 h) — au-delà, toute retransmission légitime est exclue. */
const RETENTION_IDEMPOTENCE_MS = JOUR_MS;

/** Un compteur du limiteur de connexion est « mort » quand sa fenêtre
 *  d'échecs (15 min) est close depuis plus d'une heure ET que son éventuel
 *  blocage est terminé depuis plus de 24 h. Les compteurs vivants ou
 *  récemment actifs sont préservés (baseline C2 intacte). */
const FENETRE_MORTE_MS = HEURE_MS;
const FIN_BLOCAGE_CONSERVE_MS = JOUR_MS;

export interface BilanPurge {
  sessionsPurgees: number;
  requetesIdempotentesPurgees: number;
  tentativesConnexionPurgees: number;
  limitationIpPurgees: number;
}

export async function purgerDonneesTechniques(): Promise<BilanPurge> {
  const maintenant = Date.now();

  // Séquentiel volontaire (pas Promise.all) : quatre DELETE indépendants et
  // brefs ; l'ordre stable facilite la lecture des logs de purge.
  const sessions = await prisma.session.deleteMany({
    where: { expireLe: { lt: new Date(maintenant - GRACE_SESSIONS_MS) } }
  });

  const requetesIdempotentes = await prisma.requeteIdempotente.deleteMany({
    where: { creeLe: { lt: new Date(maintenant - RETENTION_IDEMPOTENCE_MS) } }
  });

  // Politique identique pour les deux tables de compteurs du limiteur de
  // connexion (tentatives_connexion et limitation_ip, cette dernière ajoutée
  // au chantier M2) : fenêtre d'échecs close depuis >1 h ET blocage éventuel
  // terminé depuis >24 h. Les compteurs vivants ou récemment actifs restent.
  const frontiereFenetre = new Date(maintenant - FENETRE_MORTE_MS);
  const frontiereBlocage = new Date(maintenant - FIN_BLOCAGE_CONSERVE_MS);

  const tentativesConnexion = await prisma.tentativeConnexion.deleteMany({
    where: {
      fenetreOuverte: { lt: frontiereFenetre },
      OR: [{ bloqueJusqua: null }, { bloqueJusqua: { lt: frontiereBlocage } }]
    }
  });

  const limitationIp = await prisma.limitationIp.deleteMany({
    where: {
      fenetreOuverte: { lt: frontiereFenetre },
      OR: [{ bloqueJusqua: null }, { bloqueJusqua: { lt: frontiereBlocage } }]
    }
  });

  return {
    sessionsPurgees: sessions.count,
    requetesIdempotentesPurgees: requetesIdempotentes.count,
    tentativesConnexionPurgees: tentativesConnexion.count,
    limitationIpPurgees: limitationIp.count
  };
}

/** Planificateur : première passe ~15 s après le démarrage (laisser le port
 *  s'ouvrir et les migrations s'appliquer), puis à intervalle fixe. Le timer
 *  est « unref'd » pour ne pas maintenir le process artificiellement en vie,
 *  et une garde anti-chevauchement protège contre les passes longues. */
export function demarrerPurgePlanifiee(): () => void {
  const minutes = parseInt(process.env.PURGE_INTERVALLE_MINUTES || "360", 10);
  const intervalleMs = Math.max(5, Number.isFinite(minutes) ? minutes : 360) * 60_000;

  let passeEnCours = false;

  const passer = async (): Promise<void> => {
    if (passeEnCours) return;
    passeEnCours = true;
    try {
      const bilan = await purgerDonneesTechniques();
      journalPurge.info(
        `données techniques : ${bilan.sessionsPurgees} session(s), ` +
          `${bilan.requetesIdempotentesPurgees} clé(s) d'idempotence, ` +
          `${bilan.tentativesConnexionPurgees} compteur(s) de connexion, ` +
          `${bilan.limitationIpPurgees} compteur(s) IP.`
      );
    } catch (erreur) {
      // La purge est un service rendu, jamais une exigence : un échec est
      // loggé et retenté à la prochaine échéance.
      journalPurge.erreur("échec de la purge planifiée", erreur);
    } finally {
      passeEnCours = false;
    }
  };

  const premierePasse = setTimeout(() => void passer(), 15_000);
  premierePasse.unref();
  const periodique = setInterval(() => void passer(), intervalleMs);
  periodique.unref();

  return () => {
    clearTimeout(premierePasse);
    clearInterval(periodique);
  };
}
