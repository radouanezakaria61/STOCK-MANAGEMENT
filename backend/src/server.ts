import dotenv from "dotenv";
import { app, verifierBase } from "./app.js";
import { demarrerPurgePlanifiee } from "./lib/purge-technique.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
// M4 (Phase 1) : adresse d'écoute paramétrable. Défaut « 0.0.0.0 » (toutes
// les interfaces, déploiement LAN direct) ; derrière un reverse proxy sur la
// même machine, lier « 127.0.0.1 » empêche tout contournement du TLS.
const HOST = process.env.HOST || "0.0.0.0";

async function demarrer() {
  // M4 : en production sans reverse proxy déclaré, l'IP client vue par les
  // limiteurs sera celle du proxy et le TLS ne sera pas terminé par nous.
  // Ce n'est PAS une erreur (le déploiement LAN direct reste supporté) mais
  // l'exploitant doit le savoir explicitement.
  if (process.env.NODE_ENV === "production" && !(process.env.TRUST_PROXY ?? "").trim()) {
    console.warn(
      "\n⚠ MODE PRODUCTION SANS TRUST_PROXY :\n" +
        "  - aucun en-tête X-Forwarded-* n'est cru : si un reverse proxy est\n" +
        "    présent devant ce serveur, définissez TRUST_PROXY (cf. docs/DEPLOIEMENT.md) ;\n" +
        "  - sans proxy, assurez-vous que HTTPS est assuré autrement (LAN chiffré/VPN).\n"
    );
  }

  const baseOk = await verifierBase();
  if (!baseOk) {
    console.error(
      `\n✗ Impossible de démarrer : la base PostgreSQL est inaccessible.\n` +
        `  Vérifiez DATABASE_URL dans backend/.env et que le service postgresql-x64-16 tourne.\n`
    );
    process.exit(1);
  }

  // M3 (Phase 1) : purge planifiée des données techniques expirées
  // (sessions, clés d'idempotence, compteurs du limiteur de connexion).
  const arreterPurge = demarrerPurgePlanifiee();

  const serveur = app.listen(PORT, HOST, () => {
    console.log(`API Server (backend) actif sur http://${HOST}:${PORT}`);
  });

  // Arrêt propre (M4 : le reverse proxy enverra SIGTERM au rechargement) :
  // on cesse d'accepter les connexions, on attend les requêtes en vol,
  // puis on coupe les planificateurs.
  const arreterProprement = (signal: string) => {
    console.log(`\nSignal ${signal} reçu : arrêt en cours…`);
    serveur.close(() => {
      arreterPurge();
      process.exit(0);
    });
    // Filet de sécurité si une requête reste pendue.
    setTimeout(() => {
      arreterPurge();
      process.exit(0);
    }, 5_000).unref();
  };
  process.once("SIGINT", () => arreterProprement("SIGINT"));
  process.once("SIGTERM", () => arreterProprement("SIGTERM"));
}

demarrer();
