import { Prisma, ArticleStock } from "@prisma/client";
import {
  prisma,
  verrouillerReferences,
  type Tx
} from "../lib/prisma.js";
import { introuvable, requeteInvalide, conflit, stockIndisponible, retourExcedent } from "../lib/erreurs.js";
import { dateDuJour, prochainNumero, referenceAleatoire } from "../lib/ids.js";
import { journaliserDansTx, ACTIONS_AUDIT } from "../lib/journal-audit.js";
import { exigerTransition, STATUTS_MATERIEL, TYPES_MOUVEMENT, type TypeMouvement } from "../lib/machine-etats.js";
import { notifier, verifierSeuilStock, TYPES_NOTIFICATION } from "../lib/notifications.js";
import type { ContexteActeur } from "../lib/acteur.js";
import {
  bornerPagination,
  metaPagination,
  type ParametresPagination
} from "../lib/pagination.js";

// ── Références ────────────────────────────────────────────────────────
// Chantier 3.5 : les numéros proviennent du compteur transactionnel
// (`compteurs`, amorcé par la migration sur les maximums existants,
// archivés compris). L'upsert atomique INSERT … ON CONFLICT … RETURNING
// remplace le scan des références : coût O(1) et unicité garantie même
// sous forte concurrence.

async function prochainsNumerosArticle(tx: Tx) {
  const numero = await prochainNumero(tx, "article");
  return {
    reference: `STK-${String(numero).padStart(3, "0")}`,
    assetTag: `IT-AST-${1000 + numero}`
  };
}

export async function nouvelleReferenceMouvement(tx?: Tx): Promise<string> {
  const numero = await prochainNumero(tx ?? (prisma as unknown as Tx), "mouvement");
  return `MVT-${String(numero).padStart(3, "0")}`;
}

// Verrou pessimiste sur une ligne article (SELECT … FOR UPDATE) après
// résolution id|référence. Toute écriture de quantité passe par ici.
async function verrouillerArticle(tx: Tx, idOuReference: string): Promise<ArticleStock> {
  const trouve = await tx.articleStock.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] },
    select: { id: true }
  });
  if (!trouve) throw introuvable("Article de stock introuvable.");
  await tx.$queryRaw`SELECT id FROM articles_stock WHERE id = ${trouve.id} FOR UPDATE`;
  // Relecture post-verrouillage (le findUnique applique le filtre soft delete :
  // un article archivé ressort null → refus).
  const article = await tx.articleStock.findUnique({ where: { id: trouve.id } });
  if (!article) throw introuvable("Article de stock introuvable.");
  return article;
}

// ── Lectures ──────────────────────────────────────────────────────────

export async function listerStock(parametres?: Partial<ParametresPagination>) {
  // Priorité 2 : pagination serveur (articles). Les mouvements disposent de
  // leur propre endpoint paginé (GET /api/mouvements) — une page d'articles
  // ne tire plus jamais la table d'historique complète avec elle.
  const { page, limite, skip, take } = bornerPagination(parametres);
  // Le soft delete est appliqué automatiquement par l'extension Prisma
  // (lib/prisma.ts) sur count() comme findMany().
  const [total, items] = await Promise.all([
    prisma.articleStock.count(),
    prisma.articleStock.findMany({
      orderBy: [{ creeLe: "desc" }, { id: "desc" }],
      skip,
      take
    })
  ]);
  return { items, pagination: metaPagination(page, limite, total) };
}

/** Historique des mouvements, paginé côté serveur. L'historique étant en
 *  écriture seule, il ne fait que croître : aucune lecture « tout ». */
export async function listerMouvements(parametres?: Partial<ParametresPagination>) {
  const { page, limite, skip, take } = bornerPagination(parametres);
  const [total, items] = await Promise.all([
    prisma.mouvementStock.count(),
    prisma.mouvementStock.findMany({
      orderBy: [{ creeLe: "desc" }, { id: "desc" }],
      skip,
      take
    })
  ]);
  return { items, pagination: metaPagination(page, limite, total) };
}

interface FiltresRecherche {
  q?: string;
  category?: string;
  availableOnly?: boolean;
  page?: number;
  limite?: number;
}

export async function rechercherStock(filtres: FiltresRecherche) {
  const q = (filtres.q || "").toLowerCase().trim();
  const category = filtres.category || "";
  const availableOnly = filtres.availableOnly === true;
  const { page, limite, skip, take } = bornerPagination({
    page: filtres.page,
    limite: filtres.limite,
  });

  const where: Prisma.ArticleStockWhereInput = {};
  if (availableOnly) where.availableQty = { gt: 0 };
  if (category && category !== "Tous") where.category = category;

  if (q) {
    const champTexte = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { name: champTexte },
      { brand: champTexte },
      { model: champTexte },
      { serialNumber: champTexte },
      { assetTag: champTexte },
      { category: champTexte },
      { specs: { path: ["cpu"], string_contains: q } },
      { specs: { path: ["ram"], string_contains: q } },
      { specs: { path: ["storage"], string_contains: q } }
    ];
  }

  const [total, items] = await Promise.all([
    prisma.articleStock.count({ where }),
    prisma.articleStock.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip,
      take
    })
  ]);
  return { items, pagination: metaPagination(page, limite, total) };
}

function instantaneArticle(a: ArticleStock): Record<string, unknown> {
  return {
    reference: a.reference,
    nom: a.name,
    statut: a.status,
    quantity: a.quantity,
    disponible: a.availableQty,
    affectee: a.allocatedQty,
    maintenance: a.maintenanceQty,
    seuilMinimum: a.minThreshold
  };
}

// Chantier 3.5 : les montants passent par Prisma.Decimal dès la frontière du
// service — plus aucun parseFloat (imprécision binaire) sur l'argent.
// Accepte « 1250 », « 1250,50 », « 1 250.00 MAD » ; refuse le reste (400).
function versMontant(valeur: unknown, libelle: string): Prisma.Decimal {
  const brut = String(valeur ?? "")
    .trim()
    .replace(/[\s']/g, "")
    .replace(",", ".")
    .replace(/MAD/i, "");
  if (brut === "") return new Prisma.Decimal(0);
  let montant: Prisma.Decimal;
  try {
    montant = new Prisma.Decimal(brut);
  } catch {
    throw requeteInvalide(`${libelle} invalide : « ${String(valeur)} » n'est pas un montant.`);
  }
  if (!montant.isFinite() || montant.isNegative()) {
    throw requeteInvalide(`${libelle} doit être un montant positif ou nul.`);
  }
  return montant.toDecimalPlaces(2);
}

// ── Création (transaction + audit) ────────────────────────────────────

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

export async function creerArticle(data: EntreeArticle, acteur?: ContexteActeur) {
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
  const seuil = parseInt(String(minThreshold)) || 2;
  if (qty <= 0) throw requeteInvalide("La quantité initiale doit être supérieure à zéro.");
  if (seuil < 0) throw requeteInvalide("Le seuil d'alerte ne peut pas être négatif.");
  const unitPrice = versMontant(unitPriceMAD, "Le prix unitaire");

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      await verrouillerReferences(tx);
      const numeros = await prochainsNumerosArticle(tx);

      const newItem = await tx.articleStock.create({
        data: {
          reference: numeros.reference,
          assetTag: numeros.assetTag,
          name,
          category,
          brand: brand || "Générique",
          model: model || "",
          serialNumber: serialNumber || referenceAleatoire("SN"),
          quantity: qty,
          availableQty: qty,
          allocatedQty: 0,
          maintenanceQty: 0,
          minThreshold: seuil,
          unitPriceMAD: unitPrice,
          totalValueMAD: unitPrice.times(qty),
          location: location || "Magasin Central IT (Casablanca)",
          status: status || STATUTS_MATERIEL.DISPONIBLE,
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
          performedBy: performedBy || acteur?.nomUtilisateur || "Administrateur Système",
          date: new Date(),
          notes: "Création et entrée initiale en stock."
        }
      });

      await journaliserDansTx(tx, {
        action: ACTIONS_AUDIT.STOCK_ITEM_CREATED,
        utilisateurId: acteur?.utilisateurId ?? null,
        adresseIp: acteur?.adresseIp ?? null,
        agentUtilisateur: acteur?.agentUtilisateur ?? null,
        entite: "ArticleStock",
        entiteId: newItem.id,
        details: { reference: newItem.reference, nom: name, quantiteInitiale: qty },
        valeursApres: instantaneArticle(newItem)
      });

      return newItem;
    });

    await verifierSeuilStock(resultat);

    return {
      status: 201 as const,
      message: "Article ajouté au stock IT avec succès.",
      data: resultat
    };
  } catch (erreur) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      throw conflit("Ce numéro de série est déjà utilisé par un autre article du stock.");
    }
    throw erreur;
  }
}

// ── Mise à jour (transaction + machine à états + audit) ───────────────

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

export async function modifierArticle(
  idOuReference: string,
  data: EntreeModificationArticle,
  acteur?: ContexteActeur
) {
  const avant = await verrouillerArticleHorsTx(idOuReference);

  try {
    const misAJour = await prisma.$transaction(async (tx) => {
      // Relecture sous verrou : la ligne est gelée jusqu'au commit.
      await tx.$queryRaw`SELECT id FROM articles_stock WHERE id = ${avant.id} FOR UPDATE`;
      const article = await tx.articleStock.findUniqueOrThrow({ where: { id: avant.id } });

      const donnees: Record<string, unknown> = {};
      for (const champ of ["name", "category", "brand", "model", "location", "notes"] as const) {
        const valeur = data[champ];
        if (valeur !== undefined) donnees[champ] = valeur;
      }
      if (data.serialNumber !== undefined && data.serialNumber !== "") {
        donnees["serialNumber"] = data.serialNumber;
      }
      if (data.warrantyExpiry !== undefined) {
        donnees["warrantyExpiry"] =
          data.warrantyExpiry === null ? null : new Date(`${data.warrantyExpiry}T12:00:00Z`);
      }
      if (data.minThreshold !== undefined) {
        const seuil = parseInt(String(data.minThreshold));
        if (!Number.isFinite(seuil) || seuil < 0) {
          throw requeteInvalide("Le seuil d'alerte doit être un entier positif ou nul.");
        }
        donnees["minThreshold"] = seuil;
      }

      // Changement de statut : uniquement via la machine à états.
      if (data.status !== undefined && data.status !== article.status) {
        donnees["status"] = exigerTransition(article.status, data.status);
      }

      // Quantité totale : les unités engagées (affectées + en maintenance)
      // fixent le plancher. Le compartiment disponible se recalcule pour
      // préserver l'invariant vérifié par la base.
      let quantite = article.quantity;
      if (data.quantity !== undefined) {
        const nouvelleQuantite = parseInt(String(data.quantity));
        if (!Number.isFinite(nouvelleQuantite) || nouvelleQuantite < 0) {
          throw requeteInvalide("La quantité doit être un entier positif ou nul.");
        }
        const engagees = article.allocatedQty + article.maintenanceQty;
        if (nouvelleQuantite < engagees) {
          throw requeteInvalide(
            `Quantité impossible : ${engagees} unité(s) sont actuellement affectées ou en maintenance. Le total ne peut pas descendre sous ce plancher.`
          );
        }
        quantite = nouvelleQuantite;
        donnees["quantity"] = nouvelleQuantite;
        donnees["availableQty"] = nouvelleQuantite - engagees;
      }

      let prixUnitaire = new Prisma.Decimal(article.unitPriceMAD);
      if (data.unitPriceMAD !== undefined) {
        prixUnitaire = versMontant(data.unitPriceMAD, "Le prix unitaire");
        donnees["unitPriceMAD"] = prixUnitaire;
      }
      donnees["totalValueMAD"] = prixUnitaire.times(quantite);

      const apres = await tx.articleStock.update({
        where: { id: article.id },
        data: donnees
      });

      await journaliserDansTx(tx, {
        action: ACTIONS_AUDIT.STOCK_ITEM_UPDATED,
        utilisateurId: acteur?.utilisateurId ?? null,
        adresseIp: acteur?.adresseIp ?? null,
        agentUtilisateur: acteur?.agentUtilisateur ?? null,
        entite: "ArticleStock",
        entiteId: article.id,
        details: { reference: article.reference, champs: Object.keys(donnees) },
        valeursAvant: instantaneArticle(article),
        valeursApres: instantaneArticle(apres)
      });

      return apres;
    });

    await verifierSeuilStock(misAJour);
    return { message: "Article de stock mis à jour.", data: misAJour };
  } catch (erreur) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      throw conflit("Ce numéro de série est déjà utilisé par un autre article du stock.");
    }
    throw erreur;
  }
}

// Résolution hors transaction pour pré-valider l'existence ; l'écriture
// réelle reprend le verrou dans sa transaction.
async function verrouillerArticleHorsTx(idOuReference: string): Promise<ArticleStock> {
  const article = await prisma.articleStock.findFirst({
    where: { OR: [{ id: idOuReference }, { reference: idOuReference }] }
  });
  if (!article) throw introuvable("Article de stock introuvable.");
  return article;
}

// ── Mouvements de stock (transactionnels + audit + notifications) ─────

// Chantier 3.5 (P2.7) : les libellés proviennent de la source unique
// lib/machine-etats.ts. Cet endpoint n'accepte que les mouvements SAISIS
// manuellement ; « Envoi Maintenance » et « Annulation Affectation » sont
// produits exclusivement par leurs flux métier (restitution, annulation).
const TYPES_MOUVEMENT_MANUELS: readonly TypeMouvement[] = [
  TYPES_MOUVEMENT.SORTIE_AFFECTATION,
  TYPES_MOUVEMENT.RETOUR_STOCK,
  TYPES_MOUVEMENT.ENTREE_ACHAT,
  TYPES_MOUVEMENT.MISE_AU_REBUT,
  TYPES_MOUVEMENT.AJUSTEMENT_INVENTAIRE
];

export interface EntreeMouvement {
  type?: string;
  quantity?: unknown;
  performedBy?: string;
  recipient?: string;
  department?: string;
  notes?: string;
}

export async function enregistrerMouvement(
  idOuReference: string,
  data: EntreeMouvement,
  acteur?: ContexteActeur
) {
  const { type, quantity, performedBy, recipient, department, notes } = data;
  if (!type || !TYPES_MOUVEMENT_MANUELS.includes(type as TypeMouvement)) {
    throw requeteInvalide(
      `Type de mouvement inconnu${type ? ` : « ${type} »` : ""}. Types acceptés ici : ${TYPES_MOUVEMENT_MANUELS.join(", ")}.`
    );
  }
  const qty = parseInt(String(quantity)) || 1;
  if (qty <= 0) throw requeteInvalide("La quantité du mouvement doit être supérieure à zéro.");
  const typeMouvement = type as TypeMouvement;

  const alertesAPublier: (() => Promise<void>)[] = [];

  const resultat = await prisma.$transaction(async (tx) => {
    await verrouillerReferences(tx);

    const item = await verrouillerArticle(tx, idOuReference);
    const avant = instantaneArticle(item);

    const prixUnitaire = new Prisma.Decimal(item.unitPriceMAD);
    let valeurTotale = new Prisma.Decimal(item.totalValueMAD);

    let actionAudit: string = ACTIONS_AUDIT.STOCK_ADJUSTMENT;

    switch (typeMouvement) {
      case "Sortie Affectation": {
        if (item.availableQty < qty) {
          throw stockIndisponible(
            `Quantité disponible insuffisante pour « ${item.name} » : ${item.availableQty} en stock, ${qty} demandée(s).`
          );
        }
        const disponibleApres = item.availableQty - qty;
        const statutCible =
          recipient && disponibleApres === 0 ? STATUTS_MATERIEL.AFFECTE : item.status;
        if (statutCible !== item.status) exigerTransition(item.status, statutCible);
        item.availableQty = disponibleApres;
        item.allocatedQty += qty;
        item.status = statutCible;
        if (recipient) {
          item.assignedTo = {
            userName: recipient,
            department: department || "Général",
            assignedDate: dateDuJour()
          };
        }
        break;
      }
      case "Retour Stock": {
        if (item.status === STATUTS_MATERIEL.MAINTENANCE) {
          // Retour de maintenance : le matériel redevient disponible.
          if (item.maintenanceQty < qty) {
            throw requeteInvalide(
              `Retour impossible : ${item.maintenanceQty} unité(s) seulement sont en maintenance pour « ${item.name} ».`
            );
          }
          item.maintenanceQty -= qty;
          item.availableQty += qty;
          item.status = exigerTransition(item.status, STATUTS_MATERIEL.DISPONIBLE);
          actionAudit = ACTIONS_AUDIT.MAINTENANCE_COMPLETED;
          const apresSeuil = { ...item };
          alertesAPublier.push(() =>
            notifier({
              type: TYPES_NOTIFICATION.MAINTENANCE_TERMINEE,
              titre: "Matériel prêt après maintenance",
              message: `« ${apresSeuil.name} » (${apresSeuil.reference}) est revenu de maintenance et redevient disponible (${apresSeuil.availableQty} unité(s)).`,
              entite: "ArticleStock",
              entiteId: apresSeuil.id,
              cibleOnglet: "stock"
            })
          );
        } else {
          // Chantier 3.5 : plus aucun écrêtage silencieux — réintégrer plus
          // d'unités qu'il n'y en a d'affectées est une erreur de saisie qui
          // doit être corrigée, pas masquée.
          if (qty > item.allocatedQty) {
            throw retourExcedent(
              `Retour impossible pour « ${item.name} » (${item.reference}) : ${qty} unité(s) à réintégrer mais seulement ${item.allocatedQty} affectée(s). Corrigez la quantité ou passez par un ajustement d'inventaire.`
            );
          }
          item.allocatedQty -= qty;
          item.availableQty += qty;
          if (item.allocatedQty === 0) item.assignedTo = null;
          if (item.status !== STATUTS_MATERIEL.DISPONIBLE && item.allocatedQty === 0) {
            item.status = exigerTransition(item.status, STATUTS_MATERIEL.DISPONIBLE);
          }
        }
        break;
      }
      case "Entrée Achat": {
        item.quantity += qty;
        item.availableQty += qty;
        valeurTotale = prixUnitaire.times(item.quantity);
        actionAudit = ACTIONS_AUDIT.STOCK_ENTRY;
        break;
      }
      case "Mise au Rebut": {
        const prelevable = item.availableQty + item.maintenanceQty;
        if (prelevable < qty) {
          throw stockIndisponible(
            `Mise au rebut impossible : ${qty} demandée(s), seulement ${prelevable} unité(s) non engagées (disponibles ou en maintenance) pour « ${item.name} ».`
          );
        }
        const depuisDisponible = Math.min(qty, item.availableQty);
        const depuisMaintenance = qty - depuisDisponible;
        item.availableQty -= depuisDisponible;
        item.maintenanceQty -= depuisMaintenance;
        item.quantity = Math.max(0, item.quantity - qty);
        valeurTotale = prixUnitaire.times(item.quantity);
        if (item.quantity === 0) {
          item.status = exigerTransition(item.status, STATUTS_MATERIEL.REFORME);
          actionAudit = ACTIONS_AUDIT.ITEM_RETIRED;
        }
        break;
      }
      case "Ajustement Inventaire": {
        const engagees = item.allocatedQty + item.maintenanceQty;
        if (qty < engagees) {
          throw requeteInvalide(
            `Ajustement impossible : l'inventaire compte ${engagees} unité(s) affectées ou en maintenance. Le comptage ne peut pas être inférieur.`
          );
        }
        item.quantity = qty;
        item.availableQty = qty - engagees;
        valeurTotale = prixUnitaire.times(item.quantity);
        break;
      }
    }

    const misAJour = await tx.articleStock.update({
      where: { id: item.id },
      data: {
        availableQty: item.availableQty,
        allocatedQty: item.allocatedQty,
        maintenanceQty: item.maintenanceQty,
        quantity: item.quantity,
        totalValueMAD: valeurTotale,
        status: item.status,
        assignedTo:
          item.assignedTo === null
            ? Prisma.DbNull
            : (item.assignedTo as Prisma.InputJsonValue)
      }
    });

    const mouvement = await tx.mouvementStock.create({
      data: {
        reference: await nouvelleReferenceMouvement(tx),
        stockItemId: item.id,
        itemName: item.name,
        type: typeMouvement,
        quantity: qty,
        performedBy: performedBy || acteur?.nomUtilisateur || "Responsable Stock IT",
        recipient: recipient || null,
        department: department || null,
        date: new Date(),
        notes: notes || ""
      }
    });

    await journaliserDansTx(tx, {
      action: actionAudit,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "ArticleStock",
      entiteId: item.id,
      details: {
        reference: item.reference,
        mouvement: mouvement.reference,
        type: typeMouvement,
        quantite: qty,
        destinataire: recipient ?? null
      },
      valeursAvant: avant,
      valeursApres: instantaneArticle(misAJour)
    });

    return { item: misAJour, mouvement };
  });

  for (const publier of alertesAPublier) await publier();
  await verifierSeuilStock(resultat.item);

  return {
    message: `Mouvement de stock "${type}" enregistré.`,
    data: resultat
  };
}

// ── Suppression logique (jamais si du matériel est engagé) ────────────

export async function supprimerArticle(
  idOuReference: string,
  acteur?: ContexteActeur
) {
  const article = await verrouillerArticleHorsTx(idOuReference);
  if (article.supprimeLe) {
    return { message: "Article supprimé du stock IT." };
  }
  const engagees = article.allocatedQty + article.maintenanceQty;
  if (engagees > 0) {
    throw requeteInvalide(
      `Suppression impossible : ${article.allocatedQty} unité(s) affectée(s) et ${article.maintenanceQty} en maintenance. Effectuez les restitutions et retours avant de retirer cet article.`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.articleStock.update({
      where: { id: article.id },
      data: { supprimeLe: new Date(), status: STATUTS_MATERIEL.SUPPRIME }
    });
    await journaliserDansTx(tx, {
      action: ACTIONS_AUDIT.STOCK_ITEM_UPDATED,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "ArticleStock",
      entiteId: article.id,
      details: { reference: article.reference, suppressionLogique: true },
      valeursAvant: instantaneArticle(article),
      valeursApres: { ...instantaneArticle(article), statut: STATUTS_MATERIEL.SUPPRIME }
    });
  });

  return { message: "Article supprimé du stock IT." };
}
