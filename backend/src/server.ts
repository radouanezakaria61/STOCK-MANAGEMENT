import dotenv from "dotenv";
import { app, verifierBase } from "./app.js";

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API Server (backend) actif sur http://0.0.0.0:${PORT}`);
  });
}

demarrer();
