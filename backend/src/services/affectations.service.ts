import { prisma } from "../lib/prisma.js";
import { introuvable, requeteInvalide } from "../lib/erreurs.js";
import { dateDuJour, pad3 } from "../lib/ids.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Lectures ──────────────────────────────────────────────────────────

export async function listerAffectations() {
  return prisma.affectation.findMany({
    orderBy: { seq: "desc" },
    include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
  });
}

// ── Création d'une affectation ───────────────────────────────────────

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

async function prochainsNumeros(tx: Tx) {
  const refs = await tx.affectation.findMany({ select: { id: true, reference: true } });
  let max = 0;
  for (const r of refs) {
    const m = (r.reference || r.id).match(/AFF-2026-(\d+)$/);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  const numero = max + 1;
  return { id: `AFF-2026-${pad3(numero)}`, reference: `AFF-DSI-2026-${pad3(numero)}` };
}

export async function creerAffectation(data: EntreeAffectation) {
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
    notes
  } = data;

  if (!beneficiaryName || !beneficiaryDepartment) {
    throw requeteInvalide(
      "Veuillez renseigner le nom du bénéficiaire et son département."
    );
  }

  // Validation stricte : tous les articles doivent être disponibles AVANT écriture
  if (Array.isArray(items) && items.length > 0) {
    for (const itemInput of items) {
      if (itemInput.stockItemId && itemInput.stockItemId !== "STK-DIRECT") {
        const stockItem = await prisma.articleStock.findUnique({
          where: { id: itemInput.stockItemId }
        });
        if (!stockItem) {
          throw requeteInvalide(
            `Article en stock introuvable : ${itemInput.stockItemId}`
          );
        }
        if ((stockItem.availableQty || 0) <= 0) {
          throw requeteInvalide(
            `Le matériel « ${stockItem.name} » (${stockItem.serialNumber || stockItem.assetTag}) n'est plus disponible en stock (Quantité disponible : 0).`
          );
        }
      }
    }
  }

  const nouvelle = await prisma.$transaction(async (tx) => {
    const numeros = await prochainsNumeros(tx);
    const lignesConstruites: LigneConstruite[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const itemInput of items) {
        const stockItem = itemInput.stockItemId
          ? await tx.articleStock.findUnique({ where: { id: itemInput.stockItemId } })
          : null;
        if (stockItem && itemInput.stockItemId !== "STK-DIRECT") {
          if (stockItem.availableQty > 0) {
            await tx.articleStock.update({
              where: { id: stockItem.id },
              data: {
                availableQty: { decrement: 1 },
                allocatedQty: { increment: 1 },
                status:
                  stockItem.availableQty - 1 === 0 ? "Affecté" : "En Stock",
                assignedTo: {
                  userName: beneficiaryName,
                  department: beneficiaryDepartment,
                  assignedDate: assignedDate || dateDuJour()
                }
              }
            });

            lignesConstruites.push({
              stockItemId: stockItem.id,
              assetTag: stockItem.assetTag || itemInput.assetTag || `IT-${stockItem.id}`,
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
                id: `MVT-00${(await tx.mouvementStock.count()) + 1}`,
                stockItemId: stockItem.id,
                itemName: stockItem.name,
                type: "Sortie Affectation",
                quantity: 1,
                performedBy: authorizedBy || "Zakaria Radouane (DSI)",
                recipient: beneficiaryName,
                department: beneficiaryDepartment,
                date: assignedDate || dateDuJour(),
                notes: `Affectation matérielle (${numeros.reference}) - ${beneficiaryJobTitle || "Collaborateur"}`
              }
            });
          }
        }
      }
    } else if (hasSmartphone === true || resourceType?.includes("SmartPhone")) {
      // Saisie directe SIM / Smartphone sans sélection d'article en stock
      lignesConstruites.push({
        stockItemId: "STK-DIRECT",
        assetTag: `IT-TEL-${Date.now().toString().slice(-4)}`,
        name: `${deviceBrand || "Smartphone"} ${deviceModel || ""}`.trim(),
        brand: deviceBrand || "Générique",
        model: deviceModel || "",
        serialNumber: deviceImei || `SN-${Date.now().toString().slice(-6)}`,
        category: "Périphériques & Accessoires",
        condition: "Neuf / Excellent état",
        accessories: ["Chargeur secteur", "Câble USB"]
      });
    }

    return tx.affectation.create({
      data: {
        ...numeros,
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
        assignedDate: assignedDate || dateDuJour(),
        status: "Active",
        authorizedBy: authorizedBy || "Directeur Systèmes d'Information",
        dsiTitle: dsiTitle || "Département Systèmes D'Information",

        resourceType: resourceType || "Carte SIM + SmartPhone",
        hasSimCard: hasSimCard === true || Boolean(resourceType?.includes("SIM")),
        simOperator: simOperator || "IAM",
        simPhoneNumber: simPhoneNumber || beneficiaryPhone || "",
        simPuk: simPuk || "",
        simPin: simPin || "",
        hasSmartphone:
          hasSmartphone === true || Boolean(resourceType?.includes("SmartPhone")),
        deviceBrand: deviceBrand || lignesConstruites[0]?.brand || "HP",
        deviceImei: deviceImei || lignesConstruites[0]?.serialNumber || "",
        deviceModel: deviceModel || lignesConstruites[0]?.model || "15-AY002NK",
        deviceConfiguration: deviceConfiguration || "4 GB | 500 GB",
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
  });

  return {
    status: 201 as const,
    message: `Fiche d'affectation ${nouvelle.reference} générée avec succès pour ${beneficiaryName}.`,
    data: nouvelle
  };
}

// ── Restitution ───────────────────────────────────────────────────────

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

export async function restituerAffectation(id: string, data: EntreeRetour) {
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

  const resultat = await prisma.$transaction(async (tx) => {
    const affectation = await tx.affectation.findUnique({
      where: { id },
      include: { items: { orderBy: { id: "asc" } } }
    });
    if (!affectation) throw introuvable("Fiche d'affectation introuvable.");

    const retour = await tx.retourAffectation.create({
      data: {
        id: `RET-2026-${Math.floor(Math.random() * 900) + 100}`,
        assignmentId: affectation.id,
        returnDate: returnDate || dateDuJour(),
        cause: cause || "Départ collaborateur (Fin de contrat / Démission)",
        customCause: customCause || "",
        equipmentCondition: equipmentCondition || "Bon état d'usage",
        accessoriesReturned: accessoriesReturned || [],
        missingAccessories: missingAccessories || [],
        dataWiped: dataWiped === true,
        bitlockerUnlocked: bitlockerUnlocked === true,
        technicalDiagnosis: technicalDiagnosis || "Matériel inspecté et vérifié conforme.",
        actionTaken: actionTaken || "Remise en stock disponible",
        inspectedBy: inspectedBy || "Zakaria Radouane (DSI)",
        notes: notes || ""
      }
    });

    await tx.affectation.update({
      where: { id },
      data: { status: "Restitué" }
    });

    // Réintégration ou sortie des matériels selon la décision prise
    for (const ligne of affectation.items) {
      const stockItem = await tx.articleStock.findUnique({
        where: { id: ligne.stockItemId }
      });
      if (!stockItem) continue;

      const donnees: Record<string, unknown> = {
        allocatedQty: Math.max(0, stockItem.allocatedQty - 1),
        assignedTo: null
      };

      if (actionTaken === "Remise en stock disponible") {
        donnees["availableQty"] = stockItem.availableQty + 1;
        donnees["status"] = "En Stock";
      } else if (actionTaken === "Envoi en maintenance / SAV") {
        donnees["status"] = "En Maintenance";
      } else if (actionTaken === "Mise au rebut") {
        donnees["status"] = "Rebut / Fin de vie";
        if (stockItem.quantity > 0) donnees["quantity"] = stockItem.quantity - 1;
      }

      await tx.articleStock.update({ where: { id: stockItem.id }, data: donnees });

      await tx.mouvementStock.create({
        data: {
          id: `MVT-00${(await tx.mouvementStock.count()) + 1}`,
          stockItemId: stockItem.id,
          itemName: stockItem.name,
          type: actionTaken === "Mise au rebut" ? "Mise au Rebut" : "Retour Stock",
          quantity: 1,
          performedBy: inspectedBy || "Zakaria Radouane (DSI)",
          recipient: "Magasin Central IT",
          department: affectation.beneficiaryDepartment,
          date: returnDate || dateDuJour(),
          notes: `Restitution (${cause}) - État: ${equipmentCondition}. ${actionTaken}.`
        }
      });
    }

    const assignmentMisAJour = await tx.affectation.findUnique({
      where: { id },
      include: { items: { orderBy: { id: "asc" } }, returnRecord: true }
    });

    return { assignment: assignmentMisAJour!, retour };
  });

  return {
    message: `Restitution de matériel enregistrée avec succès pour l'affectation ${resultat.assignment.reference}.`,
    data: {
      assignment: resultat.assignment,
      returnRecord: resultat.retour
    }
  };
}

// ── Suppression ───────────────────────────────────────────────────────

export async function supprimerAffectation(id: string) {
  const affectation = await prisma.affectation.findUnique({ where: { id } });
  if (!affectation) throw introuvable("Affectation introuvable.");

  await prisma.affectation.delete({ where: { id } });
  return { message: "Fiche d'affectation supprimée." };
}
