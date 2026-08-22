import type { Request } from "express";
import { adresseIpDe } from "./auth.js";

// Chantier 3 — contexte d'acteur transmis aux services mutateurs (convention
// AGENTS.md : service(contexte, donnees)). Construit par la couche route à
// partir de la session authentifiée ; alimente le journal d'audit.
export interface ContexteActeur {
  utilisateurId: string | null;
  nomUtilisateur: string;
  adresseIp: string | null;
  agentUtilisateur: string | null;
}

export function acteurDepuis(req: Request): ContexteActeur {
  const contexte = req.contexteAuth;
  const agent = req.headers["user-agent"];
  return {
    utilisateurId: contexte?.utilisateurId ?? null,
    nomUtilisateur: contexte?.utilisateur.username ?? "système",
    adresseIp: adresseIpDe(req),
    agentUtilisateur: typeof agent === "string" && agent.length > 0 ? agent.slice(0, 250) : null
  };
}
