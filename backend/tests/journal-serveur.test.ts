import { describe, expect, it, vi } from "vitest";
import { journaliser, middlewareRequeteId } from "../src/lib/journal-serveur.js";
import type { Request, Response } from "express";

// Priorité 6 — chaque requête HTTP porte un identifiant unique dans les logs,
// sans que les appelants aient à le manipuler (AsyncLocalStorage).

function fauxReq(entete?: string): Request {
  return { headers: entete ? { "x-requete-id": entete } : {} } as unknown as Request;
}
function fauxRes(): Response {
  const entetes: Record<string, string> = {};
  return {
    setHeader: (nom: string, valeur: string) => {
      entetes[nom] = valeur;
    },
    getHeaders: () => entetes
  } as unknown as Response;
}

describe("middlewareRequeteId + journaliser", () => {
  // Premier test du fichier : aucun contexte requête n'a encore été créé.
  it("les logs émis hors requête ne portent aucun identifiant", () => {
    const espion = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      journaliser("test").info("message-hors-requete");
      expect(espion.mock.calls.some((c) => String(c[0]).includes("message-hors-requete"))).toBe(true);
      for (const c of espion.mock.calls) {
        if (String(c[0]).includes("message-hors-requete")) {
          expect(String(c[0])).not.toMatch(/\[req:/);
        }
      }
    } finally {
      espion.mockRestore();
    }
  });

  it("attribue un identifiant unique et le renvoie au client", () => {
    let capture = "";
    const res = fauxRes();
    middlewareRequeteId(fauxReq(), res, () => {
      capture = String((res as unknown as { getHeaders: () => Record<string, string> }).getHeaders()["X-Requete-Id"]);
    });
    expect(capture).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("honore un identifiant fourni par un proxy de confiance (format contrôlé)", () => {
    let capture = "";
    const res = fauxRes();
    middlewareRequeteId(fauxReq("proxy-trace-1234"), res, () => {
      capture = String((res as unknown as { getHeaders: () => Record<string, string> }).getHeaders()["X-Requete-Id"]);
    });
    expect(capture).toBe("proxy-trace-1234");
  });

  it("rejette un identifiant fourni malformé et en génère un neuf", () => {
    let capture = "";
    const res = fauxRes();
    middlewareRequeteId(fauxReq("id avec espaces interdits!"), res, () => {
      capture = String((res as unknown as { getHeaders: () => Record<string, string> }).getHeaders()["X-Requete-Id"]);
    });
    expect(capture).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("les logs émis DANS la requête portent [req:<id>], plus jamais après sortie", () => {
    const espion = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const journal = journaliser("test");
      const appels: string[] = [];
      const capter = (message: string) => {
        journal.info(message);
        // La ligne vient d'être émise : dernier appel du espion.
        appels.push(String(espion.mock.lastCall![0]));
      };

      middlewareRequeteId(fauxReq("req-fixe-abcd1234"), fauxRes(), () => {
        capter("dans-requete-marque");
      });
      // Sortie SYNCHRONE de run() : la continuation n'est pas piégée.
      capter("apres-requete-sans-ctx");

      expect(appels[0]).toMatch(/\[req:req-fixe-abcd1234\]/);
      expect(appels[1]).not.toMatch(/\[req:/);
    } finally {
      espion.mockRestore();
    }
  });
});
