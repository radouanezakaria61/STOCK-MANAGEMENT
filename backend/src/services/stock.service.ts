import { Prisma, ArticleStock } from "@prisma/client";
import { prisma, prismaSansFiltre } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { dateDuJour, numeroSuivant } from "../lib/ids.js";
import { enNombre } from "../lib/serialisation.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function referencesArticlesExistantes(tx?: Tx): Promise<string[]> {
  // Scan hors filtre soft delete : la référence d'un article archivé reste
  // réservée par sa contrainte UNIQUE. (Lecture ponctuelle hors snapshot :
  // la course concurrente éventuelle est la même qu'avant l'introduction
  // du filtre, et sera verrouillée au chantier 9.)
  const rows = await prismaSansFiltre.articleStock.findMany({
    select: { reference: true },
    where: { reference: { startsWith: "STK-" } }
  });
  return rows.map((r) => r.reference);
}

async function prochainsNumerosArticle(tx?: Tx) {
  const numero = numeroSuivant(await referencesArticlesExistantes(tx), /^STK-(\d+)$/);
  return {
    reference: `STK-${String(numero).padStart(3, "0")}`,
    assetTag: `IT-AST-${1000 + numero}`
  };
}

export async function nouvelleReferenceMouvement(tx?: Tx): Promise<string> {
  const total = await (tx ?? prisma).mouvementStock.count();
  return `MVT-00${total + 1}`;
}

// ── Lectures ──────────────────────────────────────────────────────────

export async function listerStock() {
  const [items, movements] = await Promise.all([
    prisma.articleStock.findMany({ orderBy: { creeLe: "desc" } }),
    prisma.mouvementStock.findMany({ orderBy: { creeLe: "desc" } })
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
  fournisseur?: string;
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
    fournisseur,
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
        reference: numeros.reference,
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
        fournisseur: fournisseur || null,
        purchaseDate: new Date(),
        notes: notes || ""
      }
    });

    // Mouvement d'entrée initial tracé dans la même transaction
    await tx.mouvementStock.create({
      data: {
        reference: await nouvelleReferenceMouvement(tx),
        stockItemId: newItem.id,
        itemName: name,
        type: "Entrée Achat",
        quantity: qty,
        performedBy: performedBy || "Administrateur Système",
        date: new Date(),
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

export async function modifierArticle(idOuReference: string, data: EntreeModificationArticle) {
  const article = await prisma.articleStock.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
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
  if (data.warrantyExpiry !== undefined)
    donnees["warrantyExpiry"] =
      data.warrantyExpiry === null ? null : new Date(`${data.warrantyExpiry}T12:00:00Z`);
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

  let prixUnitaire = enNombre(article.unitPriceMAD);
  if (data.unitPriceMAD !== undefined) {
    prixUnitaire = parseFloat(String(data.unitPriceMAD)) || 0;
    donnees["unitPriceMAD"] = prixUnitaire;
  }
  donnees["totalValueMAD"] = quantite * prixUnitaire;

  const misAJour = await prisma.articleStock.update({ where: { id: article.id }, data: donnees });
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

export async function enregistrerMouvement(idOuReference: string, data: EntreeMouvement) {
  const { type, quantity, performedBy, recipient, department, notes } = data;
  const qty = parseInt(String(quantity)) || 1;

  const resultat = await prisma.$transaction(async (tx) => {
    const item = await tx.articleStock.findFirst({
      where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
    });
    if (!item) throw introuvable("Article de stock introuvable.");

    const prixUnitaire = enNombre(item.unitPriceMAD);
    let valeurTotale = enNombre(item.totalValueMAD);

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
        valeurTotale = item.quantity * prixUnitaire;
        break;
      }
      case "Mise au Rebut": {
        item.quantity = Math.max(0, item.quantity - qty);
        item.availableQty = Math.max(0, item.availableQty - qty);
        valeurTotale = item.quantity * prixUnitaire;
        if (item.quantity === 0) item.status = "Rebut / Fin de vie";
        break;
      }
      case "Ajustement Inventaire": {
        item.quantity = qty;
        item.availableQty = Math.max(0, qty - item.allocatedQty);
        valeurTotale = item.quantity * prixUnitaire;
        break;
      }
    }

    const misAJour = await tx.articleStock.update({
      where: { id: item.id },
      data: {
        availableQty: item.availableQty,
        allocatedQty: item.allocatedQty,
        quantity: item.quantity,
        totalValueMAD: valeurTotale,
        status: item.status,
        assignedTo: item.assignedTo === null ? Prisma.DbNull : (item.assignedTo as Prisma.InputJsonValue)
      }
    });

    const mouvement = await tx.mouvementStock.create({
      data: {
        reference: await nouvelleReferenceMouvement(tx),
        stockItemId: item.id,
        itemName: item.name,
        type: type!,
        quantity: qty,
        performedBy: performedBy || "Responsable Stock IT",
        recipient: recipient || null,
        department: department || null,
        date: new Date(),
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

// ── Suppression (soft delete : l'historique des mouvements est conservé) ──

export async function supprimerArticle(idOuReference: string) {
  const article = await prisma.articleStock.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
  if (!article) throw introuvable("Article introuvable.");
  if (article.supprimeLe) return { message: "Article supprimé du stock IT." };

  await prisma.articleStock.update({
    where: { id: article.id },
    data: { supprimeLe: new Date(), status: "Supprimé" }
  });
  return { message: "Article supprimé du stock IT." };
}
