import dotenv from "dotenv";
import { app, verifierBase } from "./app.js";
import { demarrerPurgePlanifiee } from "./lib/purge-technique.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);

async function demarrer() {
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

  const serveur = app.listen(PORT, "0.0.0.0", () => {
    console.log(`API Server (backend) actif sur http://0.0.0.0:${PORT}`);
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
