import { Prisma } from "@prisma/client";
import { prisma, verrouillerReferences, type Tx } from "../lib/prisma.js";
import {
  introuvable,
  requeteInvalide,
  stockIndisponible,
  dejaAffecte,
  retourDejaEffectue,
  transitionInvalide,
  ErreurMetier
} from "../lib/erreurs.js";
import { dateDuJour, prochainNumero, pad3, versDate, referenceAleatoire } from "../lib/ids.js";
import { nouvelleReferenceMouvement } from "./stock.service.js";
import { journaliserDansTx, ACTIONS_AUDIT } from "../lib/journal-audit.js";
import {
  exigerTransition,
  STATUTS_MATERIEL,
  STATUTS_AFFECTATION,
  ETATS_MATERIEL_CONSTATES,
  LISTE_ETATS_CONSTATES,
  estEtatDegrade,
  type EtatMaterielConstate
} from "../lib/machine-etats.js";
import { chiffrer, dechiffrer } from "../lib/chiffrement.js";
import { notifier, verifierSeuilStock, TYPES_NOTIFICATION } from "../lib/notifications.js";
import type { ContexteActeur } from "../lib/acteur.js";

// ── Lectures ──────────────────────────────────────────────────────────

// Chantier 3.5 (P1.4) : PIN/PUK chiffrés au repos ne sortent JAMAIS dans
// les listes ni dans la réponse de création ; leur consultation passe par
// l'endpoint dédié (`revelerCodesConfidentiels`), réservé à la permission
// « affectations.confidentiels » et tracé dans le journal d'audit.
function masquerSecrets<T>(fiche: T): T {
  const copie = { ...fiche } as Record<string, unknown>;
  delete copie["simPin"];
  delete copie["simPuk"];
  return copie as T;
}

export async function listerAffectations() {
  const fiches = await prisma.affectation.findMany({
    orderBy: { creeLe: "desc" },
    include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
  });
  return fiches.map(masquerSecrets);
}

// ── Création d'une affectation (atomique) ─────────────────────────────

export interface LigneAffectationEntree {
  stockItemId?: string;
  assetTag?: string;
  serialNumber?: string;
  specs?: unknown;
  condition?: string;
  accessories?: string[];
}

export interface EntreeAffectation {
  templateType?: string;
  formCode?: string;
  beneficiaryName?: string;
  beneficiaryEmail?: string;
  beneficiaryPhone?: string;
  beneficiaryCin?: string;
  beneficiaryJobTitle?: string;
  beneficiaryDepartment?: string;
  beneficiarySite?: string;
  assignedDate?: string;
  authorizedBy?: string;
  dsiTitle?: string;
  resourceType?: string;
  hasSimCard?: boolean;
  simOperator?: string;
  simPhoneNumber?: string;
  simPuk?: string;
  simPin?: string;
  hasSmartphone?: boolean;
  deviceBrand?: string;
  deviceImei?: string;
  deviceModel?: string;
  deviceConfiguration?: string;
  operationType?: string;
  restitutionPreviousDevice?: string;
  restitutedDeviceCondition?: string;
  incidentRemarks?: string;
  items?: LigneAffectationEntree[];
  notes?: string;
  /** Réaffectation : référence/id de la fiche restituée qui précède. */
  reaffecteApresId?: string;
}

interface LigneConstruite {
  stockItemId: string;
  assetTag: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  category: string;
  specs?: unknown;
  condition: string;
  accessories: string[];
}

interface EtatArticleApres {
  id: string;
  reference: string;
  nom: string;
  disponible: number;
  affectee: number;
  maintenance: number;
}

// Génère la référence métier AFF-DSI-AAAA-NNN depuis le compteur
// transactionnel de l'année (`affectation-AAAA`, amorcé par la migration).
// La séquence repart à 001 chaque 1er janvier ; l'unicité ne dépend plus
// d'aucun scan ni verrou consultatif (chantier 3.5).
async function prochaineReference(tx: Tx): Promise<string> {
  const annee = new Date().getFullYear();
  const numero = await prochainNumero(tx, `affectation-${annee}`);
  return `AFF-DSI-${annee}-${pad3(numero)}`;
}

export async function creerAffectation(data: EntreeAffectation, acteur?: ContexteActeur) {
  const {
    templateType,
    formCode,
    beneficiaryName,
    beneficiaryEmail,
    beneficiaryPhone,
    beneficiaryCin,
    beneficiaryJobTitle,
    beneficiaryDepartment,
    beneficiarySite,
    assignedDate,
    authorizedBy,
    dsiTitle,
    resourceType,
    hasSimCard,
    simOperator,
    simPhoneNumber,
    simPuk,
    simPin,
    hasSmartphone,
    deviceBrand,
    deviceImei,
    deviceModel,
    deviceConfiguration,
    operationType,
    restitutionPreviousDevice,
    restitutedDeviceCondition,
    incidentRemarks,
    items,
    notes,
    reaffecteApresId
  } = data;

  if (!beneficiaryName || !beneficiaryDepartment) {
    throw requeteInvalide(
      "Veuillez renseigner le nom du bénéficiaire et son département."
    );
  }

  const dateAffectation = versDate(assignedDate) ?? new Date();

  // Identifiants d'articles visés (« STK-DIRECT » = saisie directe SIM, hors stock).
  const identifiantsVises = new Set<string>();
  for (const item of Array.isArray(items) ? items : []) {
    const sid = item?.stockItemId;
    if (sid && sid !== "STK-DIRECT") identifiantsVises.add(sid);
  }

  const nouvelle = await prisma.$transaction(async (tx) => {
    await verrouillerReferences(tx);

    // Lien de réaffectation vérifié AVANT toute écriture.
    let referencePrecedente: string | null = null;
    if (reaffecteApresId) {
      const precedente = await tx.affectation.findFirst({
        where: { OR: [{ id: reaffecteApresId }, { reference: reaffecteApresId }] },
        select: { id: true, reference: true, status: true }
      });
      if (!precedente) {
        throw introuvable("Fiche précédente introuvable pour la réaffectation.");
      }
      if (precedente.status !== STATUTS_AFFECTATION.RESTITUEE) {
        throw requeteInvalide(
          "Une réaffectation suppose que la fiche précédente a été restituée."
        );
      }
      referencePrecedente = precedente.reference;
    }

    const reference = await prochaineReference(tx);

    // Résolution identifiant → UUID, puis verrouillage pessimiste des lignes
    // articles (SELECT … FOR UPDATE) : deux affectations concurrentes visant
    // le même article se sérialisent ici, avant toute lecture de quantité.
    const resolution = new Map<string, string>();
    for (const identifiant of identifiantsVises) {
      const trouve = await tx.articleStock.findFirst({
        where: { OR: [{ id: identifiant }, { reference: identifiant }] },
        select: { id: true }
      });
      if (!trouve) {
        throw introuvable(`Article en stock introuvable : ${identifiant}`);
      }
      resolution.set(identifiant, trouve.id);
    }
    const idsVerrou = [...new Set(resolution.values())];
    if (idsVerrou.length > 0) {
      await tx.$queryRaw`SELECT id FROM articles_stock WHERE id IN (${Prisma.join(idsVerrou)}) FOR UPDATE`;
    }

    // Relecture POST-verrouillage : seule source de vérité des quantités.
    // Un article archivé (soft delete) sort du findMany → refus ci-dessous.
    const articlesVerrouilles =
      idsVerrou.length > 0
        ? await tx.articleStock.findMany({ where: { id: { in: idsVerrou } } })
        : [];
    const articleParId = new Map(articlesVerrouilles.map((a) => [a.id, a]));

    // Besoin agrégé : le même article peut figurer sur plusieurs lignes.
    const besoin = new Map<string, number>();
    for (const idArticle of resolution.values()) {
      besoin.set(idArticle, (besoin.get(idArticle) ?? 0) + 1);
    }

    for (const [idArticle, nombre] of besoin) {
      const article = articleParId.get(idArticle);
      if (!article) {
        throw introuvable("Un des articles visés n'existe plus dans le stock.");
      }
      if (
        article.status !== STATUTS_MATERIEL.DISPONIBLE &&
        article.status !== STATUTS_MATERIEL.AFFECTE
      ) {
        throw transitionInvalide(
          `Le matériel « ${article.name} » (${article.reference}) est « ${article.status} » : il ne peut pas être affecté en l'état.`
        );
      }
      if (article.availableQty < nombre) {
        if (article.availableQty <= 0 && article.allocatedQty > 0) {
          throw dejaAffecte(
            `Le matériel « ${article.name} » (${article.reference}) est entièrement affecté : aucune unité disponible.`
          );
        }
        throw stockIndisponible(
          `Stock insuffisant pour « ${article.name} » (${article.reference}) : ${article.availableQty} disponible(s), ${nombre} demandé(s).`
        );
      }
    }

    // Écritures : décrément, mouvement et lignes partagent la transaction.
    const lignesConstruites: LigneConstruite[] = [];
    const etatsApres: EtatArticleApres[] = [];
    // Disponibilité locale décroissante quand plusieurs lignes visent le
    // même article dans une seule demande.
    const disponibleLocal = new Map<string, number>();
    for (const idArticle of besoin.keys()) {
      disponibleLocal.set(idArticle, articleParId.get(idArticle)!.availableQty);
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const itemInput of items) {
        const sid = itemInput.stockItemId;
        if (!sid || sid === "STK-DIRECT") continue;
        const idArticle = resolution.get(sid)!;
        const stockItem = articleParId.get(idArticle)!;
        const restant = disponibleLocal.get(idArticle)!;

        const nouveauDisponible = restant - 1;
        const nouveauStatut =
          nouveauDisponible === 0 ? STATUTS_MATERIEL.AFFECTE : stockItem.status;
        exigerTransition(stockItem.status, nouveauStatut);

        await tx.articleStock.update({
          where: { id: stockItem.id },
          data: {
            availableQty: { decrement: 1 },
            allocatedQty: { increment: 1 },
            status: nouveauStatut,
            assignedTo: {
              userName: beneficiaryName,
              department: beneficiaryDepartment,
              assignedDate: dateDuJour()
            }
          }
        });
        disponibleLocal.set(idArticle, nouveauDisponible);

        lignesConstruites.push({
          stockItemId: stockItem.id,
          assetTag: stockItem.assetTag || itemInput.assetTag || `IT-${stockItem.reference}`,
          name: stockItem.name,
          brand: stockItem.brand,
          model: stockItem.model,
          serialNumber:
            stockItem.serialNumber || itemInput.serialNumber || "SN-STANDARD",
          category: stockItem.category,
          specs: itemInput.specs ?? stockItem.specs ?? undefined,
          condition: itemInput.condition || "Neuf / Excellent état",
          accessories: itemInput.accessories || [
            "Chargeur secteur",
            "Câble d'alimentation"
          ]
        });

        await tx.mouvementStock.create({
          data: {
            reference: await nouvelleReferenceMouvement(tx),
            stockItemId: stockItem.id,
            itemName: stockItem.name,
            type: "Sortie Affectation",
            quantity: 1,
            performedBy: authorizedBy || acteur?.nomUtilisateur || "Département Systèmes d'Information",
            recipient: beneficiaryName,
            department: beneficiaryDepartment,
            date: dateAffectation,
            notes: `Affectation matérielle (${reference}) - ${beneficiaryJobTitle || "Collaborateur"}`
          }
        });

        etatsApres.push({
          id: stockItem.id,
          reference: stockItem.reference,
          nom: stockItem.name,
          disponible: nouveauDisponible,
          affectee: stockItem.allocatedQty + 1,
          maintenance: stockItem.maintenanceQty
        });
      }
    } else if (hasSmartphone === true || resourceType?.includes("SmartPhone")) {
      // Saisie directe SIM / Smartphone sans sélection d'article en stock
      lignesConstruites.push({
        stockItemId: "STK-DIRECT",
        assetTag: referenceAleatoire("IT-TEL", 3),
        name: `${deviceBrand || "Smartphone"} ${deviceModel || ""}`.trim(),
        brand: deviceBrand || "Générique",
        model: deviceModel || "",
        serialNumber: deviceImei || referenceAleatoire("SN"),
        category: "Périphériques & Accessoires",
        condition: "Neuf / Excellent état",
        accessories: ["Chargeur secteur", "Câble USB"]
      });
    }

    const nouvelleFiche = await tx.affectation.create({
      data: {
        reference,
        templateType:
          templateType ||
          (resourceType?.includes("SIM") || resourceType?.includes("SmartPhone")
            ? "DISTRA_SIM_SMARTPHONE"
            : "STANDARD_DSI_EQUIPMENT"),
        formCode: formCode || "IT-02",
        beneficiaryName,
        beneficiaryEmail: beneficiaryEmail || "",
        beneficiaryPhone: beneficiaryPhone || simPhoneNumber || "",
        beneficiaryCin: beneficiaryCin || "",
        beneficiaryJobTitle: beneficiaryJobTitle || "Collaborateur",
        beneficiaryDepartment,
        beneficiarySite: beneficiarySite || "Berrechid",
        assignedDate: dateAffectation,
        status: STATUTS_AFFECTATION.ACTIVE,
        authorizedBy: authorizedBy || "Directeur Systèmes d'Information",
        dsiTitle: dsiTitle || "Département Systèmes D'Information",

        resourceType: resourceType || "Carte SIM + SmartPhone",
        hasSimCard: hasSimCard === true || Boolean(resourceType?.includes("SIM")),
        simOperator: simOperator || "IAM",
        simPhoneNumber: simPhoneNumber || beneficiaryPhone || "",
        // Chantier 3.5 (P1.4) : les secrets partent chiffrés en base ;
        // chaîne vide ou absente → NULL.
        simPuk: chiffrer(simPuk || "") ?? "",
        simPin: chiffrer(simPin || "") ?? "",
        hasSmartphone:
          hasSmartphone === true || Boolean(resourceType?.includes("SmartPhone")),
        deviceBrand: deviceBrand || lignesConstruites[0]?.brand || "",
        deviceImei: deviceImei || lignesConstruites[0]?.serialNumber || "",
        deviceModel: deviceModel || lignesConstruites[0]?.model || "",
        deviceConfiguration: deviceConfiguration || "",
        operationType: operationType || "AFFECTATION",
        restitutionPreviousDevice: restitutionPreviousDevice || "NON",
        restitutedDeviceCondition: restitutedDeviceCondition || "Non applicable",
        incidentRemarks: incidentRemarks || "INCIDENT / PANNE",

        termsAccepted: true,
        notes: notes || "Fiche de décharge SIM & Smartphone conforme.",

        items: {
          create: lignesConstruites.map((l) => ({
            stockItemId: l.stockItemId,
            assetTag: l.assetTag,
            name: l.name,
            brand: l.brand,
            model: l.model,
            serialNumber: l.serialNumber,
            category: l.category,
            condition: l.condition,
            accessories: l.accessories,
            specs: l.specs === undefined ? undefined : (l.specs as object)
          }))
        }
      },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    });

    // Audit DANS la transaction (AGENTS.md règle 2) : un échec d'audit
    // annule l'affectation entière.
    await journaliserDansTx(tx, {
      action: referencePrecedente
        ? ACTIONS_AUDIT.REASSIGNMENT_CREATED
        : ACTIONS_AUDIT.ASSIGNMENT_CREATED,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "Affectation",
      entiteId: nouvelleFiche.id,
      details: {
        reference: nouvelleFiche.reference,
        beneficiaire: beneficiaryName,
        departement: beneficiaryDepartment,
        articles: etatsApres.map((e) => `${e.reference} (${e.nom})`),
        reaffecteApres: referencePrecedente
      },
      valeursApres: { statut: STATUTS_AFFECTATION.ACTIVE, articles: etatsApres }
    });

    return { fiche: masquerSecrets(nouvelleFiche), etatsApres };
  });

  // Notifications APRÈS commit : alerter ne doit jamais annuler l'opération.
  for (const etat of nouvelle.etatsApres) {
    await verifierSeuilStock({
      id: etat.id,
      name: etat.nom,
      reference: etat.reference,
      availableQty: etat.disponible,
      minThreshold:
        (
          await prisma.articleStock.findUnique({
            where: { id: etat.id },
            select: { minThreshold: true }
          })
        )?.minThreshold ?? 0
    });
  }

  return {
    status: 201 as const,
    message: `Fiche d'affectation ${nouvelle.fiche.reference} générée avec succès pour ${beneficiaryName}.`,
    data: nouvelle.fiche
  };
}

// ── Restitution (transactionnelle) ────────────────────────────────────

export interface EntreeRetour {
  returnDate?: string;
  cause?: string;
  customCause?: string;
  equipmentCondition?: string;
  accessoriesReturned?: string[];
  missingAccessories?: string[];
  dataWiped?: boolean;
  bitlockerUnlocked?: boolean;
  technicalDiagnosis?: string;
  actionTaken?: string;
  inspectedBy?: string;
  notes?: string;
}

const ACTIONS_RESTITUTION = [
  "Remise en stock disponible",
  "Envoi en maintenance / SAV",
  "Mise au rebut"
] as const;

// Un matériel constaté défectueux ne doit JAMAIS redevenir disponible
// automatiquement (demande chantier 3, point 5) : la remise en stock est
// forcée vers la maintenance.
// Chantier 3.5 (P2.9) : l'état constaté devient une LISTE FERMÉE
// (ETATS_MATERIEL_CONSTATES) validée à la frontière — la décision critique
// ne repose plus sur une regex devinant l'intention dans du texte libre.
function normaliserEtatConstat(brut?: string | null): EtatMaterielConstate {
  const valeur = (brut ?? "").trim();
  if (valeur === "") return ETATS_MATERIEL_CONSTATES.BON_ETAT;
  if ((LISTE_ETATS_CONSTATES as readonly string[]).includes(valeur)) {
    return valeur as EtatMaterielConstate;
  }
  throw requeteInvalide(
    `État du matériel inconnu : « ${valeur} ». États acceptés : ${LISTE_ETATS_CONSTATES.join(", ")}.`
  );
}

export async function restituerAffectation(
  idOuReference: string,
  data: EntreeRetour,
  acteur?: ContexteActeur
) {
  const {
    returnDate,
    cause,
    customCause,
    equipmentCondition,
    accessoriesReturned,
    missingAccessories,
    dataWiped,
    bitlockerUnlocked,
    technicalDiagnosis,
    actionTaken,
    inspectedBy,
    notes
  } = data;

  const dateRetour = versDate(returnDate) ?? new Date();
  const actionNormale = actionTaken || "Remise en stock disponible";
  if (!(ACTIONS_RESTITUTION as readonly string[]).includes(actionNormale)) {
    throw requeteInvalide(
      `Action de restitution inconnue : « ${actionNormale} ». Actions acceptées : ${ACTIONS_RESTITUTION.join(", ")}.`
    );
  }
  const etatConstate = normaliserEtatConstat(equipmentCondition);
  const etatDegrade = estEtatDegrade(etatConstate);

  const alertesAPublier: (() => Promise<void>)[] = [];

  const resultat = await prisma.$transaction(async (tx) => {
    await verrouillerReferences(tx);

    // Verrou sur la fiche : deux restitutions simultanées se sérialisent ;
    // la seconde voit le statut déjà « Restitué » et échoue proprement.
    const existante = await tx.affectation.findFirst({
      where: { OR: [{ id: idOuReference }, { reference: idOuReference }] },
      select: { id: true }
    });
    if (!existante) throw introuvable("Fiche d'affectation introuvable.");
    await tx.$queryRaw`SELECT id FROM affectations WHERE id = ${existante.id} FOR UPDATE`;

    const affectation = await tx.affectation.findUnique({
      where: { id: existante.id },
      include: { items: { orderBy: { id: "asc" } } }
    });
    if (!affectation) throw introuvable("Fiche d'affectation introuvable.");
    if (affectation.status !== STATUTS_AFFECTATION.ACTIVE) {
      throw retourDejaEffectue(
        `L'affectation ${affectation.reference} est déjà clôturée (statut : « ${affectation.status} ») : une seconde restitution est impossible.`
      );
    }

    const retour = await tx.retourAffectation.create({
      data: {
        assignmentId: affectation.id,
        returnDate: dateRetour,
        cause: cause || "Départ collaborateur (Fin de contrat / Démission)",
        customCause: customCause || "",
        equipmentCondition: etatConstate,
        accessoriesReturned: accessoriesReturned || [],
        missingAccessories: missingAccessories || [],
        dataWiped: dataWiped === true,
        bitlockerUnlocked: bitlockerUnlocked === true,
        technicalDiagnosis: technicalDiagnosis || "Matériel inspecté et vérifié conforme.",
        actionTaken: actionNormale,
        inspectedBy: inspectedBy || "Service Informatique",
        notes: notes || ""
      }
    });

    await tx.affectation.update({
      where: { id: affectation.id },
      data: { status: STATUTS_AFFECTATION.RESTITUEE }
    });

    // Verrouillage groupé des articles portés par les lignes.
    const idsArticles = [
      ...new Set(
        affectation.items
          .filter((l) => l.stockItemId && l.stockItemId !== "STK-DIRECT")
          .map((l) => l.stockItemId as string)
      )
    ];
    if (idsArticles.length > 0) {
      await tx.$queryRaw`SELECT id FROM articles_stock WHERE id IN (${Prisma.join(idsArticles)}) FOR UPDATE`;
    }

    const resumeArticles: Record<string, unknown>[] = [];

    for (const ligne of affectation.items) {
      if (!ligne.stockItemId || ligne.stockItemId === "STK-DIRECT") continue;
      const stockItem = await tx.articleStock.findUnique({
        where: { id: ligne.stockItemId }
      });
      if (!stockItem) continue;

      // Décision finale : un matériel dégradé n'est jamais remis disponible.
      const actionFinale =
        etatDegrade && actionNormale === "Remise en stock disponible"
          ? "MAINTENANCE_OBLIGATOIRE"
          : actionNormale;

      let donnees: Record<string, unknown>;
      let statutCible: string;
      let typeMouvement: string;

      if (actionFinale === "Remise en stock disponible") {
        statutCible = STATUTS_MATERIEL.DISPONIBLE;
        typeMouvement = "Retour Stock";
        donnees = {
          status: statutCible,
          allocatedQty: Math.max(0, stockItem.allocatedQty - 1),
          availableQty: stockItem.availableQty + 1,
          assignedTo: null
        };
        const apres = { ...stockItem, ...donnees } as typeof stockItem;
        alertesAPublier.push(() =>
          verifierSeuilStock({
            id: apres.id,
            name: apres.name,
            reference: apres.reference,
            availableQty: apres.availableQty,
            minThreshold: apres.minThreshold
          })
        );
      } else if (
        actionFinale === "MAINTENANCE_OBLIGATOIRE" ||
        actionFinale === "Envoi en maintenance / SAV"
      ) {
        statutCible = STATUTS_MATERIEL.MAINTENANCE;
        typeMouvement = "Envoi Maintenance";
        donnees = {
          status: statutCible,
          allocatedQty: Math.max(0, stockItem.allocatedQty - 1),
          maintenanceQty: stockItem.maintenanceQty + 1,
          assignedTo: null
        };
        alertesAPublier.push(() =>
          notifier({
            type:
              actionFinale === "MAINTENANCE_OBLIGATOIRE"
                ? TYPES_NOTIFICATION.MATERIEL_ENDOMMAGE
                : TYPES_NOTIFICATION.MAINTENANCE_DEMARREE,
            titre:
              actionFinale === "MAINTENANCE_OBLIGATOIRE"
                ? "Matériel retourné en mauvais état"
                : "Matériel envoyé en maintenance",
            message:
              actionFinale === "MAINTENANCE_OBLIGATOIRE"
                ? `« ${stockItem.name} » (${stockItem.reference}) a été restitué en mauvais état (${etatConstate}). Il part en maintenance et ne redevient PAS disponible automatiquement.`
                : `« ${stockItem.name} » (${stockItem.reference}) est parti en maintenance/SAV suite à la restitution ${affectation.reference}.`,
            entite: "ArticleStock",
            entiteId: stockItem.id,
            cibleOnglet: "stock"
          })
        );
      } else {
        // Mise au rebut
        statutCible = STATUTS_MATERIEL.REFORME;
        typeMouvement = "Mise au Rebut";
        donnees = {
          status: statutCible,
          allocatedQty: Math.max(0, stockItem.allocatedQty - 1),
          quantity: Math.max(0, stockItem.quantity - 1),
          assignedTo: null
        };
      }

      exigerTransition(stockItem.status, statutCible);
      await tx.articleStock.update({ where: { id: stockItem.id }, data: donnees });

      if (statutCible === STATUTS_MATERIEL.REFORME) {
        await journaliserDansTx(tx, {
          action: ACTIONS_AUDIT.ITEM_RETIRED,
          utilisateurId: acteur?.utilisateurId ?? null,
          adresseIp: acteur?.adresseIp ?? null,
          agentUtilisateur: acteur?.agentUtilisateur ?? null,
          entite: "ArticleStock",
          entiteId: stockItem.id,
          details: {
            reference: stockItem.reference,
            nom: stockItem.name,
            motif: `Rebut lors de la restitution ${affectation.reference}`,
            etatConstate: etatConstate
          },
          valeursAvant: { statut: stockItem.status, quantity: stockItem.quantity },
          valeursApres: { statut: statutCible, quantity: (donnees["quantity"] as number) ?? stockItem.quantity }
        });
      }

      await tx.mouvementStock.create({
        data: {
          reference: await nouvelleReferenceMouvement(tx),
          stockItemId: stockItem.id,
          itemName: stockItem.name,
          type: typeMouvement,
          quantity: 1,
          performedBy: inspectedBy || acteur?.nomUtilisateur || "Service Informatique",
          recipient: "Magasin Central IT",
          department: affectation.beneficiaryDepartment,
          date: dateRetour,
          notes: `Restitution (${cause}) - État: ${etatConstate}. ${actionNormale}.`
        }
      });

      resumeArticles.push({
        reference: stockItem.reference,
        nom: stockItem.name,
        statutAvant: stockItem.status,
        statutApres: statutCible
      });
    }

    const assignmentMisAJour = await tx.affectation.findUnique({
      where: { id: affectation.id },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    });

    await journaliserDansTx(tx, {
      action: ACTIONS_AUDIT.RETURN_CREATED,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "Affectation",
      entiteId: affectation.id,
      details: {
        reference: affectation.reference,
        beneficiaire: affectation.beneficiaryName,
        cause: retour.cause,
        etatConstate: retour.equipmentCondition,
        etatConstateBrut: equipmentCondition ?? null,
        action: actionNormale,
        etatDegradeDetecte: etatDegrade,
        articles: resumeArticles
      },
      valeursAvant: { statut: STATUTS_AFFECTATION.ACTIVE },
      valeursApres: { statut: STATUTS_AFFECTATION.RESTITUEE, articles: resumeArticles }
    });

    return { assignment: assignmentMisAJour!, retour };
  });

  for (const publier of alertesAPublier) await publier();

  return {
    message: `Restitution de matériel enregistrée avec succès pour l'affectation ${resultat.assignment.reference}.`,
    data: {
      assignment: resultat.assignment,
      returnRecord: resultat.retour
    }
  };
}

// ── Annulation d'une affectation active ───────────────────────────────
// Remplace l'ancienne suppression physique : l'historique ne se supprime
// pas (AGENTS.md règle 3). Une fiche active est ANNULÉE — son matériel
// réintègre le stock disponible dans la même transaction — et la fiche
// reste consultable avec le statut « Annulée ». Les fiches restituées ne
// sont ni modifiables ni supprimables.

export async function annulerAffectation(
  idOuReference: string,
  acteur?: ContexteActeur
) {
  const resultat = await prisma.$transaction(async (tx) => {
    await verrouillerReferences(tx);

    const existante = await tx.affectation.findFirst({
      where: { OR: [{ id: idOuReference }, { reference: idOuReference }] },
      select: { id: true }
    });
    if (!existante) throw introuvable("Affectation introuvable.");
    await tx.$queryRaw`SELECT id FROM affectations WHERE id = ${existante.id} FOR UPDATE`;

    const affectation = await tx.affectation.findUnique({
      where: { id: existante.id },
      include: { items: true }
    });
    if (!affectation) throw introuvable("Affectation introuvable.");
    if (affectation.status !== STATUTS_AFFECTATION.ACTIVE) {
      throw requeteInvalide(
        `Seule une fiche ACTIVE peut être annulée. La fiche ${affectation.reference} est « ${affectation.status} » : elle relève de l'historique, qui ne se modifie ni ne se supprime.`
      );
    }

    const idsArticles = [
      ...new Set(
        affectation.items
          .filter((l) => l.stockItemId && l.stockItemId !== "STK-DIRECT")
          .map((l) => l.stockItemId as string)
      )
    ];
    if (idsArticles.length > 0) {
      await tx.$queryRaw`SELECT id FROM articles_stock WHERE id IN (${Prisma.join(idsArticles)}) FOR UPDATE`;
    }

    const alertesAPublier: (() => Promise<void>)[] = [];

    for (const ligne of affectation.items) {
      if (!ligne.stockItemId || ligne.stockItemId === "STK-DIRECT") continue;
      const stockItem = await tx.articleStock.findUnique({
        where: { id: ligne.stockItemId }
      });
      if (!stockItem) continue;

      const nouveauStatut =
        stockItem.allocatedQty - 1 === 0 && stockItem.maintenanceQty === 0
          ? STATUTS_MATERIEL.DISPONIBLE
          : stockItem.status === STATUTS_MATERIEL.AFFECTE
            ? STATUTS_MATERIEL.DISPONIBLE
            : stockItem.status;
      exigerTransition(stockItem.status, nouveauStatut);

      await tx.articleStock.update({
        where: { id: stockItem.id },
        data: {
          allocatedQty: { decrement: 1 },
          availableQty: { increment: 1 },
          status: nouveauStatut,
          assignedTo: stockItem.allocatedQty - 1 === 0 ? Prisma.DbNull : undefined
        }
      });

      await tx.mouvementStock.create({
        data: {
          reference: await nouvelleReferenceMouvement(tx),
          stockItemId: stockItem.id,
          itemName: stockItem.name,
          type: "Annulation Affectation",
          quantity: 1,
          performedBy: acteur?.nomUtilisateur || "Service Informatique",
          recipient: "Magasin Central IT",
          department: affectation.beneficiaryDepartment,
          date: new Date(),
          notes: `Annulation de l'affectation ${affectation.reference} — matériel réintégré au stock disponible.`
        }
      });

      const disponibleApres = stockItem.availableQty + 1;
      alertesAPublier.push(() =>
        verifierSeuilStock({
          id: stockItem.id,
          name: stockItem.name,
          reference: stockItem.reference,
          availableQty: disponibleApres,
          minThreshold: stockItem.minThreshold
        })
      );
    }

    await tx.affectation.update({
      where: { id: affectation.id },
      data: { status: STATUTS_AFFECTATION.ANNULEE }
    });

    await journaliserDansTx(tx, {
      action: ACTIONS_AUDIT.ASSIGNMENT_CANCELLED,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "Affectation",
      entiteId: affectation.id,
      details: {
        reference: affectation.reference,
        beneficiaire: affectation.beneficiaryName,
        articles: affectation.items.map((l) => l.assetTag || l.name)
      },
      valeursAvant: { statut: STATUTS_AFFECTATION.ACTIVE },
      valeursApres: { statut: STATUTS_AFFECTATION.ANNULEE }
    });

    return { reference: affectation.reference, alertesAPublier };
  });

  for (const publier of resultat.alertesAPublier) await publier();

  return {
    message: `Affectation ${resultat.reference} annulée : le matériel est revenu au stock disponible. La fiche est conservée dans l'historique.`,
    data: { reference: resultat.reference, statut: STATUTS_AFFECTATION.ANNULEE }
  };
}

// ── Consultation des codes confidentiels (PIN/PUK) ────────────────────
// Chantier 3.5 (P1.4) : révélation explicite, permission
// « affectations.confidentiels » exigée côté route, et TRACÉE — qui
// consulte un code PIN laisse une empreinte datée dans le journal d'audit.
export async function revelerCodesConfidentiels(
  idOuReference: string,
  acteur?: ContexteActeur
) {
  return prisma.$transaction(async (tx) => {
    const fiche = await tx.affectation.findFirst({
      where: { OR: [{ id: idOuReference }, { reference: idOuReference }] },
      select: {
        id: true,
        reference: true,
        beneficiaryName: true,
        simPin: true,
        simPuk: true
      }
    });
    if (!fiche) throw introuvable("Fiche d'affectation introuvable.");

    let pin: string | null;
    let puk: string | null;
    try {
      pin = dechiffrer(fiche.simPin);
      puk = dechiffrer(fiche.simPuk);
    } catch {
      throw new ErreurMetier(
        500,
        "Codes confidentiels illisibles : la clé de chiffrement a changé ou manque. Intervention administrateur requise.",
        "SECRET_UNREADABLE"
      );
    }

    await journaliserDansTx(tx, {
      action: ACTIONS_AUDIT.CONFIDENTIAL_REVEALED,
      utilisateurId: acteur?.utilisateurId ?? null,
      adresseIp: acteur?.adresseIp ?? null,
      agentUtilisateur: acteur?.agentUtilisateur ?? null,
      entite: "Affectation",
      entiteId: fiche.id,
      details: {
        reference: fiche.reference,
        beneficiaire: fiche.beneficiaryName
      }
    });

    return {
      reference: fiche.reference,
      beneficiaire: fiche.beneficiaryName,
      simPin: pin,
      simPuk: puk
    };
  });
}
