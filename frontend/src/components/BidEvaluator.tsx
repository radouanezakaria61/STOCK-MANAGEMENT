import React, { useState } from "react";
import { RFQComparisonCase, AICopilotResult, AppUser } from "../types";
import { Award, ShieldAlert, Sparkles, TrendingUp, AlertCircle, Info, Plus, X, BrainCircuit, RefreshCw, Table, Lock } from "lucide-react";

interface BidEvaluatorProps {
  rfqCases: RFQComparisonCase[];
  currentUser?: AppUser | null;
  onAddRFQ: (rfq: any) => Promise<void>;
}

export default function BidEvaluator({ rfqCases, currentUser, onAddRFQ }: BidEvaluatorProps) {
  const [selectedCase, setSelectedCase] = useState<RFQComparisonCase | null>(rfqCases[0] || null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [aiResult, setAiResult] = useState<AICopilotResult | null>(null);

  const canEvaluate = !currentUser || (currentUser.status === "Actif" && currentUser.permissions?.canEvaluateBids);
  
  // Custom RFQ Modeller Form
  const [isModelling, setIsModelling] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Systèmes d'Information");
  const [targetBudget, setTargetBudget] = useState(85000);
  const [itemsRequired, setItemsRequired] = useState("");

  const [formBids, setFormBids] = useState<any[]>([
    { vendorName: "", unitPrice: 0, leadTimeDays: 7, warrantyYears: 2, complianceLevel: "95%", notes: "" },
    { vendorName: "", unitPrice: 0, leadTimeDays: 14, warrantyYears: 1, complianceLevel: "80%", notes: "" }
  ]);

  const handleAuditBids = async () => {
    if (!selectedCase) return;
    setLoading(true);
    setAiResult(null);

    // Multi-step reassurance loading state in French
    const states = [
      "Connexion sécurisée aux services d'évaluation des appels d'offres...",
      "Analyse des écarts de prix par rapport au budget plafond alloué...",
      "Corrélation des performances passées des soumissionnaires et délais OTD...",
      "Vérification de la conformité aux exigences du cahier des charges (RFP)...",
      "Génération par Gemini AI des arguments de négociation et du plan de mitigation SLA..."
    ];

    let i = 0;
    setStatusText(states[0]);
    const timer = setInterval(() => {
      i++;
      if (i < states.length) {
        setStatusText(states[i]);
      }
    }, 1500);

    try {
      const response = await fetch("/api/ai/analyze-bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedCase),
      });

      if (!response.ok) {
        throw new Error("Erreur du serveur lors de l'audit.");
      }

      const report = await response.json();
      setAiResult(report);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse comparative des offres.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const handleAddBidLine = () => {
    setFormBids([...formBids, { vendorName: "", unitPrice: 0, leadTimeDays: 14, warrantyYears: 2, complianceLevel: "90%", notes: "" }]);
  };

  const handleUpdateBidField = (index: number, field: string, value: any) => {
    const fresh = [...formBids];
    fresh[index] = { ...fresh[index], [field]: value };
    setFormBids(fresh);
  };

  const handleModelRFQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !itemsRequired) {
      alert("Veuillez renseigner le titre du projet et les livrables requis.");
      return;
    }

    try {
      await onAddRFQ({
        title,
        department,
        targetBudget,
        itemsRequired,
        bids: formBids
      });
      setIsModelling(false);
      // Reset
      setTitle("");
      setItemsRequired("");
      setFormBids([
        { vendorName: "", unitPrice: 0, leadTimeDays: 7, warrantyYears: 2, complianceLevel: "95%", notes: "" },
        { vendorName: "", unitPrice: 0, leadTimeDays: 14, warrantyYears: 1, complianceLevel: "80%", notes: "" }
      ]);
      // Select the newly added rfq
      setTimeout(() => {
        setSelectedCase(rfqCases[0]);
      }, 500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCase = (rfq: RFQComparisonCase) => {
    setSelectedCase(rfq);
    setAiResult(null);
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Évaluateur d'Appels d'Offres & Audit IA Stratégique</h2>
          <p className="text-xs text-slate-500">Comparaison mathématique et audit multicritère propulsé par Gemini AI sur les devis concurrents.</p>
        </div>
        <button
          onClick={() => setIsModelling(true)}
          className="bg-indigo-600 text-white text-xs font-semibold px-4.5 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition cursor-pointer"
        >
          <Plus size={16} /> Modéliser un Appel d'Offres (RFQ)
        </button>
      </div>

      {/* RFQ CASES SELECTION PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Dossiers d'Appels d'Offres</span>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {rfqCases.map((rfq) => (
              <button
                key={rfq.id}
                onClick={() => handleSelectCase(rfq)}
                className={`w-full text-left text-xs p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedCase?.id === rfq.id
                    ? "bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold"
                    : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="truncate mb-1">{rfq.title}</div>
                <div className="text-[9px] text-slate-400 font-mono">Plafond : {rfq.targetBudget.toLocaleString()} MAD</div>
              </button>
            ))}
          </div>
        </div>

        {/* COMPARISON METRICS MATRIX */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          {selectedCase ? (
            <div className="space-y-5">
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase font-mono">
                    {selectedCase.department}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-2">{selectedCase.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Livrables & Spécifications : <strong className="text-slate-600 font-semibold">{selectedCase.itemsRequired}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-medium block">BUDGET PLAFOND</span>
                  <strong className="text-sm text-indigo-700 font-bold font-mono">
                    {selectedCase.targetBudget.toLocaleString()} MAD
                  </strong>
                </div>
              </div>

              {/* BIDS GRID CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedCase.bids.map((bid) => {
                  const isUnderBudget = bid.totalPrice <= selectedCase.targetBudget;
                  return (
                    <div 
                      key={bid.id} 
                      className={`rounded-xl border p-4 flex flex-col justify-between ${
                        isUnderBudget ? "bg-slate-50 border-slate-200" : "bg-red-50/40 border-red-100"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2 truncate">
                          {bid.vendorName}
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Offre Globale :</span>
                            <span className={`font-bold font-mono ${isUnderBudget ? "text-slate-800" : "text-red-700"}`}>
                              {bid.totalPrice.toLocaleString()} MAD
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Délai de livraison :</span>
                            <strong className="text-slate-700 font-semibold">{bid.leadTimeDays} Jours</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Garantie SLA :</span>
                            <strong className="text-slate-700 font-semibold">{bid.warrantyYears} Ans</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Conformité RFP :</span>
                            <strong className="text-slate-700 font-semibold">{bid.complianceLevel}</strong>
                          </div>
                        </div>
                      </div>

                      {bid.riskFlags.length > 0 && (
                        <div className="mt-3.5 pt-2.5 border-t border-slate-150 text-[10px] text-red-700 space-y-1">
                          {bid.riskFlags.map((flag, idx) => (
                            <p key={idx} className="flex items-center gap-1 font-semibold">
                              <span className="w-1 h-1 rounded-full bg-red-600 block"></span>
                              {flag}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ACTION: TRIGGER GEMINI */}
              <div className="bg-indigo-900 border border-indigo-950 rounded-xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                  <h4 className="text-xs font-bold flex items-center justify-center md:justify-start gap-1.5 text-indigo-200">
                    <BrainCircuit size={16} /> Audit d'Appel d'Offres Assisté par Gemini AI
                  </h4>
                  <p className="text-[11px] text-indigo-100/80 max-w-md">
                    Évaluez les risques de dépendance, les clauses de garantie et la structure des coûts. L'IA génère des recommandations claires et un guide pratique pour négocier.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (canEvaluate) {
                      handleAuditBids();
                    }
                  }}
                  disabled={loading || !canEvaluate}
                  title={!canEvaluate ? "Action réservée aux Acheteurs, Responsables Achats et Administrateurs" : ""}
                  className={`font-bold text-xs px-4.5 py-2.5 rounded-lg flex items-center gap-1.5 transition tracking-wide shadow-xs shrink-0 ${
                    canEvaluate && !loading
                      ? "bg-emerald-500 text-indigo-950 hover:bg-emerald-400 cursor-pointer"
                      : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-70"
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Audit en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Lancer l'Audit Gemini AI
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-xs">
              Sélectionnez un projet d'appel d'offres pour lancer la comparaison des offres.
            </div>
          )}
        </div>
      </div>

      {/* AI LOAD REASSURANCE PORTAL PANEL */}
      {loading && (
        <div className="bg-white rounded-xl border border-indigo-100 p-8 text-center space-y-4 shadow-xs">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-ping"></div>
            <div className="absolute inset-0 border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-xs">Analyse en cours des offres et conditions commerciales</h4>
            <p className="text-[11px] text-indigo-600 font-medium mt-1 font-mono transition-all duration-300">{statusText}</p>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE AI AUDIT REPORT DISPLAY */}
      {aiResult && !loading && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
          
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <BrainCircuit className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-900 text-sm">Rapport d'Évaluation Commerciale et d'Audit IA Gemini</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Recommendations & Playbook */}
            <div className="lg:col-span-2 space-y-5">
              
              <div className="bg-white rounded-xl border border-slate-200 p-4.5">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Award size={18} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Fournisseur Recommandé en Priorité</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-2">{aiResult.recommendedVendor}</h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                  {aiResult.recommendationReasoning}
                </p>
              </div>

              {/* Side-by-side Supplier Pros Cons */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Table size={14} className="text-slate-500" /> Comparatif Détaillé des Offres
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiResult.supplierComparison.map((comp) => (
                    <div key={comp.vendorName} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <h5 className="text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-1.5">{comp.vendorName}</h5>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-emerald-700 font-bold block text-[10px] uppercase">POINTS FORTS / AVANTAGES</span>
                          <p className="text-slate-600 font-medium">{comp.pros}</p>
                        </div>
                        <div>
                          <span className="text-red-700 font-bold block text-[10px] uppercase">RISQUES / POINTS DE VIGILANCE</span>
                          <p className="text-slate-500">{comp.cons}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Negotiation Playbook */}
              <div className="bg-white rounded-xl border border-indigo-100 p-5 space-y-3">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-indigo-600" /> Leviers de Négociation & Recommandations Stratégiques
                </h4>
                <ul className="space-y-2.5 text-xs text-slate-700 pl-1">
                  {aiResult.negotiationPlaybook.map((play, index) => (
                    <li key={index} className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {index + 1}
                      </span>
                      <span className="mt-0.5 leading-relaxed">{play}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Right Column: Risk scorecard matrix */}
            <div className="space-y-5">
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-red-500" /> Évaluation des Risques Commerciaux
                </h4>
                <p className="text-[11px] text-slate-500">
                  Indicateurs de risque détectés lors de l'audit des offres.
                </p>

                <div className="space-y-3">
                  {aiResult.riskAssessment.map((risk, idx) => {
                    const isHigh = risk.severity === "High";
                    const isMed = risk.severity === "Medium";
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                          isHigh 
                            ? "bg-red-50/40 border-red-100" 
                            : isMed 
                            ? "bg-amber-50/40 border-amber-100" 
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className={`${isHigh ? "text-red-900" : isMed ? "text-amber-900" : "text-slate-800"}`}>
                            {risk.riskTitle}
                          </span>
                          <span 
                            className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold ${
                              isHigh 
                                ? "bg-red-100 text-red-700" 
                                : isMed 
                                ? "bg-amber-100 text-amber-700" 
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {isHigh ? "Élevé" : isMed ? "Modéré" : "Faible"}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-[11px]">
                          {risk.riskExplanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4.5 text-xs text-indigo-950 flex gap-2">
                <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-bold block mb-0.5">Note sur l'évaluation des achats</strong>
                  Les analyses tiennent compte de la santé financière des fournisseurs, des prix régionaux et du respect des engagements de livraison en Dirhams marocains (MAD).
                </div>
              </div>

            </div>

          </div>

        </div>
      )}


      {/* SIMULATE / MODEL NEW RFQ DIALOG WINDOW OVERLAY */}
      {isModelling && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Modéliser un Appel d'Offres (RFQ)</h3>
                <p className="text-[11px] text-slate-500">Définissez les spécifications, le budget cible en MAD et saisissez les propositions des soumissionnaires.</p>
              </div>
              <button 
                onClick={() => setIsModelling(false)}
                className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModelRFQSubmit} className="p-5 space-y-4 overflow-y-auto">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Intitulé du Projet / RFQ</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Migration et Déploiement ERP Global"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Budget Cible Alloué (MAD)</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 85000"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    value={targetBudget}
                    onChange={(e) => setTargetBudget(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Département Commanditaire</label>
                  <select
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Systèmes d'Information">Systèmes d'Information</option>
                    <option value="Ressources Humaines & Services Généraux">Ressources Humaines & Services Généraux</option>
                    <option value="Marketing & Communication">Marketing & Communication</option>
                    <option value="Chaîne Logistique & Approvisionnements">Chaîne Logistique & Approvisionnements</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Livrables Clés Requis</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 3x Modules Experts & Accompagnement Déploiement"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg"
                    value={itemsRequired}
                    onChange={(e) => setItemsRequired(e.target.value)}
                  />
                </div>
              </div>

              {/* Competing proposals */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Propositions des Soumissionnaires</label>
                  <button
                    type="button"
                    onClick={handleAddBidLine}
                    className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Ajouter une Offre
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {formBids.map((bid, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200 p-3 rounded-xl relative space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nom du Fournisseur"
                          className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
                          value={bid.vendorName}
                          onChange={(e) => handleUpdateBidField(index, "vendorName", e.target.value)}
                        />
                        <input
                          type="number"
                          required
                          placeholder="Montant Offre (MAD)"
                          className="text-xs p-2 bg-white border border-slate-200 rounded-lg"
                          value={bid.unitPrice === 0 ? "" : bid.unitPrice}
                          onChange={(e) => handleUpdateBidField(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold block uppercase">Délai (jours)</span>
                          <input
                            type="number"
                            className="text-xs p-1 bg-white border border-slate-200 rounded text-center w-full"
                            value={bid.leadTimeDays}
                            onChange={(e) => handleUpdateBidField(index, "leadTimeDays", parseInt(e.target.value) || 7)}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold block uppercase">Garantie SLA (ans)</span>
                          <input
                            type="number"
                            className="text-xs p-1 bg-white border border-slate-200 rounded text-center w-full"
                            value={bid.warrantyYears}
                            onChange={(e) => handleUpdateBidField(index, "warrantyYears", parseInt(e.target.value) || 2)}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold block uppercase">Conformité RFP</span>
                          <input
                            type="text"
                            placeholder="90%"
                            className="text-xs p-1 bg-white border border-slate-200 rounded text-center w-full"
                            value={bid.complianceLevel}
                            onChange={(e) => handleUpdateBidField(index, "complianceLevel", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModelling(false)}
                  className="border border-slate-200 text-slate-600 font-semibold px-4.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white font-semibold px-5 py-1.5 rounded-lg text-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  Créer le Dossier Comparatif
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
