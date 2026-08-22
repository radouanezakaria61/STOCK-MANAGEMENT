/**
 * Vérification de non-régression du contrat d'API après le retrait des
 * modules achats (02-plan-convergence.md §1.1, décision du 22/08/2026).
 * Compare GET /api/data aux valeurs attendues du seed parc IT : les clés
 * purchaseOrders, budgets, rfqComparisonPools et les routes gelées n'existent plus.
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

  const { vendors, users, stockItems, stockMovements: movements, assignments } = data as Record<string, any[]>;

  // ── Compteurs (seed parc IT) ───────────────────────────────────────
  const compteurs = [vendors?.length, users?.length, stockItems?.length, movements?.length, assignments?.length].join(",");
  verif("compteurs 5,5,7,4,3", compteurs === "5,5,7,4,3", compteurs);

  // ── Clés achats absentes ───────────────────────────────────────────
  verif("clé purchaseOrders supprimée", !("purchaseOrders" in data));
  verif("clé budgets supprimée", !("budgets" in data));
  verif("clé rfqComparisonPools supprimée", !("rfqComparisonPools" in data));

  // ── Ordre d'affichage (références) ─────────────────────────────────
  verif("ordre fournisseurs v-1→v-5", vendors.map((v: any) => v.reference).join() === ["v-1","v-2","v-3","v-4","v-5"].join(), vendors.map((v: any) => v.reference).join());
  verif("ordre utilisateurs usr-1→usr-5", users.map((u: any) => u.reference).join() === ["usr-1","usr-2","usr-3","usr-4","usr-5"].join());
  verif("ordre articles STK-001→STK-007", stockItems.map((s: any) => s.reference).join() === ["STK-001","STK-002","STK-003","STK-004","STK-005","STK-006","STK-007"].join());
  verif("ordre mouvements MVT-001→MVT-004", movements.map((m: any) => m.reference).join() === ["MVT-001","MVT-002","MVT-003","MVT-004"].join());
  verif("ordre affectations 001→003", assignments.map((a: any) => a.reference).join() === ["AFF-DSI-2026-001","AFF-DSI-2026-002","AFF-DSI-2026-003"].join());

  // ── Identifiants UUID partout ──────────────────────────────────────
  const toutesEntites = [...vendors, ...users, ...stockItems, ...movements, ...assignments];
  verif("ids = uuid sur toutes les entités", toutesEntites.every((e) => estUuid(e.id)), toutesEntites.filter((e) => !estUuid(e.id)).map((e) => e.reference ?? "?").slice(0, 5).join());

  // ── Décimaux → nombres ─────────────────────────────────────────────
  verif("prix unitaires numériques (stock)", stockItems.every((s: any) => typeof s.unitPriceMAD === "number" && typeof s.totalValueMAD === "number"));
  verif("plafonds numériques (users)", users.every((u: any) => typeof u.spendingLimitMAD === "number"));

  // ── Formats de dates (contrat inchangé) ────────────────────────────
  verif("purchaseDate yyyy-MM-dd", stockItems.every((s: any) => estDateSeule(s.purchaseDate)));
  verif("warrantyExpiry yyyy-MM-dd ou null", stockItems.every((s: any) => s.warrantyExpiry === null || estDateSeule(s.warrantyExpiry)));
  verif("mouvement.date yyyy-MM-dd", movements.every((m: any) => estDateSeule(m.date)));
  verif("assignedDate yyyy-MM-dd", assignments.every((a: any) => estDateSeule(a.assignedDate)));
  verif("createdAt présent (ISO)", toutesEntites.every((e) => typeof e.createdAt === "string" && e.createdAt.length > 0));
  verif("lastLogin 'YYYY-MM-DD HH:mm'", users.every((u: any) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(u.lastLogin)), JSON.stringify(users.map((u: any) => u.lastLogin)));

  // ── Parité métier (échantillon) ────────────────────────────────────
  const v1 = vendors.find((v: any) => v.reference === "v-1");
  verif("v-1 Apex / Preferred, sans totalSpend ni activeContracts", v1.name === "Apex Tech & Logistique Maroc" && v1.status === "Preferred" && !("totalSpend" in v1) && !("activeContracts" in v1));
  const stk1 = stockItems.find((s: any) => s.reference === "STK-001");
  verif("STK-001 qty 15/9/6, prix 14500, sans purchaseOrderId", stk1.quantity === 15 && stk1.availableQty === 9 && stk1.allocatedQty === 6 && stk1.unitPriceMAD === 14500 && !("purchaseOrderId" in stk1));
  const usr1 = users.find((u: any) => u.reference === "usr-1");
  verif("usr-1 ADMIN, permissions complètes", usr1.role === "ADMIN" && Object.values(usr1.permissions).every(Boolean));
  verif("usr-1.lastLogin 2026-08-18 13:40", usr1.lastLogin === "2026-08-18 13:40");

  // Intégrité FK résolue : mouvement MVT-001 pointe vers le uuid de STK-001
  const mvt1 = movements.find((m: any) => m.reference === "MVT-001");
  verif("MVT-001.stockItemId = uuid de STK-001", mvt1.stockItemId === stk1.id);

  // ── Routes achats retirées ─────────────────────────────────────────
  for (const route of ["/api/pos", "/api/rfq", "/api/ai/analyze-bids"]) {
    const r = await fetch(`${BASE}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const texte = await r.text();
    verif(`route retirée POST ${route} → 404`, r.status === 404, `status=${r.status} body=${texte.slice(0, 80)}`);
  }

  console.log(echecs === 0 ? "\nNON-RÉGRESSION : TOUS LES CONTRÔLES PASSENT" : `\nNON-RÉGRESSION : ${echecs} ÉCHEC(S)`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
