/**
 * Vérification de non-régression après les chantiers 2b et 3 :
 *  - 2b : authentification Argon2id, sessions serveur (cookie HttpOnly),
 *    RBAC six rôles, limitation des tentatives de connexion, audit connexions ;
 *  - 3  : journal d'audit en base avec valeurs avant/après, notifications
 *    internes dédupliquées, idempotence des mutations créatrices, machine à
 *    états du matériel, invariants de quantités (3 compartiments) vérifiés
 *    PAR LA BASE, restitution endommagée forcée en maintenance, annulation
 *    vs historique immuable.
 *
 * Prérequis : serveur démarré (npm run dev ou build+start). La suite se
 * réinitialise elle-même : le seed démonstration est rejoué en tête de
 * course pour garantir des compteurs et un ordre de références connus,
 * quel que soit l'état laissé par les exécutions précédentes.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.API_BASE || "http://localhost:3001";

// Chantier 3.5 : plus aucun secret committé — le mot de passe des comptes de
// démonstration vient exclusivement de l'environnement (.env en dev) et doit
// refléter MOT_DE_PASSE_DEMO utilisé par le seed.
const MDP_DEMO = process.env.MOT_DE_PASSE_DEMO;
if (!MDP_DEMO) {
  console.error("MOT_DE_PASSE_DEMO manquant : renseignez-le dans backend/.env.");
  process.exit(1);
}
const MESSAGE_ECHEC_ATTENDU = "Identifiant ou mot de passe incorrect.";

let echecs = 0;
function verif(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  OK   ${nom}`);
  } else {
    echecs++;
    console.error(`  FAIL ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

const estUuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const estDateSeule = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

interface ReponseJson<T = any> {
  status: number;
  corps: T;
  enteteRetry?: string;
}

/** Session HTTP : jar de cookies minimal (le jeton de session vit ici). */
class SessionHttp {
  private jetons = new Map<string, string>();

  private enteteCookie(): string {
    return [...this.jetons.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  requete(chemin: string, init: RequestInit = {}, origine?: string): Promise<Response> {
    const entetes = new Headers(init.headers);
    const cookie = this.enteteCookie();
    if (cookie) entetes.set("cookie", cookie);
    if (origine) entetes.set("origin", origine);
    return fetch(`${BASE}${chemin}`, { ...init, headers: entetes });
  }

  async json(chemin: string, init: RequestInit = {}, origine?: string): Promise<ReponseJson> {
    const res = await this.requete(chemin, init, origine);
    return { status: res.status, corps: await res.json(), enteteRetry: res.headers.get("retry-after") ?? undefined };
  }

  /** Connexion : capture le cookie de session posé par le serveur. */
  async connexion(identifiant: string, motDePasse: string, origine?: string): Promise<ReponseJson> {
    const res = await this.requete(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifiant, motDePasse })
      },
      origine
    );
    for (const brut of cookiesDe(res)) {
      const paire = brut.split(";")[0]!;
      const idx = paire.indexOf("=");
      if (idx > 0) this.jetons.set(paire.slice(0, idx).trim(), paire.slice(idx + 1).trim());
    }
    return { status: res.status, corps: await res.json(), enteteRetry: res.headers.get("retry-after") ?? undefined };
  }

  oublier(): void {
    this.jetons.clear();
  }
}

function cookiesDe(res: Response): string[] {
  const entetes = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof entetes.getSetCookie === "function") return entetes.getSetCookie();
  const brut = res.headers.get("set-cookie");
  return brut ? [brut] : [];
}

async function main() {
  // ══════════ 0. ÉTAT CONNU : rejeu du seed démonstration ══════════
  // Les sections C et E comparent les compteurs de /api/data à l'état
  // seedé (2,5,7,4,3) : on repart donc d'une base réinitialisée pour que
  // la suite soit rejouable, même après une exécution avortée.
  console.log("── 0. Réinitialisation (seed démonstration) ──");
  execSync("npx prisma db seed", { stdio: "inherit" });

  // ══════════ A. SANS SESSION : TOUT EST FERMÉ (critère « Fini quand ») ══════════
  console.log("\n── A. Accès anonymes refusés ──");
  const anon = new SessionHttp();

  for (const [methode, chemin] of [
    ["GET", "/api/data"],
    ["GET", "/api/users"],
    ["POST", "/api/societes"],
    ["DELETE", "/api/users/usr-1"],
    ["POST", "/api/stock"],
    ["GET", "/api/auth/me"]
  ] as const) {
    const res = await anon.requete(chemin, {
      method: methode,
      headers: { "content-type": "application/json" },
      body: methode === "GET" ? undefined : "{}"
    });
    verif(`${methode} ${chemin} sans session → 401`, res.status === 401, `status=${res.status}`);
  }

  // ══════════ B. CONNEXION : messages génériques, cas d'usage réels ══════════
  console.log("\n── B. Connexion ──");
  const echecInconnu = await anon.connexion("inconnu.nobody", "Peu importe-123");
  verif(
    "compte inexistant → 401 message générique",
    echecInconnu.status === 401 && echecInconnu.corps.error === MESSAGE_ECHEC_ATTENDU,
    `${echecInconnu.status} ${JSON.stringify(echecInconnu.corps)}`
  );

  const echecMauvaisMdp = await anon.connexion("zakaria.radouane", "Faux-Mot-De-Passe-999");
  verif(
    "mauvais mot de passe → 401 message IDENTIQUE (pas d'énumération)",
    echecMauvaisMdp.status === 401 && echecMauvaisMdp.corps.error === MESSAGE_ECHEC_ATTENDU
  );

  const echecInactif = await anon.connexion("mehdi.alami", MDP_DEMO);
  verif(
    "compte Inactif → 401 message identique",
    echecInactif.status === 401 && echecInactif.corps.error === MESSAGE_ECHEC_ATTENDU,
    `${echecInactif.status}`
  );

  const origineHostile = await anon.connexion("zakaria.radouane", MDP_DEMO, "https://site-pirate.example");
  verif("Origin hostile sur mutation → 403", origineHostile.status === 403, `${origineHostile.status}`);

  const connexionEmail = await anon.connexion("ZAKARIARADOUANE61@GMAIL.COM", MDP_DEMO);
  verif(
    "connexion par email (casse libre) → 200",
    connexionEmail.status === 200 && connexionEmail.corps.status === "ok",
    `${connexionEmail.status}`
  );

  const admin = new SessionHttp();
  const connexionAdmin = await admin.connexion("zakaria.radouane", MDP_DEMO);
  const profilAdmin = connexionAdmin.corps?.data;
  verif(
    "connexion par username → 200 + profil SUPER_ADMIN",
    connexionAdmin.status === 200 && profilAdmin?.role?.code === "SUPER_ADMIN",
    JSON.stringify(connexionAdmin.corps).slice(0, 120)
  );
  verif(
    "profil : permissions effectives présentes, hash absent, doitChangerMdp=false",
    Array.isArray(profilAdmin?.permissions) &&
      profilAdmin.permissions.includes("utilisateurs.gerer") &&
      profilAdmin.permissions.includes("parametres.gerer") &&
      !("motDePasseHash" in (profilAdmin ?? {})) &&
      profilAdmin?.doitChangerMdp === false
  );

  const moi = await admin.json("/api/auth/me");
  verif(
    "GET /api/auth/me avec cookie → profil cohérent",
    moi.status === 200 && moi.corps.data?.username === "zakaria.radouane" && moi.corps.data?.role?.nom === "Super administrateur"
  );
  const moiAnonyme = await new SessionHttp().json("/api/auth/me");
  verif("GET /api/auth/me sans cookie → 401", moiAnonyme.status === 401);

  // ══════════ C. CONTRAT DES DONNÉES (session admin) ══════════
  console.log("\n── C. Contrat /api/data ──");
  const resData = await admin.json("/api/data");
  verif("GET /api/data → 200 enveloppe ok", resData.status === 200 && resData.corps.status === "ok");
  const data = resData.corps.data;
  const {
    societes,
    utilisateurs: users,
    articles: stockItems,
    mouvements: movements,
    affectations: assignments
  } = data as Record<string, any[]>;

  const compteurs = [societes?.length, users?.length, stockItems?.length, movements?.length, assignments?.length].join(",");
  verif("compteurs 2,5,7,4,3", compteurs === "2,5,7,4,3", compteurs);
  verif("aucune clé anglaise résiduelle", ["vendors", "users", "stockItems"].every((k) => !(k in data)));

  verif(
    "ordre références intact",
    users.map((u: any) => u.reference).join() === ["usr-1","usr-2","usr-3","usr-4","usr-5"].join() &&
      stockItems.map((s: any) => s.reference).join() === ["STK-001","STK-002","STK-003","STK-004","STK-005","STK-006","STK-007"].join()
  );

  const toutesEntites = [...societes, ...users, ...stockItems, ...movements, ...assignments];
  verif("ids = uuid partout", toutesEntites.every((e) => estUuid(e.id)));
  verif("creeLe ISO présent, createdAt/modifieLe/motDePasseHash absents",
    toutesEntites.every((e) => typeof e.creeLe === "string" && !("createdAt" in e) && !("modifieLe" in e)) &&
      users.every((u: any) => !("motDePasseHash" in u))
  );
  verif("derniereConnexion 'YYYY-MM-DD HH:mm'", users.every((u: any) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(u.derniereConnexion)));

  const ROLES_VALIDES = ["SUPER_ADMIN", "IT_MANAGER", "IT_TECHNICIAN", "STOCK_MANAGER", "AUDITOR", "EMPLOYEE"];
  verif(
    "rôles = objets {code,nom} dans la matrice §5.2",
    users.every((u: any) => ROLES_VALIDES.includes(u.role?.code) && typeof u.role?.nom === "string"),
    users.map((u: any) => `${u.reference}:${JSON.stringify(u.role)}`).join()
  );
  const usr1 = users.find((u: any) => u.reference === "usr-1")!;
  verif(
    "usr-1 SUPER_ADMIN + username, usr-4 AUDITOR, autres EMPLOYEE",
    usr1.role.code === "SUPER_ADMIN" && typeof usr1.username === "string" &&
      users.find((u: any) => u.reference === "usr-4")!.role.code === "AUDITOR" &&
      ["usr-2","usr-3","usr-5"].every((r) => users.find((u: any) => u.reference === r)!.role.code === "EMPLOYEE")
  );

  const stk1 = stockItems.find((s: any) => s.reference === "STK-001")!;
  verif("STK-001 quantités/prix intacts", stk1.quantity === 15 && stk1.availableQty === 9 && stk1.unitPriceMAD === 14500);
  const mvt1 = movements.find((m: any) => m.reference === "MVT-001")!;
  verif("FK MVT-001 → STK-001", mvt1.stockItemId === stk1.id);

  // ══════════ D. RBAC SERVEUR ══════════
  console.log("\n── D. Refus et permissions ──");
  const auditor = new SessionHttp();
  const coAuditor = await auditor.connexion("sarah.benali", MDP_DEMO);
  verif(
    "auditor connecté, permissions de consultation + audit",
    coAuditor.status === 200 &&
      JSON.stringify([...(coAuditor.corps?.data?.permissions ?? [])].sort()) ===
        JSON.stringify(["audit.consulter", "parc.consulter", "utilisateurs.consulter"]),
    JSON.stringify(coAuditor.corps?.data?.permissions)
  );

  const lectureAuditor = await auditor.json("/api/data");
  verif("auditor : lecture /api/data autorisée", lectureAuditor.status === 200);

  const refusSociete = await auditor.json("/api/societes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nom: "Pirate", codeCourt: "PIR" })
  });
  verif(
    "auditor POST /api/societes → 403 message permission",
    refusSociete.status === 403 && String(refusSociete.corps.error).includes("societes.gerer"),
    `${refusSociete.status} ${JSON.stringify(refusSociete.corps)}`
  );
  const refusUsers = await auditor.json("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  verif("auditor POST /api/users → 403", refusUsers.status === 403 && String(refusUsers.corps.error).includes("utilisateurs.gerer"));

  const employe = new SessionHttp();
  await employe.connexion("karim.berrada", MDP_DEMO);
  const refusStock = await employe.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  verif("employé POST /api/stock → 403", refusStock.status === 403 && String(refusStock.corps.error).includes("stock.ecrire"));

  const roleInvalide = await admin.json("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "X", email: "x@x.ma", department: "D", role: "SUPERMAN", username: "x.y", motDePasseTemporaire: "Abcdef123456" })
  });
  verif(
    "rôle inconnu → 400 listant les rôles acceptés",
    roleInvalide.status === 400 && String(roleInvalide.corps.error).includes("IT_MANAGER"),
    `${roleInvalide.status} ${JSON.stringify(roleInvalide.corps)}`
  );

  const societeVide = await admin.json("/api/societes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nom: "", codeCourt: "" })
  });
  verif("admin POST société vide → 400 français", societeVide.status === 400 && typeof societeVide.corps.error === "string");

  // ══════════ E. CYCLE DE VIE COMPLET D'UN COMPTE ══════════
  console.log("\n── E. Création → changement mdp → suppression ──");
  // Suffixe unique : un compte précédemment supprimé (soft delete) conserve
  // son username/email en base ; la recréation à l'identique violerait
  // l'unicité. Chaque exécution utilise donc sa propre marque.
  const marque = `test.cycle.${Date.now().toString(36)}`;
  const creation = await admin.json("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: marque,
      motDePasseTemporaire: "Test-Cycle-2026",
      name: "Compte Test Cycle",
      email: `${marque}@entreprise.ma`,
      department: "Technologies de l'Information",
      jobTitle: "Technicien",
      role: "IT_TECHNICIAN",
      status: "Actif"
    })
  });
  const idTest = creation.corps?.data?.id;
  verif(
    "création technicien → 201, doitChangerMdp=true, hash jamais exposé",
    creation.status === 201 && creation.corps.data?.doitChangerMdp === true &&
      creation.corps.data?.role?.code === "IT_TECHNICIAN" && !("motDePasseHash" in (creation.corps.data ?? {})),
    `${creation.status} ${JSON.stringify(creation.corps).slice(0, 150)}`
  );

  const testeur = new SessionHttp();
  const coTemp = await testeur.connexion(marque, "Test-Cycle-2026");
  verif("login avec mot de passe temporaire → 200 + flag changement", coTemp.status === 200 && coTemp.corps.data?.doitChangerMdp === true);

  const changement = await testeur.json("/api/auth/changer-mot-de-passe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ motDePasseActuel: "Test-Cycle-2026", nouveauMotDePasse: "Nouveau-Cycle-2026" })
  });
  verif("changement de mot de passe → 200", changement.status === 200, `${changement.status} ${JSON.stringify(changement.corps)}`);

  const mauvaisActuel = await testeur.json("/api/auth/changer-mot-de-passe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ motDePasseActuel: "Totalement-Faux-1", nouveauMotDePasse: "Encore-Un-2026x" })
  });
  verif("mot de passe actuel erroné → 400", mauvaisActuel.status === 400);

  const faibleNouveau = await testeur.json("/api/auth/changer-mot-de-passe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ motDePasseActuel: "Nouveau-Cycle-2026", nouveauMotDePasse: "faible" })
  });
  verif("nouveau mot de passe trop faible → 422", faibleNouveau.status === 422, `${faibleNouveau.status}`);

  const reLoginTemp = await new SessionHttp().connexion(marque, "Test-Cycle-2026");
  verif("l'ancien mot de passe est mort → 401", reLoginTemp.status === 401);

  const reLoginNeuf = await new SessionHttp().connexion(marque, "Nouveau-Cycle-2026");
  verif("connexion au nouveau mot de passe → 200", reLoginNeuf.status === 200);

  const suppression = await admin.json(`/api/users/${idTest}`, { method: "DELETE" });
  verif("suppression (soft delete) → 200", suppression.status === 200, `${suppression.status}`);

  const coSupprime = await new SessionHttp().connexion(marque, "Nouveau-Cycle-2026");
  verif("compte supprimé : connexion refusée → 401", coSupprime.status === 401);

  const apresSuppression = await admin.json("/api/data");
  const usersApres = apresSuppression.corps?.data?.utilisateurs ?? [];
  verif(
    "utilisateur supprimé absent des listes + compteurs restaurés",
    !usersApres.some((u: any) => u.username?.startsWith("test.cycle.")) &&
      [apresSuppression.corps.data.societes.length, usersApres.length, apresSuppression.corps.data.articles.length, apresSuppression.corps.data.mouvements.length, apresSuppression.corps.data.affectations.length].join() === "2,5,7,4,3"
  );

  // ══════════ F. LIMITATION DES TENTATIVES (clé dédiée, en dernier) ══════════
  console.log("\n── F. Anti-bruteforce ──");
  const bruteForce = new SessionHttp();
  let dernierStatus = 0;
  let dernierRetry: string | undefined;
  for (let i = 0; i < 6; i++) {
    const tentative = await bruteForce.connexion("zz.ratelimit.probe", "Peu-Importe-000");
    dernierStatus = tentative.status;
    dernierRetry = tentative.enteteRetry;
  }
  verif("6ᵉ tentative consécutive échouée → 429 + Retry-After", dernierStatus === 429 && Number(dernierRetry) > 0, `status=${dernierStatus} retry=${dernierRetry}`);

  // ══════════ G. ROUTES RETIRÉES : toujours 404 (avec session valide) ══════════
  console.log("\n── G. Routes retirées ──");
  for (const chemin of ["/api/pos", "/api/vendors", "/api/ai/analyze-bids"]) {
    const res = await admin.requete(chemin, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    verif(`POST ${chemin} → 404`, res.status === 404, `status=${res.status}`);
  }

  // ══════════ H. NOTIFICATIONS INTERNES (chantier 3) ══════════
  console.log("\n── H. Notifications internes ──");
  // Session VIERGE : `anon` a obtenu des cookies lors des tests de connexion
  // en section B, il ne représente plus un accès sans session.
  const notifsAnon = await new SessionHttp().json("/api/notifications");
  verif("GET /api/notifications sans session → 401", notifsAnon.status === 401, `${notifsAnon.status}`);

  const marqueCh3 = `CH3-${Date.now().toString(36)}`;
  const lireData = async () => (await admin.json("/api/data")).corps.data;

  const articleSousSeuil = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} consommable sous seuil`,
      category: "Consommables & Pièces",
      brand: "Test",
      model: "CH3",
      serialNumber: `${marqueCh3}-SN1`,
      quantity: 1,
      minThreshold: 3,
      unitPriceMAD: 120,
      performedBy: "Vérificateur Chantier 3"
    })
  });
  const idSousSeuil: string | undefined = articleSousSeuil.corps?.data?.id;
  verif(
    "création article (dispo 1 < seuil 3) → 201",
    articleSousSeuil.status === 201 && estUuid(idSousSeuil),
    `${articleSousSeuil.status} ${JSON.stringify(articleSousSeuil.corps).slice(0, 150)}`
  );

  const notifsApresCreation = await admin.json("/api/notifications");
  const alerteStock = (notifsApresCreation.corps?.data?.items ?? []).find(
    (n: any) => n.type === "STOCK_FAIBLE" && n.entiteId === idSousSeuil && n.statut === "OUVERTE"
  );
  const nonLuesAvant: number = notifsApresCreation.corps?.data?.nonLues ?? -1;
  verif(
    "alerte STOCK_FAIBLE ouverte générée automatiquement",
    !!alerteStock && typeof nonLuesAvant === "number" && nonLuesAvant >= 1,
    JSON.stringify(notifsApresCreation.corps?.data?.nonLues)
  );

  const marquageLu = await admin.json(`/api/notifications/${alerteStock?.id}/lue`, { method: "POST" });
  const notifsApresLu = await admin.json("/api/notifications");
  const alerteApresLu = (notifsApresLu.corps?.data?.items ?? []).find((n: any) => n.id === alerteStock?.id);
  verif(
    "marquage LUE : statut basculé + compteur décrémenté",
    marquageLu.status === 200 &&
      alerteApresLu?.statut === "LUE" &&
      notifsApresLu.corps.data.nonLues === nonLuesAvant - 1,
    `marquage=${marquageLu.status} statut=${alerteApresLu?.statut}`
  );

  // ══════════ I. IDEMPOTENCE DES CRÉATIONS (chantier 3) ══════════
  console.log("\n── I. Idempotence (X-Cle-Idempotence) ──");
  const donneesAvantIdem = await lireData();
  const nbArticlesAvantIdem = donneesAvantIdem.articles.length;
  const cleIdem = `${marqueCh3}-IDEM`;
  const corpsIdem = {
    name: `${marqueCh3} article idempotent`,
    category: "Consommables & Pièces",
    brand: "Test",
    model: "CH3",
    serialNumber: `${marqueCh3}-SN2`,
    quantity: 2,
    minThreshold: 0,
    unitPriceMAD: 50,
    performedBy: "Vérificateur Chantier 3"
  };
  const entetesIdem = { "content-type": "application/json", "x-cle-idempotence": cleIdem };

  const premiereFois = await admin.json("/api/stock", { method: "POST", headers: entetesIdem, body: JSON.stringify(corpsIdem) });
  const idArticleIdem: string | undefined = premiereFois.corps?.data?.id;
  verif("première création avec clé → 201", premiereFois.status === 201 && estUuid(idArticleIdem), `${premiereFois.status}`);

  const rejeu = await admin.json("/api/stock", { method: "POST", headers: entetesIdem, body: JSON.stringify(corpsIdem) });
  verif(
    "retransmission identique → réponse REJOUÉE (même article)",
    rejeu.status === 201 && rejeu.corps?.data?.id === idArticleIdem,
    `${rejeu.status} ${JSON.stringify(rejeu.corps).slice(0, 100)}`
  );

  const conflitCle = await admin.json("/api/stock", {
    method: "POST",
    headers: entetesIdem,
    body: JSON.stringify({ ...corpsIdem, quantity: 999 })
  });
  verif(
    "même clé + corps différent → 409",
    conflitCle.status === 409,
    `${conflitCle.status} ${JSON.stringify(conflitCle.corps)}`
  );

  const donneesApresIdem = await lireData();
  verif(
    "UN SEUL article créé malgré deux requêtes",
    donneesApresIdem.articles.length === nbArticlesAvantIdem + 1 &&
      !donneesApresIdem.articles.some((a: any) => a.serialNumber === `${marqueCh3}-SN2-DUP`),
    `${nbArticlesAvantIdem} → ${donneesApresIdem.articles.length}`
  );

  // ══════════ J. MACHINE À ÉTATS & INVARIANTS QUANTITÉS ══════════
  console.log("\n── J. Machine à états et invariants ──");
  const transitionInterdite = await admin.json(`/api/stock/${idSousSeuil}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "Supprimé" })
  });
  verif(
    "« En Stock » → « Supprimé » hors machine à états → 409 INVALID_STATUS_TRANSITION",
    transitionInterdite.status === 409 && transitionInterdite.corps.code === "INVALID_STATUS_TRANSITION",
    `${transitionInterdite.status} ${JSON.stringify(transitionInterdite.corps)}`
  );

  const articlePlancher = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} article plancher`,
      category: "Consommables & Pièces",
      brand: "Test",
      model: "CH3",
      serialNumber: `${marqueCh3}-SN3`,
      quantity: 1,
      minThreshold: 0,
      unitPriceMAD: 10,
      performedBy: "Vérificateur Chantier 3"
    })
  });
  const idPlancher: string | undefined = articlePlancher.corps?.data?.id;

  const fichePlancher = await admin.json("/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      templateType: "DSI-IT-01",
      formCode: "FRM-TEST",
      beneficiaryName: "Test Plancher",
      beneficiaryDepartment: "Technologies de l'Information",
      beneficiarySite: "Siège",
      authorizedBy: "Vérificateur",
      dsiTitle: "Chef de Service DSI",
      resourceType: "Équipement Informatique",
      items: [{ stockItemId: idPlancher }]
    })
  });
  const idFichePlancher: string | undefined = fichePlancher.corps?.data?.id;
  verif("affectation consommant l'article → 201", fichePlancher.status === 201 && !!idFichePlancher, `${fichePlancher.status}`);

  const quantiteTropBasse = await admin.json(`/api/stock/${idPlancher}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quantity: 0 })
  });
  verif(
    "quantité sous le plancher engagé → 400 message explicite",
    quantiteTropBasse.status === 400 && String(quantiteTropBasse.corps.error).includes("plancher"),
    `${quantiteTropBasse.status} ${JSON.stringify(quantiteTropBasse.corps)}`
  );

  const sortieImpossible = await admin.json(`/api/stock/${idPlancher}/movement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "Sortie Affectation", quantity: 5, performedBy: "Vérificateur" })
  });
  verif(
    "sortie supérieure au disponible → 409 STOCK_NOT_AVAILABLE",
    sortieImpossible.status === 409 && sortieImpossible.corps.code === "STOCK_NOT_AVAILABLE",
    `${sortieImpossible.status} ${JSON.stringify(sortieImpossible.corps)}`
  );

  const serieDupliquee = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} série dupliquée`,
      category: "Consommables & Pièces",
      serialNumber: stk1.serialNumber,
      quantity: 1,
      minThreshold: 0,
      performedBy: "Vérificateur Chantier 3"
    })
  });
  verif(
    "numéro de série déjà utilisé → 409",
    serieDupliquee.status === 409 && String(serieDupliquee.corps.error).includes("numéro de série"),
    `${serieDupliquee.status} ${JSON.stringify(serieDupliquee.corps)}`
  );

  // ══════════ K. RESTITUTION ENDOMMAGÉE & ANNULATION VS HISTORIQUE ══════════
  console.log("\n── K. Restitution endommagée, annulation ──");
  const articleFragile = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} portable fragile`,
      category: "Laptops & Portables",
      brand: "Test",
      model: "CH3-FRAGILE",
      serialNumber: `${marqueCh3}-SN4`,
      quantity: 1,
      minThreshold: 0,
      unitPriceMAD: 8000,
      performedBy: "Vérificateur Chantier 3"
    })
  });
  const idFragile: string | undefined = articleFragile.corps?.data?.id;
  const nomFragile: string = articleFragile.corps?.data?.name;

  const ficheFragile = await admin.json("/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      templateType: "DSI-IT-01",
      formCode: "FRM-TEST",
      beneficiaryName: "Test Fragile",
      beneficiaryDepartment: "Technologies de l'Information",
      beneficiarySite: "Siège",
      authorizedBy: "Vérificateur",
      dsiTitle: "Chef de Service DSI",
      resourceType: "Équipement Informatique",
      items: [{ stockItemId: idFragile }]
    })
  });
  const ficheFragileData = ficheFragile.corps?.data;
  const idFicheFragile = ficheFragileData?.id;
  verif("affectation du portable → 201 fiche Active", ficheFragile.status === 201 && ficheFragileData?.status === "Active");

  let etat = await lireData();
  let articleLu = etat.articles.find((a: any) => a.id === idFragile);
  verif(
    "après affectation : Affecté, dispo 0, alloué 1",
    articleLu?.status === "Affecté" && articleLu?.availableQty === 0 && articleLu?.allocatedQty === 1,
    JSON.stringify(articleLu && { s: articleLu.status, d: articleLu.availableQty, a: articleLu.allocatedQty })
  );

  const retourCassee = await admin.json(`/api/assignments/${idFicheFragile}/return`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cause: "Fin de mission",
      // Chantier 3.5 : état constaté STRUCTURÉ (liste fermée côté serveur).
      equipmentCondition: "Endommagé",
      actionTaken: "Remise en stock disponible",
      inspectedBy: "Vérificateur Chantier 3",
      notes: "Test restitution dégradée"
    })
  });
  verif(
    "restitution d'un matériel CASSÉ → 200 (acceptée)",
    retourCassee.status === 200,
    `${retourCassee.status} ${JSON.stringify(retourCassee.corps).slice(0, 200)}`
  );

  etat = await lireData();
  articleLu = etat.articles.find((a: any) => a.id === idFragile);
  const ficheLue = etat.affectations.find((f: any) => f.id === idFicheFragile);
  verif(
    "matériel cassé FORCÉ en maintenance (jamais redevient disponible automatiquement) — statut, quantités",
    ficheLue?.status === "Restitué" &&
      articleLu?.status === "En Maintenance" &&
      articleLu?.maintenanceQty === 1 &&
      articleLu?.availableQty === 0 &&
      articleLu?.allocatedQty === 0,
    JSON.stringify(articleLu && { s: articleLu.status, m: articleLu.maintenanceQty, d: articleLu.availableQty })
  );
  verif(
    "mouvement « Envoi Maintenance » tracé",
    etat.mouvements.some((m: any) => m.itemName === nomFragile && m.type === "Envoi Maintenance")
  );

  const notifsEndommage = await admin.json("/api/notifications");
  verif(
    "notification MATERIEL_ENDOMMAGE ouverte",
    (notifsEndommage.corps?.data?.items ?? []).some(
      (n: any) => n.type === "MATERIEL_ENDOMMAGE" && n.entiteId === idFragile && n.statut === "OUVERTE"
    )
  );

  const secondeRestitution = await admin.json(`/api/assignments/${idFicheFragile}/return`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cause: "Doublon", equipmentCondition: "Bon état" })
  });
  verif(
    "seconde restitution de la même fiche → 409 ASSIGNMENT_ALREADY_RETURNED",
    secondeRestitution.status === 409 && secondeRestitution.corps.code === "ASSIGNMENT_ALREADY_RETURNED",
    `${secondeRestitution.status} ${JSON.stringify(secondeRestitution.corps)}`
  );

  const suppressionHistorique = await admin.json(`/api/assignments/${idFicheFragile}`, { method: "DELETE" });
  verif(
    "suppression d'une fiche RESTITUÉE → 400 (historique immuable)",
    suppressionHistorique.status === 400 && String(suppressionHistorique.corps.error).toLowerCase().includes("active"),
    `${suppressionHistorique.status} ${JSON.stringify(suppressionHistorique.corps)}`
  );

  // ══════════ K2. SUR-RESTITUTION REFUSÉE (chantier 3.5) ══════════
  // L'écrêtage silencieux disparaît : réintégrer plus d'unités qu'il n'y en
  // a d'affectées est refusé (409 RETURN_QTY_EXCEEDS_ALLOCATED), quantités
  // inchangées.
  console.log("\n── K2. Sur-restitution refusée ──");
  const articleRetour = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} lot retour`,
      category: "Laptops & Portables",
      brand: "Test",
      model: "CH35-RETOUR",
      serialNumber: `${marqueCh3}-SN35`,
      quantity: 5,
      minThreshold: 0,
      unitPriceMAD: "1 250,50 MAD",
      performedBy: "Vérificateur Chantier 3.5"
    })
  });
  const idRetour: string | undefined = articleRetour.corps?.data?.id;
  // Prix saisi avec espaces/virgule : doit être interprété en Decimal(12,2).
  verif(
    "création article, prix « 1 250,50 MAD » → Decimal 1250.5",
    articleRetour.status === 201 && Number(articleRetour.corps?.data?.unitPriceMAD) === 1250.5 &&
      Number(articleRetour.corps?.data?.totalValueMAD) === 6252.5,
    `${articleRetour.status} ${JSON.stringify(articleRetour.corps?.data && { p: articleRetour.corps.data.unitPriceMAD, t: articleRetour.corps.data.totalValueMAD })}`
  );

  const ficheRetour = await admin.json("/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      beneficiaryName: "Test Retour",
      beneficiaryDepartment: "Technologies de l'Information",
      items: [{ stockItemId: idRetour }]
    })
  });
  verif("affectation de 1 unité → 201", ficheRetour.status === 201);

  const surRestitution = await admin.json(`/api/stock/${idRetour}/movement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "Retour Stock", quantity: 2, performedBy: "Vérificateur Chantier 3.5" })
  });
  verif(
    "retour de 2 unités alors qu'1 seule affectée → 409 RETURN_QTY_EXCEEDS_ALLOCATED",
    surRestitution.status === 409 && surRestitution.corps.code === "RETURN_QTY_EXCEEDS_ALLOCATED",
    `${surRestitution.status} ${JSON.stringify(surRestitution.corps).slice(0, 200)}`
  );
  etat = await lireData();
  articleLu = etat.articles.find((a: any) => a.id === idRetour);
  verif(
    "quantités intactes après le refus (dispo 4, alloué 1)",
    articleLu?.availableQty === 4 && articleLu?.allocatedQty === 1,
    JSON.stringify(articleLu && { d: articleLu.availableQty, a: articleLu.allocatedQty })
  );

  // La fiche est annulée AVANT tout autre mouvement : aucun état intermédiaire
  // incohérent (fiche Active vs quantités) ne doit subsister après le test.
  const annulationRetour = await admin.json(`/api/assignments/${ficheRetour.corps?.data?.id}`, { method: "DELETE" });
  etat = await lireData();
  articleLu = etat.articles.find((a: any) => a.id === idRetour);
  verif(
    "annulation de la fiche → stock restauré (dispo 5, alloué 0)",
    annulationRetour.status === 200 && articleLu?.availableQty === 5 && articleLu?.allocatedQty === 0,
    JSON.stringify(articleLu && { d: articleLu.availableQty, a: articleLu.allocatedQty })
  );

  // Chemin accepté du retour : sortie manuelle puis retour EXACT — hors fiche,
  // donc aucune interaction avec les affectations.
  await admin.json(`/api/stock/${idRetour}/movement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "Sortie Affectation", quantity: 2, performedBy: "Vérificateur Chantier 3.5" })
  });
  const retourNormal = await admin.json(`/api/stock/${idRetour}/movement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "Retour Stock", quantity: 2, performedBy: "Vérificateur Chantier 3.5" })
  });
  etat = await lireData();
  articleLu = etat.articles.find((a: any) => a.id === idRetour);
  verif(
    "sortie 2 puis retour exact 2 → accepté, dispo restauré à 5",
    retourNormal.status === 200 && articleLu?.availableQty === 5 && articleLu?.allocatedQty === 0,
    JSON.stringify(articleLu && { d: articleLu.availableQty, a: articleLu.allocatedQty })
  );

  // Nettoyage : l'unité est déjà réintégrée par le mouvement ; la fiche de
  // test reste dans l'historique, l'article est archivé (soft delete).
  await admin.json(`/api/stock/${idRetour}`, { method: "DELETE" });

  // Une fiche ACTIVE, elle, peut être annulée : le matériel réintègre le stock.
  const articleAnnulable = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marqueCh3} écran annulable`,
      category: "Postes Fixes & Écrans",
      brand: "Test",
      model: "CH3-ANN",
      serialNumber: `${marqueCh3}-SN5`,
      quantity: 1,
      minThreshold: 0,
      unitPriceMAD: 900,
      performedBy: "Vérificateur Chantier 3"
    })
  });
  const idAnnulable: string | undefined = articleAnnulable.corps?.data?.id;
  const nomAnnulable: string = articleAnnulable.corps?.data?.name;
  const ficheAnnulable = await admin.json("/api/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      templateType: "DSI-IT-01",
      formCode: "FRM-TEST",
      beneficiaryName: "Test Annulation",
      beneficiaryDepartment: "Technologies de l'Information",
      beneficiarySite: "Siège",
      authorizedBy: "Vérificateur",
      dsiTitle: "Chef de Service DSI",
      resourceType: "Équipement Informatique",
      items: [{ stockItemId: idAnnulable }]
    })
  });
  const ficheAnnulableData = ficheAnnulable.corps?.data;
  const annulation = await admin.json(`/api/assignments/${ficheAnnulableData?.id}`, { method: "DELETE" });
  etat = await lireData();
  const ficheAnnulee = etat.affectations.find((f: any) => f.id === ficheAnnulableData?.id);
  const articleAnnule = etat.articles.find((a: any) => a.id === idAnnulable);
  verif(
    "annulation fiche active → fiche « Annulée », matériel restauré",
    annulation.status === 200 &&
      ficheAnnulee?.status === "Annulée" &&
      articleAnnule?.status === "En Stock" &&
      articleAnnule?.availableQty === 1 &&
      articleAnnule?.allocatedQty === 0,
    `annulation=${annulation.status} fiche=${ficheAnnulee?.status} article=${articleAnnule?.status}/${articleAnnule?.availableQty}`
  );
  verif(
    "mouvement « Annulation Affectation » tracé",
    etat.mouvements.some((m: any) => m.itemName === nomAnnulable && m.type === "Annulation Affectation")
  );

  // ══════════ L. GARANTIES EN BASE : AUDIT, IMMUTABILITÉ, CONTRAINTES ══════════
  console.log("\n── L. Base de données (journal, triggers, contraintes) ──");
  const db = new PrismaClient();

  const jaCreation = await db.journalAudit.findFirst({
    where: { action: "STOCK_ITEM_CREATED", entiteId: idSousSeuil }
  });
  verif(
    "audit : STOCK_ITEM_CREATED avec valeursApres + utilisateur",
    !!jaCreation && jaCreation.valeursApres != null && jaCreation.utilisateurId != null
  );

  const jaRetour = await db.journalAudit.findFirst({
    where: { action: "RETURN_CREATED", entiteId: idFicheFragile }
  });
  verif(
    "audit : RETURN_CREATED avec avant/après détaillés",
    !!jaRetour && jaRetour.valeursAvant != null && jaRetour.valeursApres != null
  );

  const jaAnnulation = await db.journalAudit.findFirst({
    where: { action: "ASSIGNMENT_CANCELLED", entiteId: ficheAnnulableData?.id }
  });
  verif("audit : ASSIGNMENT_CANCELLED tracé", !!jaAnnulation);

  // Le journal est immuable : un UPDATE brut doit être bloqué par le trigger…
  let updateBrutBloque = false;
  try {
    await db.$executeRaw`UPDATE journal_audit SET details = details WHERE id = ${jaCreation!.id}`;
  } catch {
    updateBrutBloque = true;
  }
  verif("trigger : UPDATE direct du journal REFUSÉ", updateBrutBloque);

  // …sauf via la porte d'échap. documentée app.purge_journaux (purges encadrées).
  let porteEchapFonctionne = false;
  try {
    await db.$transaction([
      db.$executeRaw`SELECT set_config('app.purge_journaux', 'autorisee', true)`,
      db.$executeRaw`UPDATE journal_audit SET details = details WHERE id = ${jaCreation!.id}`
    ]);
    porteEchapFonctionne = true;
  } catch {
    porteEchapFonctionne = false;
  }
  verif("trigger : purge encadrée par app.purge_journaux AUTORISÉE", porteEchapFonctionne);

  // L'invariant des compartiments est vérifié PAR LA BASE, pas seulement par le code.
  let checkQuantitesBloque = false;
  try {
    await db.$executeRaw`UPDATE articles_stock SET quantity = quantity - 50 WHERE id = ${idSousSeuil}`;
  } catch {
    checkQuantitesBloque = true;
  }
  verif("CHECK base : quantités incohérentes (3 compartiments) REFUSÉES", checkQuantitesBloque);

  const indexPartiels = await db.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('uq_article_numero_serie', 'uq_affectation_imei', 'uq_notification_alerte_ouverte_destinataire')
  `;
  verif(
    "base : 3 index partiels uniques posés",
    indexPartiels.length === 3,
    indexPartiels.map((i) => i.indexname).join(", ")
  );

  // Immutabilité vérifiée COMPORTEMENTALEMENT (critère principal) :
  // un UPDATE/DELETE brut sur l'historique doit être refusé par la base,
  // quel que soit le nom du trigger qui l'interdit.
  let mouvementUpdateBloque = false;
  try {
    await db.$executeRaw`UPDATE mouvements_stock SET notes = notes WHERE id = (SELECT id FROM mouvements_stock LIMIT 1)`;
  } catch {
    mouvementUpdateBloque = true;
  }
  verif("base : UPDATE direct d'un MOUVEMENT REFUSÉ (immutabilité)", mouvementUpdateBloque);

  let retourSupprimeBloque = false;
  try {
    await db.$executeRaw`DELETE FROM retours_affectation WHERE id = (SELECT id FROM retours_affectation LIMIT 1)`;
  } catch {
    retourSupprimeBloque = true;
  }
  verif("base : DELETE direct d'un RETOUR REFUSÉ (immutabilité)", retourSupprimeBloque);

  // Contrôle structurel complémentaire : au moins un trigger utilisateur
  // sur chacune des trois tables historiques — indépendamment de son nom.
  const tablesImmuables = await db.$queryRaw<{ nom_table: string }[]>`
    SELECT DISTINCT c.relname AS "nom_table"
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname IN ('journal_audit', 'mouvements_stock', 'retours_affectation')
      AND NOT t.tgisinternal
  `;
  verif(
    "base : triggers présents sur les 3 tables historiques",
    tablesImmuables.length === 3,
    tablesImmuables.map((t) => t.nom_table).sort().join(", ")
  );

  // Déduplication des alertes : une seule OUVERTE par (type, entité,
  // DESTINATAIRE) — chantier 3.5, le fan-out par destinataire remplace le
  // modèle global. Deux insertions identiques pour le même compte : la
  // seconde est refusée par l'index unique partiel.
  const entiteDedup = `${marqueCh3}-dedup`;
  const adminDedup = await db.utilisateur.findFirst({
    where: { role: { code: "SUPER_ADMIN" }, supprimeLe: null },
    select: { id: true }
  });
  let dedupBloque = false;
  try {
    await db.notification.create({
      data: { type: "STOCK_FAIBLE", titre: "Test dédup 1", message: "-", entite: "ArticleStock", entiteId: entiteDedup, destinataireId: adminDedup!.id }
    });
    await db.notification.create({
      data: { type: "STOCK_FAIBLE", titre: "Test dédup 2", message: "-", entite: "ArticleStock", entiteId: entiteDedup, destinataireId: adminDedup!.id }
    });
  } catch {
    dedupBloque = true;
  }
  verif("index partiel : deuxième alerte OUVERTE pour la même entité ET destinataire REFUSÉE", dedupBloque);
  await db.notification.deleteMany({ where: { entiteId: entiteDedup } }).catch(() => undefined);

  const ligneIdem = await db.requeteIdempotente.findUnique({ where: { cle: `POST /api#${cleIdem}` } });
  verif(
    "idempotence : réponse 201 persistée avec son corps",
    !!ligneIdem && ligneIdem.statusReponse === 201 && ligneIdem.corpsReponse != null,
    JSON.stringify(ligneIdem && ligneIdem.statusReponse)
  );

  // Nettoyage : les articles de test sont libérés puis archivés (soft delete).
  await admin.json(`/api/assignments/${idFichePlancher}`, { method: "DELETE" });
  for (const idTest of [idSousSeuil, idArticleIdem, idPlancher, idAnnulable]) {
    if (estUuid(idTest)) await admin.json(`/api/stock/${idTest}`, { method: "DELETE" }).catch(() => undefined);
  }
  const donneesNettoyees = await lireData();
  verif(
    "nettoyage : articles de test archivés (soft delete), absents des listes",
    ![idSousSeuil, idArticleIdem, idPlancher, idAnnulable].some((id) =>
      donneesNettoyees.articles.some((a: any) => a.id === id)
    )
  );
  await db.$disconnect();

  console.log(echecs === 0 ? "\nTOUS LES CONTRÔLES PASSENT (chantiers 2b + 3)" : `\nNON-RÉGRESSION : ${echecs} ÉCHEC(S)`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
