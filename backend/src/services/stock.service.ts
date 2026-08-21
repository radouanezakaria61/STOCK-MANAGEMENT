import { Prisma, ArticleStock } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { dateDuJour, numeroSuivant } from "../lib/ids.js";
import { marquerCommeLivre } from "./bons-commande.service.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function idsArticlesExistants(tx?: Tx): Promise<string[]> {
  const rows = await (tx ?? prisma).articleStock.findMany({
    select: { id: true },
    where: { id: { startsWith: "STK-" } }
  });
  return rows.map((r) => r.id);
}

async function prochainsNumerosArticle(tx?: Tx) {
  const numero = numeroSuivant(await idsArticlesExistants(tx), /^STK-(\d+)$/);
  return { id: `STK-${String(numero).padStart(3, "0")}`, assetTag: `IT-AST-${1000 + numero}` };
}

export async function nouvelIdMouvement(tx?: Tx): Promise<string> {
  const total = await (tx ?? prisma).mouvementStock.count();
  return `MVT-00${total + 1}`;
}

// ── Lectures ──────────────────────────────────────────────────────────

export async function listerStock() {
  const [items, movements] = await Promise.all([
    prisma.articleStock.findMany({ orderBy: { seq: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { seq: "desc" } })
  ]);
  return { items, movements };
}

interface FiltresRecherche {
  q?: string;
  category?: string;
  availableOnly?: boolean;
}

export async function rechercherStock(filtres: FiltresRecherche) {
  const q = (filtres.q || "").toLowerCase().trim();
  const category = filtres.category || "";
  const availableOnly = filtres.availableOnly === true;

  const where: Prisma.ArticleStockWhereInput = {};
  if (availableOnly) where.availableQty = { gt: 0 };
  if (category && category !== "Tous") where.category = category;

  let resultats: ArticleStock[] = await prisma.articleStock.findMany({ where });

  if (q) {
    resultats = resultats.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.model?.toLowerCase().includes(q) ||
        item.serialNumber?.toLowerCase().includes(q) ||
        item.assetTag?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        specsContient(item, "cpu", q) ||
        specsContient(item, "ram", q) ||
        specsContient(item, "storage", q)
    );
  }

  return resultats;
}

function specsContient(item: ArticleStock, cle: string, q: string): boolean {
  const specs = item.specs as Record<string, unknown> | null;
  const valeur = specs?.[cle];
  return typeof valeur === "string" && valeur.toLowerCase().includes(q);
}

// ── Création ──────────────────────────────────────────────────────────

export interface EntreeArticle {
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  quantity?: unknown;
  minThreshold?: unknown;
  unitPriceMAD?: unknown;
  location?: string;
  status?: string;
  purchaseOrderId?: string;
  purchaseOrderTitle?: string;
  vendorName?: string;
  notes?: string;
  performedBy?: string;
}

export async function creerArticle(data: EntreeArticle) {
  const {
    name,
    category,
    brand,
    model,
    serialNumber,
    quantity,
    minThreshold,
    unitPriceMAD,
    location,
    status,
    purchaseOrderId,
    purchaseOrderTitle,
    vendorName,
    notes,
    performedBy
  } = data;

  if (!name || !category) {
    throw requeteInvalide("Le nom et la catégorie de l'article sont obligatoires.");
  }

  const qty = parseInt(String(quantity)) || 1;
  const unitPrice = parseFloat(String(unitPriceMAD)) || 0;

  const article = await prisma.$transaction(async (tx) => {
    const numeros = await prochainsNumerosArticle(tx);

    const newItem = await tx.articleStock.create({
      data: {
        id: numeros.id,
        assetTag: numeros.assetTag,
        name,
        category,
        brand: brand || "Générique",
        model: model || "",
        serialNumber: serialNumber || `SN-${Date.now().toString().slice(-6)}`,
        quantity: qty,
        availableQty: qty,
        allocatedQty: 0,
        minThreshold: parseInt(String(minThreshold)) || 2,
        unitPriceMAD: unitPrice,
        totalValueMAD: qty * unitPrice,
        location: location || "Magasin Central IT (Casablanca)",
        status: status || "En Stock",
        purchaseOrderId: purchaseOrderId || null,
        purchaseOrderTitle: purchaseOrderTitle || null,
        vendorName: vendorName || null,
        purchaseDate: dateDuJour(),
        notes: notes || ""
      }
    });

    // Mouvement d'entrée initial tracé dans la même transaction
    await tx.mouvementStock.create({
      data: {
        id: await nouvelIdMouvement(tx),
        stockItemId: newItem.id,
        itemName: name,
        type: "Entrée Achat",
        quantity: qty,
        performedBy: performedBy || "Administrateur Système",
        date: dateDuJour(),
        purchaseOrderId: purchaseOrderId || null,
        notes: "Création et entrée initiale en stock."
      }
    });

    return newItem;
  });

  return { status: 201 as const, message: "Article ajouté au stock IT avec succès.", data: article };
}

// ── Mise à jour ───────────────────────────────────────────────────────

export interface EntreeModificationArticle {
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  quantity?: unknown;
  minThreshold?: unknown;
  unitPriceMAD?: unknown;
  location?: string;
  status?: string;
  notes?: string;
  warrantyExpiry?: string | null;
}

export async function modifierArticle(id: string, data: EntreeModificationArticle) {
  const article = await prisma.articleStock.findUnique({ where: { id } });
  if (!article) throw introuvable("Article de stock introuvable.");

  const donnees: Record<string, unknown> = {};
  if (data.name !== undefined) donnees["name"] = data.name;
  if (data.category !== undefined) donnees["category"] = data.category;
  if (data.brand !== undefined) donnees["brand"] = data.brand;
  if (data.model !== undefined) donnees["model"] = data.model;
  if (data.serialNumber !== undefined) donnees["serialNumber"] = data.serialNumber;
  if (data.location !== undefined) donnees["location"] = data.location;
  if (data.status !== undefined) donnees["status"] = data.status;
  if (data.notes !== undefined) donnees["notes"] = data.notes;
  if (data.warrantyExpiry !== undefined) donnees["warrantyExpiry"] = data.warrantyExpiry;
  if (data.minThreshold !== undefined)
    donnees["minThreshold"] = parseInt(String(data.minThreshold));

  let quantite = article.quantity;
  if (data.quantity !== undefined) {
    const newQty = parseInt(String(data.quantity)) || 0;
    const diff = newQty - article.quantity;
    quantite = newQty;
    donnees["quantity"] = newQty;
    donnees["availableQty"] = Math.max(0, article.availableQty + diff);
  }

  let prixUnitaire = article.unitPriceMAD;
  if (data.unitPriceMAD !== undefined) {
    prixUnitaire = parseFloat(String(data.unitPriceMAD)) || 0;
    donnees["unitPriceMAD"] = prixUnitaire;
  }
  donnees["totalValueMAD"] = quantite * prixUnitaire;

  const misAJour = await prisma.articleStock.update({ where: { id }, data: donnees });
  return { message: "Article de stock mis à jour.", data: misAJour };
}

// ── Mouvements de stock ───────────────────────────────────────────────

export interface EntreeMouvement {
  type?: string;
  quantity?: unknown;
  performedBy?: string;
  recipient?: string;
  department?: string;
  notes?: string;
}

export async function enregistrerMouvement(id: string, data: EntreeMouvement) {
  const { type, quantity, performedBy, recipient, department, notes } = data;
  const qty = parseInt(String(quantity)) || 1;

  const resultat = await prisma.$transaction(async (tx) => {
    const item = await tx.articleStock.findUnique({ where: { id } });
    if (!item) throw introuvable("Article de stock introuvable.");

    switch (type) {
      case "Sortie Affectation": {
        if (item.availableQty < qty) {
          throw requeteInvalide(
            `Quantité disponible insuffisante (${item.availableQty} en stock disponible).`
          );
        }
        item.availableQty -= qty;
        item.allocatedQty += qty;
        if (recipient) {
          item.assignedTo = {
            userName: recipient,
            department: department || "Général",
            assignedDate: dateDuJour()
          };
          if (item.availableQty === 0) item.status = "Affecté";
        }
        break;
      }
      case "Retour Stock": {
        const returnQty = Math.min(qty, item.allocatedQty);
        item.allocatedQty = Math.max(0, item.allocatedQty - returnQty);
        item.availableQty += returnQty;
        if (item.allocatedQty === 0) item.assignedTo = null;
        item.status = "En Stock";
        break;
      }
      case "Entrée Achat": {
        item.quantity += qty;
        item.availableQty += qty;
        item.totalValueMAD = item.quantity * item.unitPriceMAD;
        break;
      }
      case "Mise au Rebut": {
        item.quantity = Math.max(0, item.quantity - qty);
        item.availableQty = Math.max(0, item.availableQty - qty);
        item.totalValueMAD = item.quantity * item.unitPriceMAD;
        if (item.quantity === 0) item.status = "Rebut / Fin de vie";
        break;
      }
      case "Ajustement Inventaire": {
        item.quantity = qty;
        item.availableQty = Math.max(0, qty - item.allocatedQty);
        item.totalValueMAD = item.quantity * item.unitPriceMAD;
        break;
      }
    }

    const misAJour = await tx.articleStock.update({
      where: { id },
      data: {
        availableQty: item.availableQty,
        allocatedQty: item.allocatedQty,
        quantity: item.quantity,
        totalValueMAD: item.totalValueMAD,
        status: item.status,
        assignedTo: item.assignedTo === null ? Prisma.DbNull : (item.assignedTo as Prisma.InputJsonValue)
      }
    });

    const mouvement = await tx.mouvementStock.create({
      data: {
        id: await nouvelIdMouvement(tx),
        stockItemId: id,
        itemName: item.name,
        type: type!,
        quantity: qty,
        performedBy: performedBy || "Responsable Stock IT",
        recipient: recipient || null,
        department: department || null,
        date: dateDuJour(),
        notes: notes || ""
      }
    });

    return { item: misAJour, mouvement };
  });

  return {
    message: `Mouvement de stock "${type}" enregistré.`,
    data: resultat
  };
}

// ── Import / réception depuis un bon de commande ─────────────────────

const REGLES_CATEGORIE: Array<[RegExp, string]> = [
  [/portable|laptop|thinkpad|macbook/, "Laptops & Portables"],
  [/écran|moniteur|poste|station/, "Postes Fixes & Écrans"],
  [/serveur|stockage|san|nas/, "Serveurs & Stockage"],
  [/switch|routeur|câblage|réseau|firewall/, "Réseau & Sécurité"],
  [/toner|cartouche|papier|fourniture/, "Consommables & Pièces"],
  [/licence|logiciel|saas|cloud/, "Licences & Logiciels"]
];

function deduireCategorie(desc: string): string {
  const lowerDesc = desc.toLowerCase();
  for (const [regex, categorie] of REGLES_CATEGORIE) {
    if (regex.test(lowerDesc)) return categorie;
  }
  return "Périphériques & Accessoires";
}

export interface LigneBonImport {
  desc?: string;
  qty?: unknown;
  unitPrice?: unknown;
}

export async function importerDepuisBonCommande(data: {
  purchaseOrderId?: string;
  performedBy?: string;
  location?: string;
}) {
  const { purchaseOrderId, performedBy, location } = data;

  const po = await prisma.bonCommande.findUnique({
    where: { id: purchaseOrderId ?? "" },
    include: { items: true }
  });
  if (!po) throw introuvable("Demande d'achat introuvable.");

  const poItems =
    po.items && po.items.length > 0
      ? po.items.map((i) => ({ desc: i.desc, qty: i.qty, unitPrice: i.unitPrice }))
      : [{ desc: po.title, qty: 1, unitPrice: po.amount }];

  const crees = await prisma.$transaction(async (tx) => {
    let numero = numeroSuivant(await idsArticlesExistants(tx), /^STK-(\d+)$/);
    const creesLocaux: ArticleStock[] = [];

    for (let idx = 0; idx < poItems.length; idx++) {
      const poItem = poItems[idx]!;
      const qty = parseInt(String(poItem.qty)) || 1;
      const unitPrice = parseFloat(String(poItem.unitPrice)) || 0;
      const newId = `STK-${String(numero).padStart(3, "0")}`;
      const assetTag = `IT-AST-${1000 + numero}`;
      numero++;

      const newItem = await tx.articleStock.create({
        data: {
          id: newId,
          assetTag,
          name: poItem.desc ?? po.title,
          category: deduireCategorie(poItem.desc ?? po.title),
          brand: po.vendorName?.split(" ")[0] || "Fournisseur",
          model: "Standard Entreprise",
          serialNumber: `SN-${Date.now().toString().slice(-5)}${idx}`,
          quantity: qty,
          availableQty: qty,
          allocatedQty: 0,
          minThreshold: Math.max(1, Math.round(qty * 0.2)),
          unitPriceMAD: unitPrice,
          totalValueMAD: qty * unitPrice,
          location: location || "Magasin Central IT (Casablanca)",
          status: "En Stock",
          purchaseOrderId: po.id,
          purchaseOrderTitle: po.title,
          vendorName: po.vendorName,
          purchaseDate: po.deliveryDate || dateDuJour(),
          warrantyExpiry: new Date(Date.now() + 365 * 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          notes: `Intégré depuis le Bon de Commande ${po.id}. Fournisseur : ${po.vendorName}.`
        }
      });
      creesLocaux.push(newItem);

      await tx.mouvementStock.create({
        data: {
          id: await nouvelIdMouvement(tx),
          stockItemId: newId,
          itemName: poItem.desc ?? po.title,
          type: "Entrée Achat",
          quantity: qty,
          performedBy: performedBy || "Service Réception Achats",
          date: dateDuJour(),
          purchaseOrderId: po.id,
          notes: `Réception conforme depuis la DA ${po.id}.`
        }
      });
    }

    return creesLocaux;
  });

  // Marquer le bon de commande comme livré
  await marquerCommeLivre(po.id);

  return {
    status: 201 as const,
    message: `${crees.length} article(s) intégré(s) avec succès dans le stock IT depuis ${po.id}.`,
    data: crees
  };
}

// ── Suppression ───────────────────────────────────────────────────────

export async function supprimerArticle(id: string) {
  const article = await prisma.articleStock.findUnique({ where: { id } });
  if (!article) throw introuvable("Article introuvable.");

  await prisma.articleStock.delete({ where: { id } });
  return { message: "Article supprimé du stock IT." };
}
