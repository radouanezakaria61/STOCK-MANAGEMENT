/**
 * Vérification de non-régression du contrat d'API après le chantier 2a
 * (plan v1.2 §3.2) : le module Fournisseurs, le plafond d'engagement et la
 * matrice de permissions ont disparu ; le référentiel Sociétés est en place.
 */
const BASE = process.env.API_BASE || "http://localhost:3001";

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

async function main() {
  const res = await fetch(`${BASE}/api/data`);
  verif("GET /api/data → 200", res.status === 200);
  const enveloppe = await res.json();
  verif("enveloppe {status:'ok'}", enveloppe.status === "ok");
  const data = enveloppe.data;

  // Clés API en français (AGENTS.md « Langue des clés », décision du 22 août).
  const { societes, utilisateurs: users, articles: stockItems, mouvements: movements, affectations: assignments } = data as Record<string, any[]>;

  // ── Compteurs (seed parc IT) ───────────────────────────────────────
  const compteurs = [societes?.length, users?.length, stockItems?.length, movements?.length, assignments?.length].join(",");
  verif("compteurs 2,5,7,4,3", compteurs === "2,5,7,4,3", compteurs);

  // ── Clés retirées absentes / clés anglaises supprimées ─────────────
  verif("clé vendors supprimée", !("vendors" in data));
  verif("clé purchaseOrders supprimée", !("purchaseOrders" in data));
  verif("clé budgets supprimée", !("budgets" in data));
  verif("clé rfqComparisonPools supprimée", !("rfqComparisonPools" in data));
  verif("clé users (anglaise) supprimée", !("users" in data));
  verif("clé stockItems (anglaise) supprimée", !("stockItems" in data));

  // ── Ordre d'affichage (références) ─────────────────────────────────
  verif("ordre societes soc-1→soc-2", societes.map((s: any) => s.reference).join() === ["soc-1","soc-2"].join(), societes.map((s: any) => s.reference).join());
  verif("ordre utilisateurs usr-1→usr-5", users.map((u: any) => u.reference).join() === ["usr-1","usr-2","usr-3","usr-4","usr-5"].join());
  verif("ordre articles STK-001→STK-007", stockItems.map((s: any) => s.reference).join() === ["STK-001","STK-002","STK-003","STK-004","STK-005","STK-006","STK-007"].join());
  verif("ordre mouvements MVT-001→MVT-004", movements.map((m: any) => m.reference).join() === ["MVT-001","MVT-002","MVT-003","MVT-004"].join());
  verif("ordre affectations 001→003", assignments.map((a: any) => a.reference).join() === ["AFF-DSI-2026-001","AFF-DSI-2026-002","AFF-DSI-2026-003"].join());

  // ── Identifiants UUID partout ──────────────────────────────────────
  const toutesEntites = [...societes, ...users, ...stockItems, ...movements, ...assignments];
  verif("ids = uuid sur toutes les entités", toutesEntites.every((e) => estUuid(e.id)), toutesEntites.filter((e) => !estUuid(e.id)).map((e) => e.reference ?? "?").slice(0, 5).join());

  // ── Cale de traduction anglaise supprimée (décision du 22 août) ────
  verif("creeLe présent, createdAt absent", toutesEntites.every((e) => typeof e.creeLe === "string" && e.creeLe.length > 0 && !("createdAt" in e)));

  // ── Décimaux → nombres ─────────────────────────────────────────────
  verif("prix unitaires numériques (stock)", stockItems.every((s: any) => typeof s.unitPriceMAD === "number" && typeof s.totalValueMAD === "number"));

  // ── Formats de dates (contrat inchangé) ────────────────────────────
  verif("purchaseDate yyyy-MM-dd", stockItems.every((s: any) => estDateSeule(s.purchaseDate)));
  verif("warrantyExpiry yyyy-MM-dd ou null", stockItems.every((s: any) => s.warrantyExpiry === null || estDateSeule(s.warrantyExpiry)));
  verif("mouvement.date yyyy-MM-dd", movements.every((m: any) => estDateSeule(m.date)));
  verif("assignedDate yyyy-MM-dd", assignments.every((a: any) => estDateSeule(a.assignedDate)));
  verif("derniereConnexion 'YYYY-MM-DD HH:mm'", users.every((u: any) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(u.derniereConnexion)), JSON.stringify(users.map((u: any) => u.derniereConnexion)));

  // ── Parité métier (échantillon) ────────────────────────────────────
  const soc1 = societes.find((s: any) => s.reference === "soc-1");
  verif(
    "soc-1 Distra SA / DSA active, sans champ fournisseur",
    soc1.nom === "Distra SA" && soc1.codeCourt === "DSA" && soc1.actif === true && !("qualityScore" in soc1),
    `${soc1.nom}/${soc1.codeCourt}`
  );

  const stk1 = stockItems.find((s: any) => s.reference === "STK-001");
  verif(
    "STK-001 qty 15/9/6, prix 14500, fournisseur texte sans purchaseOrderId",
    stk1.quantity === 15 && stk1.availableQty === 9 && stk1.allocatedQty === 6 && stk1.unitPriceMAD === 14500 &&
      typeof stk1.fournisseur === "string" && stk1.fournisseur.length > 0 && !("vendorName" in stk1) && !("purchaseOrderId" in stk1)
  );

  const usr1 = users.find((u: any) => u.reference === "usr-1");
  verif(
    "usr-1 ADMIN rattaché à soc-1, sans plafond ni permissions",
    usr1.role === "ADMIN" && usr1.societeId === soc1.id &&
      !("spendingLimitMAD" in usr1) && !("permissions" in usr1) && usr1.societe?.codeCourt === "DSA"
  );
  verif("usr-1.derniereConnexion 2026-08-18 13:40", usr1.derniereConnexion === "2026-08-18 13:40");

  verif(
    "aucun rôle achats résiduel",
    users.every((u: any) => ["ADMIN", "AUDITOR", "UTILISATEUR"].includes(u.role)),
    users.map((u: any) => `${u.reference}:${u.role}`).join()
  );

  // Intégrité FK résolue : mouvement MVT-001 pointe vers le uuid de STK-001
  const mvt1 = movements.find((m: any) => m.reference === "MVT-001");
  verif("MVT-001.stockItemId = uuid de STK-001", mvt1.stockItemId === stk1.id);

  // ── Routes fournisseurs retirées, route sociétés en place ──────────
  for (const route of ["/api/pos", "/api/rfq", "/api/ai/analyze-bids", "/api/vendors"]) {
    const r = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const texte = await r.text();
    verif(`route retirée POST ${route} → 404`, r.status === 404, `status=${r.status} body=${texte.slice(0, 80)}`);
  }

  const rSoc = await fetch(`${BASE}/api/societes`);
  const envSoc = await rSoc.json();
  verif(
    "GET /api/societes → 200 avec 2 entités",
    rSoc.status === 200 && envSoc.status === "ok" && Array.isArray(envSoc.data) && envSoc.data.length === 2,
    `status=${rSoc.status}`
  );
  const rStatut = await fetch(`${BASE}/api/societes/${soc1.id}/statut`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actif: false })
  });
  const offBody = await rStatut.json();
  const on = await fetch(`${BASE}/api/societes/${soc1.id}/statut`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actif: true })
  });
  const onBody = await on.json();
  verif(
    "bascule actif=false → true sur soc-1 OK",
    rStatut.ok && on.ok && offBody.data?.actif === false && onBody.data?.actif === true,
    `off=${rStatut.status} on=${on.status}`
  );
  await fetch(`${BASE}/api/societes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom: "", codeCourt: "" })
  }).then(async (r) => {
    const b = await r.json();
    verif("POST /api/societes vide → 400 message français", r.status === 400 && typeof b.error === "string", `status=${r.status}`);
  });

  console.log(echecs === 0 ? "\nNON-RÉGRESSION : TOUS LES CONTRÔLES PASSENT" : `\nNON-RÉGRESSION : ${echecs} ÉCHEC(S)`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
