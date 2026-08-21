import { getAI } from "../lib/gemini.js";
import { requeteInvalide } from "../lib/erreurs.js";

// ── Analyse comparative des offres (co-pilote IA) ─────────────────────

export interface OffreAnalyse {
  vendorName?: string;
  unitPrice?: number;
  totalPrice?: number;
  leadTimeDays?: number;
  warrantyYears?: number;
  complianceLevel?: string;
  riskFlags?: string[];
  notes?: string;
}

export interface EntreeAnalyseOffres {
  title?: string;
  department?: string;
  targetBudget?: number;
  itemsRequired?: string;
  bids?: OffreAnalyse[];
}

export async function analyserOffres(data: EntreeAnalyseOffres) {
  const { title, department, targetBudget, itemsRequired, bids } = data;

  if (!title || !bids || bids.length === 0) {
    throw requeteInvalide(
      "Please provide a project title and active bids to scan."
    );
  }

  const ai = getAI();
  const dossierAchats = `
    Titre du Projet / Appel d'Offres: ${title}
    Département Bénéficiaire: ${department}
    Budget Cible Alloué: ${targetBudget} MAD (Dirhams marocains)
    Livrables & Spécifications Requises: ${itemsRequired}

    Offres Concurrentes Reçues:
    ${JSON.stringify(bids, null, 2)}
  `;

  if (ai) {
    try {
      // Modèle standard Gemini 3.5 Flash — réponse JSON stricte
      const prompt = `
        Tu es un auditeur expert en achats industriels, marchés publics et stratégie de négociation commerciale au Maroc.
        Analyse les offres de prix des fournisseurs pour ce projet :
        ${dossierAchats}

        Réponds OBLIGATOIREMENT en français avec toutes les valeurs monétaires formulées en Dirhams marocains (MAD).
        Fournis ton analyse strictement sous le format JSON suivant (valide, avec guillemets doubles) :
        {
          "recommendedVendor": "NOM DU FOURNISSEUR RECOMMANDÉ",
          "recommendationReasoning": "Explication claire et synthétique évaluant le rapport qualité/prix en MAD, les délais de livraison, la garantie et la conformité globale.",
          "supplierComparison": [
            {
              "vendorName": "NOM DU FOURNISSEUR",
              "pros": "Points forts de l'offre...",
              "cons": "Points faibles ou réserves (ex: délai long, garantie standard, prix élevé en MAD)..."
            }
          ],
          "riskAssessment": [
            {
              "riskTitle": "Titre du risque (ex: Risque de rupture logistique, Dépassement budgétaire)",
              "severity": "High" | "Medium" | "Low",
              "riskExplanation": "Description concise du risque opérationnel ou financier."
            }
          ],
          "negotiationPlaybook": [
            "2 à 3 points d'action et arguments concrets de négociation pour optimiser le coût en MAD, réduire le délai ou étendre la garantie SLA."
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction:
            "Tu es un expert auditeur des achats et juriste contrats marchés. Rédige toujours en français irréprochable avec des recommandations concrètes et des montants en Dirhams marocains (MAD)."
        }
      });

      const auditResponseText = response.text || "{}";
      const cleanJson = JSON.parse(auditResponseText);
      return { corps: { provider: "Gemini 3.5 Flash Client", ...cleanJson } };
    } catch (err) {
      console.error("Gemini Audit Exception:", err);
      const ruleBasedResult = buildRuleBasedFallback(title, targetBudget ?? 0, bids);
      return {
        corps: {
          provider: "Moteur Heuristique d'Achats Local (Secours Haute Disponibilité)",
          isFallbackDueToDemand: true,
          ...ruleBasedResult
        }
      };
    }
  }

  // Pas de clé Gemini : moteur heuristique local instantané
  console.log("No live key found. Resolving with dynamic rule-based procurement solver.");
  const ruleBasedResult = buildRuleBasedFallback(title, targetBudget ?? 0, bids);
  return {
    corps: { provider: "Moteur d'Analyse Heuristique Local", ...ruleBasedResult }
  };
}

// ── Rédaction de clauses contractuelles ──────────────────────────────

export interface EntreeClausesContractuelles {
  vendorName?: string;
  category?: string;
  termScope?: string;
  speedUrgency?: string;
}

export async function redigerClauses(data: EntreeClausesContractuelles) {
  const { vendorName, category, termScope, speedUrgency } = data;

  if (!vendorName || !category) {
    throw requeteInvalide(
      "Informations du fournisseur manquantes pour la génération des clauses contractuelles."
    );
  }

  const ai = getAI();
  if (ai) {
    try {
      const prompt = `
        Rédige un Avenant Contractuel d'Achats & Accord de Niveau de Service (SLA) professionnel entre notre entreprise et le prestataire "${vendorName}".
        Catégorie d'Approvisionnement: ${category}
        Périmètre Spécifique Demandé: ${termScope || "Indicateurs de performance, pénalités de retard, force majeure, confidentialité et droit d'audit"}
        Niveau d'Urgence du Projet: ${speedUrgency || "Standard"}

        Produis un document contractuel formel, complet et juridiquement rigoureux en langue française, avec les pénalités et montants exprimés en Dirhams marocains (MAD). Utilise une structure Markdown soignée avec titres et articles numérotés.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "Tu es un juriste d'entreprise senior spécialisé en droit des contrats commerciaux, logistique, marchés de fournitures et gestion des risques au Maroc. Rédige toujours en français avec rigueur et précision."
        }
      });

      return { corps: { provider: "Gemini 3.5 Flash Client", document: response.text } };
    } catch (err) {
      console.error("Gemini Contract Exception (Falling back to High Demand Template):", err);
      return {
        corps: {
          provider: "Moteur Local de Contrats Standards",
          document: documentSecours(vendorName, category)
        }
      };
    }
  }

  return {
    corps: {
      provider: "Moteur Local de Contrats Standards",
      document: documentGenerique(vendorName, category)
    }
  };
}

function documentSecours(vendorName: string, category: string): string {
  return `
### AVENANT CONTRACTUEL : ACCORD DE NIVEAU DE SERVICE (SLA) & CONFORMITÉ
**FOURNISSEUR :** ${vendorName || "Prestataire Sous-traitant"}
**CATÉGORIE :** ${category || "Fournitures & Services Généraux"}
**DATE D'EFFET :** ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}

#### ARTICLE 1 : ENGAGEMENTS DE DISPONIBILITÉ & NIVEAU DE SERVICE (SLA)
Le Fournisseur s'engage formellement à garantir un taux de respect des délais de livraison (OTD) d'au moins **95%** sur l'ensemble des commandes émises. Tout retard imputable au Fournisseur supérieur à cinq (5) jours ouvrés ouvrira droit pour l'Acheteur à une pénalité forfaitaire de **1,5% par jour de retard**, déductible directement sur la facture mensuelle correspondante (exprimée en Dirhams marocains - MAD).

#### ARTICLE 2 : DROIT D'AUDIT COMMERCIAL ET CONTRÔLE TARIFAIRE
L'Acheteur se réserve le droit d'effectuer ou de faire effectuer par un cabinet d'audit indépendant tout contrôle sur les éléments de facturation, les bons de livraison et les fiches techniques des composants livrés, à raison de deux audits annuels maximum. Tout écart ou surfacturation fera l'objet d'un avoir immédiat majoré des intérêts légaux en vigueur.

#### ARTICLE 3 : GARANTIE MATÉRIELLE & CONFORMITÉ RÉGLEMENTAIRE
Tous les équipements et prestations fournis au titre du présent marché bénéficient d'une garantie pièces et main d'œuvre intégrale d'une durée minimale de **24 Mois** à compter de la signature du procès-verbal de réception conforme. Le Fournisseur garantit le respect strict des normes de sécurité et de confidentialité applicables.
      `;
}

function documentGenerique(vendorName: string, category: string): string {
  return `
### AVENANT CONTRACTUEL : ACCORD DE NIVEAU DE SERVICE (SLA) & CONFORMITÉ
**FOURNISSEUR :** ${vendorName}
**CATÉGORIE :** ${category}
**DATE D'EFFET :** ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}

#### ARTICLE 1 : ENGAGEMENTS DE DISPONIBILITÉ & NIVEAU DE SERVICE (SLA)
Le Fournisseur s'engage formellement à garantir un taux de respect des délais de livraison (OTD) d'au moins **92%** sur l'ensemble des bons de commande. Tout retard logistique supérieur à cinq (5) jours ouvrés donnera lieu à une pénalité de retard de **1,5% par jour**, imputable sur les règlements en Dirhams marocains (MAD).

#### ARTICLE 2 : CONTRÔLE QUALITÉ & DROIT D'AUDIT
L'Acheteur dispose d'un droit de regard et d'audit sur les processus de fabrication et les bordereaux de prix unitaires convenus.

#### ARTICLE 3 : GARANTIE PIÈCES & MAIN D'ŒUVRE
Les fournitures livrées sont couvertes par une garantie constructeur étendue de **24 Mois** avec engagement d'intervention sur site sous 48 heures ouvrées.
    `;
}

// Évaluateur heuristique local (français, montants en MAD)
export function buildRuleBasedFallback(
  title: string,
  targetBudget: number,
  bids: OffreAnalyse[]
) {
  let bestBid: OffreAnalyse | undefined = bids[0];
  let lowestCost = Infinity;

  const comparison = bids.map((b) => {
    const totalPrice = b.totalPrice ?? 0;
    const exceedsBudget = totalPrice > targetBudget;
    const isLowest = totalPrice < lowestCost;
    if (isLowest) {
      lowestCost = totalPrice;
      bestBid = b;
    }

    const prs: string[] = [];
    const cns: string[] = [];

    if (!exceedsBudget) prs.push("Offre conforme au plafond budgétaire alloué");
    else cns.push(`Dépassement du budget prévisionnel alloué (${targetBudget.toLocaleString()} MAD)`);

    if ((b.leadTimeDays ?? 99) <= 10) prs.push(`Délai d'exécution rapide (${b.leadTimeDays} jours)`);
    else cns.push(`Délai de livraison allongé (${b.leadTimeDays} jours), risque d'impact sur le planning`);

    if ((b.warrantyYears ?? 0) >= 3) prs.push(`Excellente couverture de garantie (${b.warrantyYears} ans)`);
    else prs.push(`Garantie standard de ${b.warrantyYears} an(s)`);

    const compliancePct = parseInt(b.complianceLevel || "") || 85;
    if (compliancePct >= 95) prs.push("Excellente conformité au cahier des charges technique");
    else cns.push("Certaines spécifications secondaires restent à valider");

    return {
      vendorName: b.vendorName,
      pros: prs.join(". ") || "Spécifications conformes aux normes requises.",
      cons: cns.join(". ") || "Aucune anomalie majeure identifiée."
    };
  });

  const risks: Array<{ riskTitle: string; severity: string; riskExplanation: string }> = [];
  bids.forEach((b) => {
    if ((b.leadTimeDays ?? 0) > 25) {
      risks.push({
        riskTitle: `Risque de retard logistique avec ${b.vendorName}`,
        severity: "High",
        riskExplanation: `${b.vendorName} annonce un délai d'acheminement de ${b.leadTimeDays} jours, ce qui peut impacter la mise en service.`
      });
    }
    const cmp = parseInt(b.complianceLevel || "") || 85;
    if (cmp < 80) {
      risks.push({
        riskTitle: `Écart de conformité technique (${b.vendorName})`,
        severity: "Medium",
        riskExplanation: `${b.vendorName} affiche un taux de conformité de ${b.complianceLevel}. Une revue des fiches techniques est requise.`
      });
    }
  });

  if (risks.length === 0) {
    risks.push({
      riskTitle: "Risques Opérationnels Standards",
      severity: "Low",
      riskExplanation: "Les offres examinées présentent un niveau de maîtrise logistique et technique satisfaisant."
    });
  }

  return {
    recommendedVendor: bestBid?.vendorName || "Offre la plus compétitive",
    recommendationReasoning: `${bestBid?.vendorName} propose la meilleure offre économique avec un montant de ${bestBid ? Number(bestBid.totalPrice).toLocaleString() : 0} MAD et des garanties conformes au cahier des charges.`,
    supplierComparison: comparison,
    riskAssessment: risks,
    negotiationPlaybook: [
      `Négocier avec ${bestBid?.vendorName || "le fournisseur"} un engagement ferme sur les délais de livraison.`,
      "Demander une remise commerciale de volume de 5% à 8% sur le montant total en MAD.",
      "Solliciter une extension de garantie d'au moins 12 mois sans surcoût."
    ]
  };
}
