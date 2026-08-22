import express from "express";
import path from "path";
import { routerApi, gestionnaireErreurs, verifierBase } from "./routes/index.js";
import { serialiser } from "./lib/serialisation.js";

const app = express();

app.use(express.json());

// Sérialisation unique des réponses API : Decimal → nombre, dates,
// renommages (creeLe → createdAt, derniereConnexion → lastLogin).
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
