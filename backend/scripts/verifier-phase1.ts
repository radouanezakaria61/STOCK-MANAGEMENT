/**
 * Vérification Phase 1 — Durcissement & robustesse.
 * Chaque chantier ajoute sa section : H4 (journal d'audit), H5 (CSP),
 * M6 (validation Zod), M3 (purge technique), M1 (CSRF), M2 (limiteur IP),
 * M4 (proxy/HTTPS), M5 (identifiants sans collision).
 *
 * Prérequis : serveur démarré sur BASE (défaut http://localhost:3001) et
 * backend/.env renseigné (MOT_DE_PASSE_DEMO). La suite rejoue le seed pour
 * garantir un état connu, puis exécute des contrôles HTTP réels.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

const BASE = process.env.API_BASE || "http://localhost:3001";

const MDP_DEMO = process.env.MOT_DE_PASSE_DEMO;
if (!MDP_DEMO) {
  console.error("MOT_DE_PASSE_DEMO manquant : renseignez-le dans backend/.env.");
  process.exit(1);
}

let echecs = 0;
function verif(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  OK   ${nom}`);
  } else {
    echecs++;
    console.error(`  FAIL ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

interface ReponseJson<T = any> {
  status: number;
  corps: T;
  entetes: Headers;
}

/** En-têtes communs : les mutations portent l'en-tête anti-CSRF attendu
 *  (renforcement M1 de la Phase 1 ; inoffensif avant son activation). */
function entetesBase(init: RequestInit): Headers {
  const entetes = new Headers(init.headers);
  if (init.method && init.method.toUpperCase() !== "GET") {
    entetes.set("x-requested-with", "XMLHttpRequest");
  }
  return entetes;
}

/** Session HTTP : jar de cookies minimal (le jeton vit dans le cookie). */
class SessionHttp {
  private jetons = new Map<string, string>();

  private enteteCookie(): string {
    return [...this.jetons.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async requete(chemin: string, init: RequestInit = {}): Promise<Response> {
    const entetes = entetesBase(init);
    const cookie = this.enteteCookie();
    if (cookie) entetes.set("cookie", cookie);
    return fetch(`${BASE}${chemin}`, { ...init, headers: entetes });
  }

  async json(chemin: string, init: RequestInit = {}): Promise<ReponseJson> {
    const res = await this.requete(chemin, init);
    let corps: any;
    try {
      corps = await res.json();
    } catch {
      corps = null;
    }
    return { status: res.status, corps, entetes: res.headers };
  }

  /** Connexion : capture le cookie de session posé par le serveur. */
  async connexion(identifiant: string, motDePasse: string): Promise<ReponseJson> {
    const res = await this.requete("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifiant, motDePasse })
    });
    const brutSetCookie =
      (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const brut of brutSetCookie.length ? brutSetCookie : [res.headers.get("set-cookie") ?? ""]) {
      if (!brut) continue;
      const paire = brut.split(";")[0]!;
      const idx = paire.indexOf("=");
      if (idx > 0) this.jetons.set(paire.slice(0, idx).trim(), paire.slice(idx + 1).trim());
    }
    return { status: res.status, corps: await res.json(), entetes: res.headers };
  }

  oublier(): void {
    this.jetons.clear();
  }
}

async function main() {
  // ══════════ 0. ÉTAT CONNU ══════════
  console.log("── 0. Réinitialisation (seed démonstration) ──");
  execSync("npx prisma db seed", { stdio: "inherit" });

  const admin = new SessionHttp();
  const auditeur = new SessionHttp();
  const employe = new SessionHttp();

  // ══════════ H4 — JOURNAL D'AUDIT CONSULTABLE ══════════
  console.log("\n── H4. Journal d'audit : API protégée, paginée, filtrée ──");
  {
    const cAdmin = await admin.connexion("zakaria.radouane", MDP_DEMO);
    verif("H4-0 connexion SUPER_ADMIN", cAdmin.status === 200, `status=${cAdmin.status}`);
    const cAuditeur = await auditeur.connexion("sarah.benali", MDP_DEMO);
    verif("H4-0 connexion AUDITOR", cAuditeur.status === 200, `status=${cAuditeur.status}`);
    const cEmploye = await employe.connexion("karim.berrada", MDP_DEMO);
    verif("H4-0 connexion EMPLOYEE", cEmploye.status === 200, `status=${cEmploye.status}`);

    // Anonyme : 401
    const anonyme = await fetch(`${BASE}/api/audit`);
    verif("H4-1 anonyme → 401", anonyme.status === 401, `status=${anonyme.status}`);

    // Rôle sans permission : 403 (contrôle SERVEUR, pas seulement l'UI)
    const rEmploye = await employe.json("/api/audit");
    verif("H4-2 EMPLOYEE sans audit.consulter → 403", rEmploye.status === 403, `status=${rEmploye.status}`);

    // Autorisés : SUPER_ADMIN et AUDITOR
    const rAdmin = await admin.json("/api/audit?limite=100");
    verif("H4-3 SUPER_ADMIN → 200", rAdmin.status === 200, `status=${rAdmin.status}`);
    const rAuditeur = await auditeur.json("/api/audit?limite=25");
    verif("H4-4 AUDITOR → 200", rAuditeur.status === 200, `status=${rAuditeur.status}`);

    const journal = rAdmin.corps?.data;
    verif(
      "H4-5 forme de la réponse (items + pagination)",
      Array.isArray(journal?.items) &&
        typeof journal?.pagination?.page === "number" &&
        typeof journal?.pagination?.total === "number" &&
        typeof journal?.pagination?.pages === "number"
    );
    verif("H4-6 journal peuplé par le seed et les connexions", (journal?.items?.length ?? 0) > 0);

    // Ordre stable : plus récent d'abord
    const dates = (journal?.items ?? []).map((i: any) => new Date(i.creeLe).getTime());
    let decroissant = true;
    for (let i = 1; i < dates.length; i++) if (dates[i]! > dates[i - 1]!) decroissant = false;
    verif("H4-7 ordre décroissant (creeLe)", decroissant);

    // Pagination serveur : page 2 ≠ page 1, bornes respectées
    const p1 = await admin.json("/api/audit?limite=2&page=1");
    const p2 = await admin.json("/api/audit?limite=2&page=2");
    const idP1 = (p1.corps?.data?.items ?? []).map((i: any) => i.id);
    const idP2 = (p2.corps?.data?.items ?? []).map((i: any) => i.id);
    verif(
      "H4-8 pagination distincte page 1 / page 2",
      idP1.length > 0 && idP2.length > 0 && idP1[0] !== idP2[0],
      JSON.stringify({ p1: idP1[0], p2: idP2[0] })
    );
    verif(
      "H4-9 total cohérent avec pagination",
      p1.corps?.data?.pagination?.total >= (p1.corps?.data?.items?.length ?? 0)
    );

    // Filtres
    const fAction = await admin.json("/api/audit?action=LOGIN_SUCCESS&limite=50");
    verif(
      "H4-10 filtre action",
      fAction.status === 200 &&
        (fAction.corps?.data?.items ?? []).every((i: any) => i.action === "LOGIN_SUCCESS") &&
        (fAction.corps?.data?.items?.length ?? 0) > 0
    );
    const fIdent = await admin.json("/api/audit?identifiant=sarah&limite=50");
    verif(
      "H4-11 filtre identifiant (contient, insensible casse)",
      fIdent.status === 200 &&
        (fIdent.corps?.data?.items ?? []).every((i: any) =>
          String(i.identifiantTente ?? "").toLowerCase().includes("sarah")
        ) &&
        (fIdent.corps?.data?.items?.length ?? 0) > 0,
      JSON.stringify(fIdent.corps?.data?.items?.length)
    );
    const fDateFuture = await admin.json("/api/audit?dateDebut=2099-01-01");
    verif(
      "H4-12 filtre date future → aucun résultat",
      fDateFuture.status === 200 && (fDateFuture.corps?.data?.items?.length ?? 0) === 0
    );
    const fDateAujourdhui = await admin.json(
      `/api/audit?dateDebut=${new Date().toISOString().slice(0, 10)}`
    );
    verif(
      "H4-13 filtre date du jour → résultats présents",
      fDateAujourdhui.status === 200 && (fDateAujourdhui.corps?.data?.items?.length ?? 0) > 0
    );

    // Aucun secret dans le payload — y compris après une RÉVÉLATION de PIN :
    // on révèle les codes d'une fiche SIM, puis on vérifie que ni le PIN
    // révélé ni aucune clé sensible ne transite par GET /api/audit.
    const dataParc = await admin.json("/api/data");
    const ficheSim = (dataParc.corps?.data?.affectations ?? []).find((a: any) => a.hasSimCard);
    let pinRevele: string | null = null;
    if (ficheSim) {
      const revel = await admin.json(`/api/assignments/${ficheSim.id}/confidentiels`);
      if (revel.status === 200) pinRevele = revel.corps?.data?.simPin ?? null;
    }
    verif("H4-14 préparation : révélation PIN effectuée (fiche SIM seedée)", pinRevele != null);

    const rApres = await admin.json("/api/audit?limite=200");
    const texteJournal = JSON.stringify(rApres.corps?.data ?? {});
    verif("H4-15 pas de motDePasseHash/tokenHash dans le journal servi", !texteJournal.includes("motDePasseHash") && !texteJournal.includes("tokenHash"));
    verif(
      "H4-16 PIN révélé ABSENT du journal servi (défense en profondeur)",
      !pinRevele || (!texteJournal.includes(`"${pinRevele}"`) && !texteJournal.includes(pinRevele)),
      "le code PIN ne doit jamais apparaître dans une consultation d'audit"
    );

    // Validation des paramètres : limite excessive refusée (422), page nulle aussi
    const rLimite = await admin.json("/api/audit?limite=5000");
    verif("H4-17 limite > 200 → 422", rLimite.status === 422, `status=${rLimite.status}`);
    const rDateBruite = await admin.json("/api/audit?dateDebut=hier");
    verif("H4-18 date mal formée → 422", rDateBruite.status === 422, `status=${rDateBruite.status}`);
  }

  // ══════════ BILAN ══════════
  console.log("");
  if (echecs > 0) {
    console.error(`✗ VÉRIFICATION PHASE 1 : ${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("✓ VÉRIFICATION PHASE 1 : TOUS LES CONTRÔLES PASSENT.");
  process.exit(0);
}

main().catch((erreur) => {
  console.error("Échec inattendu du vérificateur :", erreur);
  process.exit(1);
});
