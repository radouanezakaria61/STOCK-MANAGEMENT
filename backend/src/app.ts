import express from "express";
import path from "path";
import helmet from "helmet";
import { routerApi, gestionnaireErreurs, verifierBase } from "./routes/index.js";
import { serialiser } from "./lib/serialisation.js";

const app = express();

// Chantier 3.5 (P1.1) : la confiance aux en-têtes X-Forwarded-* est
// EXPLICITE et désactivée par défaut. En déploiement direct LAN/VPN, un
// client peut forger X-Forwarded-For : il ne doit jamais être cru.
// Derrière un reverse proxy de confiance, définir TRUST_PROXY au nombre
// de sauts (ex. TRUST_PROXY=1) — Express détermine alors l'IP cliente.
const sautsProxy = Number(process.env.TRUST_PROXY ?? "");
app.set("trust proxy", Number.isInteger(sautsProxy) && sautsProxy >= 0 ? sautsProxy : false);

// En-têtes HTTP de sécurité de base. CSP laissée ouverte : le SPA Vite est
// servi par ce backend en production ; un durcissement CSP viendra avec le
// chantier « durcissement » (phase 41+).
app.use(helmet({ contentSecurityPolicy: false }));

// Limite de corps : aucune route métier n'a besoin d'un payload massif.
app.use(express.json({ limit: "100kb" }));

// Sérialisation unique des réponses API : Decimal → nombre, dates ISO,
// champs internes filtrés — aucun renommage (AGENTS.md « Langue des clés »).
app.use("/api", (req, res, next) => {
  const jsonOriginal = res.json.bind(res);
  res.json = ((body: unknown) => jsonOriginal(serialiser(body))) as typeof res.json;
  next();
});

// Point d'entrée unique de l'API — le serveur est la seule source de vérité.
app.use("/api", routerApi);

// Gestion centralisée des erreurs métier → codes HTTP
app.use("/api", gestionnaireErreurs);

// En production : service du build statique du frontend (../frontend/dist)
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(process.cwd(), "..", "frontend", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export { app, verifierBase };
