import express from "express";
import path from "path";
import helmet from "helmet";
import { routerApi, gestionnaireErreurs, verifierBase } from "./routes/index.js";
import { serialiser } from "./lib/serialisation.js";
import { interpreterTrustProxy } from "./lib/confiance-proxy.js";
import { middlewareRequeteId } from "./lib/journal-serveur.js";

const app = express();

// Chantier 3.5 (P1.1) : la confiance aux en-têtes X-Forwarded-* est
// EXPLICITE et désactivée par défaut. En déploiement direct LAN/VPN, un
// client peut forger X-Forwarded-For : il ne doit jamais être cru.
// M4 (Phase 1) : TRUST_PROXY accepte désormais la grammaire complète
// d'Express (sauts, mots-clés, IP, CIDR, liste) et est VALIDÉ strictement —
// une valeur invalide fait échouer le démarrage au lieu d'être ignorée.
app.set("trust proxy", interpreterTrustProxy(process.env.TRUST_PROXY));

// En-têtes HTTP de sécurité de base.
// H5 (Phase 1) : la CSP est ACTIVE et adaptée aux besoins réels du SPA
// (inventaire effectué : aucun CDN, aucune police externe, logo SVG inline
// en data: pour les PDF, API strictement même origine) :
//   - script-src 'self' strict : le build Vite n'émet AUCUN script inline
//     (vérifié sur frontend/dist/index.html), pas de eval ajouté ;
//   - style-src : « 'self' 'unsafe-inline' » — analyse du chantier
//     « corrections restantes » (P9), décision MAINTENUE, voici pourquoi :
//     le build n'émet ni <style> ni feuille runtime (CSS extrait dans
//     assets/*.css) ; ce qui exige 'unsafe-inline' ici, ce sont les
//     ATTRIBUTS style="" posés par React (style={{…}} : barres de
//     progression à largeur DYNAMIQUE, tooltips Recharts). Une CSP sans
//     'unsafe-inline' bloque tout attribut style ; l'alternative CSP3
//     ('unsafe-hashes' + hash de chaque valeur littérale) ne peut PAS
//     couvrir des valeurs calculées à l'exécution. S'en passer imposerait
//     de quantifier les indicateurs visuels en classes pré-générées —
//     refactor visuel risqué pour un gain nul : un attribut style ne peut
//     pas exécuter de script dans un navigateur moderne et le vecteur
//     réel (script inline/eval) reste fermé par script-src strict.
//     Réévaluer si les composants à style dynamique disparaissent.
//   - img-src data: : le logo Distra (utils/distraLogo.ts) est un SVG
//     encodé data: consommé par jsPDF côté client.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Pas de 'unsafe-eval', jamais ; 'unsafe-inline' ci-dessus justifié.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        // Explicitement DÉSACTIVÉ (présent dans les defaults Helmet) :
        // l'app doit rester pleinement fonctionnelle sur un LAN servi en
        // HTTP simple ; la montée automatique vers https:// casserait les
        // requêtes mêmes origines. Le passage TLS se pilote au reverse
        // proxy — cf. M4 / docs/DEPLOIEMENT.md.
        upgradeInsecureRequests: null as unknown as string[]
      }
    },
    // HSTS : émis par Helmet par défaut ; ignoré par les navigateurs tant
    // que le site n'est pas servi en HTTPS — voir docs/DEPLOIEMENT.md (M4).
    crossOriginEmbedderPolicy: false
  })
);

// Limite de corps : aucune route métier n'a besoin d'un payload massif.
app.use(express.json({ limit: "100kb" }));

// Priorité 6 : identifiant de requête — attribué AVANT toute journalisation
// API, renvoyé au client via X-Requete-Id et apposé sur chaque ligne de log
// émise pendant le traitement (AsyncLocalStorage, sans changer les signatures).
app.use("/api", middlewareRequeteId);

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
