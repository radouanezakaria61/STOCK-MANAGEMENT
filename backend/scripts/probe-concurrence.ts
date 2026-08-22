/**
 * Sonde complémentaire au vérificateur de non-régression :
 *  1. Concurrence : 20 affectations SIMULTANÉES sur un article à
 *     disponibilité 1 — exactement 1 succès, 19 refus, aucune quantité
 *     négative, une seule fiche Active.
 *  2. Cohérence globale : statut vs compartiments de quantités sur tous
 *     les articles non supprimés (0 incohérence attendue).
 *  3. Journal d'audit : aucune donnée sensible persistée.
 *
 * Prérequis : serveur démarré sur BASE (défaut http://localhost:3001).
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.API_BASE || "http://localhost:3001";
const MDP_DEMO = "Distra-Demo-2026";
const db = new PrismaClient();

let echecs = 0;
function verif(nom: string, condition: boolean, detail = "") {
  if (condition) console.log(`  OK   ${nom}`);
  else {
    echecs++;
    console.error(`  FAIL ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

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
  async json(chemin: string, init: RequestInit = {}, origine?: string) {
    const res = await this.requete(chemin, init, origine);
    const corps = await res.json().catch(() => undefined);
    for (const brut of res.headers.getSetCookie?.() ?? []) {
      const [paire] = brut.split(";");
      const idx = paire.indexOf("=");
      if (idx > 0) this.jetons.set(paire.slice(0, idx).trim(), paire.slice(idx + 1).trim());
    }
    return { status: res.status, corps };
  }
}

async function main() {
  const admin = new SessionHttp();
  const connexion = await admin.json("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifiant: "zakaria.radouane", motDePasse: MDP_DEMO })
  });
  verif("connexion admin", connexion.status === 200, `${connexion.status}`);
  if (connexion.status !== 200) process.exit(1);

  // ── 1. Concurrence : 20 requêtes simultanées, disponibilité = 1 ──
  console.log("\n── Concurrence (20 POST simultanés, dispo = 1) ──");
  const marque = `conc-${Date.now()}`;
  const article = await admin.json("/api/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: `${marque} portable unique`,
      category: "Matériel Informatique",
      brand: "Test",
      model: "CC-20",
      serialNumber: `${marque}-SN`,
      quantity: 1,
      minThreshold: 0,
      unitPriceMAD: 100,
      performedBy: "Sonde concurrence"
    })
  });
  const idArticle: string | undefined = article.corps?.data?.id;
  verif("article unitaire créé", article.status === 201 && !!idArticle, `${article.status}`);

  const t0 = Date.now();
  const reponses = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      admin.json("/api/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateType: "DSI-IT-01",
          formCode: `FRM-CC-${i}`,
          beneficiaryName: `Bénéficiaire ${i}`,
          beneficiaryDepartment: "Technologies de l'Information",
          beneficiarySite: "Siège",
          authorizedBy: "Sonde",
          dsiTitle: "Chef de Service DSI",
          resourceType: "Équipement Informatique",
          items: [{ stockItemId: idArticle }]
        })
      })
    )
  );
  const succes = reponses.filter((r) => r.status === 201);
  const conflits = reponses.filter((r) => r.status === 409);
  verif(
    "exactement 1 succès et 19 refus",
    succes.length === 1 && reponses.length - succes.length === 19,
    `succès=${succes.length} conflits409=${conflits.length} autres=${reponses.length - succes.length - conflits.length}`
  );
  console.log(`       (durée du salve : ${Date.now() - t0} ms)`);

  const lu = idArticle ? await db.articleStock.findUnique({ where: { id: idArticle } }) : null;
  verif(
    "compartiments intacts (1,0,0,1) sans négatif",
    !!lu && lu.quantity === 1 && lu.availableQty === 0 && lu.maintenanceQty === 0 && lu.allocatedQty === 1 &&
      [lu.quantity, lu.availableQty, lu.maintenanceQty, lu.allocatedQty].every((q) => q >= 0),
    lu ? `${lu.quantity},${lu.availableQty},${lu.maintenanceQty},${lu.allocatedQty}` : "absent"
  );
  verif(
    "statut cohérent après course (Affecté)",
    lu?.status === "Affecté",
    lu ? String(lu.status) : "absent"
  );

  const fichesActives = await db.affectation.count({
    where: { status: "Active", items: { some: { stockItemId: idArticle } } }
  });
  verif("une seule fiche Active pour l'article", fichesActives === 1, String(fichesActives));

  // Nettoyage : annulation de la fiche gagnante puis archivage de l'article.
  const ficheGagnante = succes[0]?.corps?.data?.id ?? succes[0]?.corps?.data?.assignment?.id;
  if (ficheGagnante) await admin.json(`/api/assignments/${ficheGagnante}`, { method: "DELETE" });
  if (idArticle) await admin.json(`/api/stock/${idArticle}`, { method: "DELETE" });

  // ── 2. Cohérence statuts ↔ compartiments sur TOUT le parc ──
  console.log("\n── Cohérence globale (statut vs quantités vs affectations) ──");
  const articles = await db.articleStock.findMany({ where: { supprimeLe: null } });
  const incoherences: string[] = [];
  for (const a of articles) {
    const negatif = [a.quantity, a.availableQty, a.maintenanceQty, a.allocatedQty].some((q) => q < 0);
    if (negatif) incoherences.push(`${a.reference}: quantité négative`);
    if (a.quantity !== a.availableQty + a.allocatedQty + a.maintenanceQty)
      incoherences.push(`${a.reference}: total ≠ somme des compartiments`);
    // Contradictions interdites par la machine à états (chantier 3).
    // NB : les lignes de démonstration préexistantes peuvent porter des
    // compartiments alloué/maintenance > 0 sous « En Stock » ; ce n'est pas
    // une contradiction tant qu'une unité reste réellement disponible.
    if (a.status === "En Stock" && a.availableQty < 1)
      incoherences.push(`${a.reference}: « En Stock » sans unité disponible`);
    if (a.status === "Affecté" && a.allocatedQty < 1)
      incoherences.push(`${a.reference}: « Affecté » sans allocation`);
    if (a.status === "En Maintenance" && a.maintenanceQty < 1)
      incoherences.push(`${a.reference}: « En Maintenance » sans unité en maintenance`);
  }
  const activesSansAllocation = await db.$queryRaw<{ reference: string }[]>`
    SELECT DISTINCT a.reference FROM affectations aff
    JOIN lignes_affectation l ON l.affectation_id = aff.id
    JOIN articles_stock a ON a.id = l.article_id
    WHERE aff.status = 'Active' AND l.article_id IS NOT NULL AND a.quantite_affectee < 1`;
  for (const r of activesSansAllocation) incoherences.push(`${r.reference}: affectation Active sans allocation côté article`);

  verif(
    `0 incohérence sur ${articles.length} articles`,
    incoherences.length === 0,
    incoherences.slice(0, 5).join(" | ")
  );

  // ── 3. Journal d'audit : pas de secret persisté ──
  console.log("\n── Journal d'audit (données sensibles) ──");
  const entrees = await db.journalAudit.findMany({
    select: { action: true, details: true, valeursAvant: true, valeursApres: true }
  });
  const suspectes = entrees.filter((e) =>
    [e.details, e.valeursAvant, e.valeursApres]
      .filter((v): v is Prisma.JsonValue => v != null)
      .some((v) => {
        const s = JSON.stringify(v).toLowerCase();
        return s.includes("motdepasshash") || s.includes("$argon2") || s.includes('"motdepasse":') || s.includes('"password":');
      })
  );
  verif(
    `aucune donnée sensible dans ${entrees.length} entrées d'audit`,
    suspectes.length === 0,
    suspectes.map((s) => s.action).slice(0, 5).join(", ")
  );

  await db.$disconnect();
  console.log(echecs === 0 ? "\nSONDE : TOUS LES CONTRÔLES PASSENT" : `\nSONDE : ${echecs} ÉCHEC(S)`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
