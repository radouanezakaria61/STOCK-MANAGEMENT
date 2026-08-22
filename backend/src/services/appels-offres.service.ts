import { prisma } from "../lib/prisma.js";
import { requeteInvalide } from "../lib/erreurs.js";
import { numeroSuivant } from "../lib/ids.js";

export interface EntreeOffre {
  vendorName?: string;
  unitPrice?: unknown;
  qty?: unknown;
  leadTimeDays?: unknown;
  warrantyYears?: unknown;
  complianceLevel?: string;
  riskFlags?: string[];
  notes?: string;
}

export interface EntreeAppelOffres {
  title?: string;
  department?: string;
  targetBudget?: unknown;
  itemsRequired?: string;
  bids?: EntreeOffre[];
}

export async function creerAppelOffres(data: EntreeAppelOffres) {
  const { title, department, targetBudget, itemsRequired, bids } = data;

  if (!title || !itemsRequired || !bids) {
    throw requeteInvalide(
      "Missing required parameters for Request for Quote (RFQ) comparison."
    );
  }

  const references = (
    await prisma.appelOffres.findMany({ select: { reference: true }, where: { reference: { startsWith: "rfq-" } } })
  ).map((r) => r.reference);
  const numeroPool = numeroSuivant(references, /^rfq-(\d+)$/);

  const nouveau = await prisma.appelOffres.create({
    data: {
      reference: `rfq-${numeroPool}`,
      title,
      department: department || "Supply Chain",
      targetBudget: parseFloat(String(targetBudget)) || 20000,
      itemsRequired,
      bids: {
        create: bids.map((b) => ({
          vendorName: b.vendorName ?? "",
          unitPrice: parseFloat(String(b.unitPrice)) || 0,
          totalPrice: (parseFloat(String(b.unitPrice)) || 0) * (Number(b.qty) || 1),
          leadTimeDays: parseInt(String(b.leadTimeDays)) || 14,
          warrantyYears: parseInt(String(b.warrantyYears)) || 2,
          complianceLevel: b.complianceLevel || "90%",
          riskFlags: b.riskFlags || [],
          notes: b.notes || ""
        }))
      }
    },
    include: { bids: { orderBy: { creeLe: "asc" } } }
  });

  return { status: 201 as const, message: "RFQ comparative simulation added.", data: nouveau };
}
