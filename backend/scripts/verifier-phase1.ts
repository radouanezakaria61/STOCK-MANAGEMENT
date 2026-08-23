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
import { PrismaClient } from "@prisma/client";
import { purgerDonneesTechniques } from "../src/lib/purge-technique.js";

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

  /** Cookies courants, pour construire des requêtes brutes (tests M1). */
  cookiePublique(): string {
    return this.enteteCookie();
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

  // ══════════ M6 — VALIDATION ZOD SYSTÉMATIQUE ══════════
  console.log("\n── M6. Validation Zod des endpoints mutateurs ──");
  {
    // Injection de masse : un champ inconnu sur un payload strict → 422.
    const injectionStock = await admin.json("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Article injection",
        category: "Consommables & Pièces",
        champFantomique: "escalade",
        performedBy: "Vérificateur M6"
      })
    });
    verif(
      "M6-1 champ inconnu POST /stock (strict) → 422",
      injectionStock.status === 422,
      `${injectionStock.status} ${JSON.stringify(injectionStock.corps)}`
    );

    const qteNegative = await admin.json("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Quantité négative",
        category: "Consommables & Pièces",
        quantity: -3,
        performedBy: "Vérificateur M6"
      })
    });
    verif("M6-2 quantité négative → 422", qteNegative.status === 422, `${qteNegative.status}`);

    const categorieInconnue = await admin.json("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Catégorie farfelue", category: "Nourriture", performedBy: "M6" })
    });
    verif(
      "M6-3 catégorie hors référentiel → 422",
      categorieInconnue.status === 422,
      `${categorieInconnue.status}`
    );

    // Création VALIDE toujours acceptée — y compris le prix au format
    // français historique « 1 250,50 MAD » (même grammaire que le service).
    const marque = `m6-${Date.now().toString(36)}`;
    const creationValide = await admin.json("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `${marque} article conforme`,
        category: "Périphériques & Accessoires",
        brand: "Test",
        serialNumber: `${marque}-SN`,
        quantity: 2,
        minThreshold: 1,
        unitPriceMAD: "1 250,50 MAD",
        performedBy: "Vérificateur M6"
      })
    });
    const idValide: string | undefined = creationValide.corps?.data?.id;
    verif(
      "M6-4 création valide → 201, prix format français = 1250.5",
      creationValide.status === 201 &&
        Number(creationValide.corps?.data?.unitPriceMAD) === 1250.5 &&
        !!idValide,
      `${creationValide.status} ${JSON.stringify(creationValide.corps).slice(0, 160)}`
    );
    if (idValide) await admin.json(`/api/stock/${idValide}`, { method: "DELETE" });

    // Mouvements : les types produits par les flux métier restent interdits
    // à la saisie manuelle, et tout type inconnu est refusé.
    if (idValide) {
      const mvInterdit = await admin.json(`/api/stock/${idValide}/movement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "Envoi Maintenance", quantity: 1 })
      });
      verif("M6-5 mouvement « Envoi Maintenance » saisi → 422", mvInterdit.status === 422, `${mvInterdit.status}`);
    }
    const articleNeuf = await admin.json("/api/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `${marque} cible mouvements`,
        category: "Consommables & Pièces",
        quantity: 3,
        performedBy: "Vérificateur M6"
      })
    });
    const idNeuf: string | undefined = articleNeuf.corps?.data?.id;
    if (idNeuf) {
      const mvInconnu = await admin.json(`/api/stock/${idNeuf}/movement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "Téléportation", quantity: 1 })
      });
      verif("M6-6 mouvement type inconnu → 422", mvInconnu.status === 422, `${mvInconnu.status}`);
      await admin.json(`/api/stock/${idNeuf}`, { method: "DELETE" });
    }

    // Utilisateurs : strict sur la forme, le rôle reste résolu en base.
    const userFantome = await admin.json("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "m6.fantome",
        motDePasseTemporaire: "Mot-De-Passe-M6",
        name: "Fantôme",
        email: "fantome@m6.ma",
        department: "DSI",
        role: "EMPLOYEE",
        isAdmin: true
      })
    });
    verif(
      "M6-7 champ inconnu POST /users (strict) → 422",
      userFantome.status === 422,
      `${userFantome.status}`
    );
    const roleInconnu = await admin.json("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "m6.role",
        motDePasseTemporaire: "Mot-De-Passe-M6",
        name: "Rôle Inconnu",
        email: "role@m6.ma",
        department: "DSI",
        role: "Pirate"
      })
    });
    verif(
      "M6-8 rôle inconnu → 400 service listant les rôles",
      roleInconnu.status === 400 && String(roleInconnu.corps.error).includes("EMPLOYEE"),
      `${roleInconnu.status}`
    );

    // Sociétés : strict + booléen réel pour l'activation.
    const societeFantome = await admin.json("/api/societes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nom: "Fantôme SARL", codeCourt: "FTM", actif: true })
    });
    verif(
      "M6-9 champ inconnu POST /societes (strict) → 422",
      societeFantome.status === 422,
      `${societeFantome.status}`
    );
    const dataSoc = await admin.json("/api/societes");
    const idSoc: string | undefined = dataSoc.corps?.data?.[0]?.id;
    const activationBranquee = await admin.json(`/api/societes/${idSoc}/statut`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actif: "oui" })
    });
    verif(
      "M6-10 activation société avec actif non booléen → 422",
      activationBranquee.status === 422,
      `${activationBranquee.status}`
    );

    // Statut utilisateur : liste fermée (« Supprimé » n'est pas un statut).
    const dataUsers = await admin.json("/api/users");
    const idUserCible: string | undefined = dataUsers.corps?.data?.find(
      (u: any) => u.username !== "zakaria.radouane"
    )?.id;
    const statutFarfelu = await admin.json(`/api/users/${idUserCible}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "Supprimé" })
    });
    verif(
      "M6-11 statut utilisateur hors liste → 422",
      statutFarfelu.status === 422,
      `${statutFarfelu.status}`
    );

    // Fiche d'affectation (formulaire hérité, mode strip) : les champs
    // d'affichage historiques sont TOLÉRÉS mais retirés avant le service ;
    // la restitution se déroule normalement.
    const dataParc = await admin.json("/api/data");
    const ficheActive = (dataParc.corps?.data?.affectations ?? []).find(
      (f: any) => f.status === "Active"
    );
    if (ficheActive) {
      const retourStrip = await admin.json(`/api/assignments/${ficheActive.id}/return`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cause: "Autre motif",
          equipmentCondition: "Bon état",
          actionTaken: "Remise en stock disponible",
          inspectedBy: "Vérificateur M6",
          hasKeyboard: true,
          equipmentType: "Champ hérité jamais consommé"
        })
      });
      verif(
        "M6-12 restitution avec champs hérités (strip) → acceptée 200",
        retourStrip.status === 200,
        `${retourStrip.status} ${JSON.stringify(retourStrip.corps).slice(0, 160)}`
      );
    } else {
      verif("M6-12 restitution avec champs hérités (strip)", false, "aucune fiche Active seedée");
    }
  }

  // ══════════ M3 — PURGE DES DONNÉES TECHNIQUES EXPIRÉES ══════════
  console.log("\n── M3. Purge maîtrisée des données techniques ──");
  {
    const db = new PrismaClient();
    const maintenant = Date.now();

    // Jeu de contrôle : à purger vs à conserver, pour chaque table technique.
    const sessionMorte = await db.session.create({
      data: {
        tokenHash: `purge-morte-${maintenant}`,
        utilisateurId: (await db.utilisateur.findFirstOrThrow({ where: { username: "zakaria.radouane" } })).id,
        expireLe: new Date(maintenant - 2 * 3_600_000) // expirée depuis 2 h
      }
    });
    const sessionVivante = await db.session.create({
      data: {
        tokenHash: `purge-vive-${maintenant}`,
        utilisateurId: (await db.utilisateur.findFirstOrThrow({ where: { username: "zakaria.radouane" } })).id,
        expireLe: new Date(maintenant + 3_600_000)
      }
    });
    await db.requeteIdempotente.create({
      data: { cle: `purge-vieille-${maintenant}`, empreinteCorps: "x", creeLe: new Date(maintenant - 25 * 3_600_000) }
    });
    await db.requeteIdempotente.create({
      data: { cle: `purge-recente-${maintenant}`, empreinteCorps: "x", creeLe: new Date(maintenant - 3_600_000) }
    });
    await db.tentativeConnexion.create({
      data: { cle: `purge-test|compteur-mort-${maintenant}`, echecs: 0, fenetreOuverte: new Date(maintenant - 2 * 3_600_000) }
    });
    await db.tentativeConnexion.create({
      data: { cle: `purge-test|compteur-actif-${maintenant}`, echecs: 3, fenetreOuverte: new Date(maintenant - 10 * 60_000) }
    });
    await db.tentativeConnexion.create({
      data: {
        cle: `purge-test|blocage-termine-${maintenant}`,
        echecs: 6,
        fenetreOuverte: new Date(maintenant - 26 * 3_600_000),
        bloqueJusqua: new Date(maintenant - 25 * 3_600_000)
      }
    });

    const bilan = await purgerDonneesTechniques();

    verif(
      "M3-1 session expirée (>1 h de grâce) purgée",
      bilan.sessionsPurgees >= 1 && (await db.session.findUnique({ where: { id: sessionMorte.id } })) === null
    );
    verif(
      "M3-2 session vivante conservée",
      (await db.session.findUnique({ where: { id: sessionVivante.id } })) !== null
    );
    const vieilleCle = (await db.requeteIdempotente.findUnique({ where: { cle: `purge-vieille-${maintenant}` } })) === null;
    const recenteCle = (await db.requeteIdempotente.findUnique({ where: { cle: `purge-recente-${maintenant}` } })) !== null;
    verif("M3-3 clé d'idempotence >24 h purgée, <24 h conservée", vieilleCle && recenteCle);
    const mortCompteur =
      (await db.tentativeConnexion.findUnique({ where: { cle: `purge-test|compteur-mort-${maintenant}` } })) === null;
    const actifCompteur =
      (await db.tentativeConnexion.findUnique({ where: { cle: `purge-test|compteur-actif-${maintenant}` } })) !== null;
    const blocageTermine =
      (await db.tentativeConnexion.findUnique({ where: { cle: `purge-test|blocage-termine-${maintenant}` } })) === null;
    verif(
      "M3-4 limiteur connexion : compteurs morts purgés, compteur actif conservé",
      mortCompteur && actifCompteur && blocageTermine
    );

    // Le journal d'audit et les notifications ne sont JAMAIS touchés.
    const journalAvant = await db.journalAudit.count();
    const notificationsAvant = await db.notification.count();
    await purgerDonneesTechniques();
    verif(
      "M3-5 journal d'audit intouché (immuabilité)",
      (await db.journalAudit.count()) === journalAvant
    );
    verif(
      "M3-6 notifications intouchées (politique produit)",
      (await db.notification.count()) === notificationsAvant
    );

    // Nettoyage du jeu de test (lignes volontairement conservées).
    await db.session.delete({ where: { id: sessionVivante.id } }).catch(() => undefined);
    await db.requeteIdempotente.delete({ where: { cle: `purge-recente-${maintenant}` } }).catch(() => undefined);
    await db.tentativeConnexion
      .delete({ where: { cle: `purge-test|compteur-actif-${maintenant}` } })
      .catch(() => undefined);

    // La session admin utilisée par la suite reste fonctionnelle après purge.
    const auditApresPurge = await admin.json("/api/audit?limite=1");
    verif("M3-7 API toujours opérationnelle après purge", auditApresPurge.status === 200, `${auditApresPurge.status}`);

    await db.$disconnect();
  }

  // ══════════ M1 — ANTI-CSRF (marqueur de mutation obligatoire) ══════════
  console.log("\n── M1. Renforcement CSRF ──");
  {
    // 1. Un POST sans le marqueur (typique d'un formulaire forgé) → 403,
    //    y compris sur le login public.
    const loginSansMarqueur = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifiant: "zakaria.radouane", motDePasse: MDP_DEMO })
    });
    verif(
      "M1-1 login SANS X-Requested-With → 403",
      loginSansMarqueur.status === 403,
      `status=${loginSansMarqueur.status}`
    );
    await loginSansMarqueur.text();

    // 2. Le même POST AVEC le marqueur passe (client non navigateur légitime).
    const loginAvecMarqueur = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
      body: JSON.stringify({ identifiant: "zakaria.radouane", motDePasse: MDP_DEMO })
    });
    verif(
      "M1-2 login AVEC marqueur → 200",
      loginAvecMarqueur.status === 200,
      `status=${loginAvecMarqueur.status}`
    );
    await loginAvecMarqueur.text();

    // 3. Mutation authentifiée sans marqueur → 403 même avec session valide.
    const cookieAdmin = admin.cookiePublique();
    const mutationSansMarqueur = await fetch(`${BASE}/api/stock`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieAdmin
      },
      body: JSON.stringify({ name: "Sans marqueur", category: "Consommables & Pièces" })
    });
    verif(
      "M1-3 mutation authentifiée SANS marqueur → 403",
      mutationSansMarqueur.status === 403,
      `status=${mutationSansMarqueur.status}`
    );
    await mutationSansMarqueur.text();

    // 4. Origin étrangère refusée même avec marqueur (couche Origin intacte).
    const originEtrangere = await fetch(`${BASE}/api/notifications/lue-tout`, {
      method: "POST",
      headers: {
        "x-requested-with": "XMLHttpRequest",
        origin: "https://site-pirate.exemple",
        cookie: cookieAdmin
      }
    });
    verif(
      "M1-4 Origin étrangère + marqueur → 403",
      originEtrangere.status === 403,
      `status=${originEtrangere.status}`
    );
    await originEtrangere.text();

    // 5. Les LECTURES ne sont pas affectées par l'exigence du marqueur.
    const lectureSansMarqueur = await fetch(`${BASE}/api/data`, {
      headers: { cookie: cookieAdmin }
    });
    verif(
      "M1-5 GET sans marqueur → 200 (lectures inchangées)",
      lectureSansMarqueur.status === 200,
      `status=${lectureSansMarqueur.status}`
    );
    await lectureSansMarqueur.text();
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
