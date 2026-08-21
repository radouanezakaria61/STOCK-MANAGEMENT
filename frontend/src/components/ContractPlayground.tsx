import { useState } from "react";
import { Vendor } from "../types";
import { Scale, Sparkles, Copy, Check, FileText, Compass, AlertCircle, RefreshCw } from "lucide-react";

interface ContractPlaygroundProps {
  vendors: Vendor[];
}

export default function ContractPlayground({ vendors }: ContractPlaygroundProps) {
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [category, setCategory] = useState("Matériel Informatique");
  const [termScope, setTermScope] = useState("");
  const [speedUrgency, setSpeedUrgency] = useState("Standard");
  
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateClause = async () => {
    const matchedVendor = vendors.find(v => v.id === selectedVendorId);
    const vendorName = matchedVendor ? matchedVendor.name : "Prestataire / Fournisseur Partenaire";

    setLoading(true);
    setCopied(false);
    try {
      const response = await fetch("/api/ai/draft-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName,
          category,
          termScope,
          speedUrgency,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la génération de la clause contractuelle.");
      }

      const report = await response.json();
      setGeneratedDoc(report.document || "");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la rédaction de la clause par l'IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyClipboard = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrefillTerms = (type: string) => {
    if (type === "SLA") {
      setTermScope("Pénalités de retard de livraison et engagements OTD. Seuil minimal garanti de 95% de livraisons à temps avec retenue financière forfaitaire journalière de 1,5% de la valeur de la commande en MAD.");
      setCategory("Transport & Logistique");
    } else if (type === "AUDIT") {
      setTermScope("Droit d'audit comptable et technique renforcé sur site, vérification des bordereaux de livraison et contrôle de conformité des équipements semestriel.");
      setCategory("Prestations & Conseil");
    } else {
      setTermScope("Clause de confidentialité stricte (NDA), propriété exclusive de la propriété intellectuelle (IP) et obligation de conformité aux normes CNDP / sécurité informatique.");
      setCategory("Matériel Informatique");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Générateur & Auditeur de Clauses Contractuelles & SLA</h2>
        <p className="text-xs text-slate-500">Rédigez, personnalisez et vérifiez des clauses juridiques sur mesure assistées par Gemini AI en Dirhams marocains (MAD).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CONTRACTS PARAMETER PANEL */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2 mb-2 text-indigo-950 font-bold text-xs uppercase tracking-wider">
            <Scale size={16} className="text-indigo-600" /> Paramètres du Contrat
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 uppercase">Fournisseur Partenaire Cible</label>
            <select
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              <option value="">-- Sélectionner un fournisseur --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 uppercase">Catégorie d'Achats / Marché</label>
            <select
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Matériel Informatique">Matériel Informatique</option>
              <option value="Sécurité IT & Réseaux">Sécurité IT & Réseaux</option>
              <option value="Fournitures & Mobilier">Fournitures & Mobilier</option>
              <option value="Prestations & Conseil">Prestations & Conseil</option>
              <option value="Transport & Logistique">Transport & Logistique</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 uppercase">Niveau de Criticité du Projet</label>
            <select
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
              value={speedUrgency}
              onChange={(e) => setSpeedUrgency(e.target.value)}
            >
              <option value="Standard">Standard (Risque commercial modéré)</option>
              <option value="Urgent">Haute criticité (Pénalités de retard strictes)</option>
              <option value="Strategic">Stratégique (Clause de confidentialité et protection IP renforcées)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 uppercase">Objet & Portée des Clauses</label>
            <textarea
              rows={4}
              required
              placeholder="Ex: Garantie pièce et main-d'œuvre de 2 ans, engagement d'intervention sous 4 heures, pénalités de retard..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
              value={termScope}
              onChange={(e) => setTermScope(e.target.value)}
            />
          </div>

          {/* Prompt presets */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Modèles de Clauses Rapides</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePrefillTerms("SLA")}
                className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Pénalités Retards OTD
              </button>
              <button
                type="button"
                onClick={() => handlePrefillTerms("AUDIT")}
                className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Droit d'Audit Acheteur
              </button>
              <button
                type="button"
                onClick={() => handlePrefillTerms("IP")}
                className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 hover:bg-slate-200 cursor-pointer"
              >
                Confidentialité & Propriété IP
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateClause}
            disabled={loading || !termScope}
            className="w-full bg-indigo-600 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Rédaction en cours...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Rédiger les Clauses Contractuelles
              </>
            )}
          </button>
        </div>

        {/* DRAFT PREVIEW DISPLAY PAPER */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs min-h-[460px]">
          
          <div className="bg-slate-50 border-b border-slate-200 p-4.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-slate-600" size={16} />
              <span className="text-xs font-bold text-slate-700">Texte Juridique Généré</span>
            </div>
            {generatedDoc && (
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 transition cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? "Texte Copié !" : "Copier dans le presse-papier"}
              </button>
            )}
          </div>

          {/* Slate Preview Paper */}
          <div className="flex-1 bg-slate-50/40 p-6 overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="text-indigo-600 animate-spin" size={24} />
                <p className="text-xs text-slate-500 font-semibold">Gemini AI rédige les stipulations contractuelles et clauses SLA...</p>
              </div>
            ) : generatedDoc ? (
              <div className="prose prose-sm font-sans text-slate-800 space-y-4 text-xs leading-relaxed max-w-none whitespace-pre-wrap">
                {generatedDoc}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2.5 p-6">
                <Compass className="text-slate-300" size={40} />
                <div className="max-w-md">
                  <h4 className="font-bold text-slate-700 text-xs">En attente de paramètres</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sélectionnez un fournisseur, précisez l'objet des clauses ou sélectionnez un modèle rapide à gauche pour générer automatiquement des stipulations contractuelles prêtes à l'emploi.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex gap-2 text-[11px] text-slate-500">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>Note : Les clauses générées constituent des propositions d'aide à la décision. Faites valider tout engagement contractuel final par votre direction juridique.</span>
          </div>

        </div>

      </div>
    </div>
  );
}
