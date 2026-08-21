import { Router } from "express";
import { analyserOffres, redigerClauses } from "../services/ia.service.js";

const iaRoutes = Router();

iaRoutes.post("/ai/analyze-bids", async (req, res) => {
  const resultat = await analyserOffres(req.body);
  res.json(resultat.corps);
});

iaRoutes.post("/ai/draft-terms", async (req, res) => {
  const resultat = await redigerClauses(req.body);
  res.json(resultat.corps);
});

export default iaRoutes;
