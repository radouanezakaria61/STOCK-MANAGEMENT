import React, { useState } from "react";
import { Vendor, AppUser } from "../types";
import { Search, Plus, Mail, User, Star, CheckCircle, BarChart2, X, AlertTriangle, Lock } from "lucide-react";

interface SuppliersDirectoryProps {
  vendors: Vendor[];
  currentUser?: AppUser | null;
  onAddVendor: (vendor: any) => Promise<void>;
  onUpdateVendorRating: (id: string, updates: any) => Promise<void>;
}

export default function SuppliersDirectory({
  vendors,
  currentUser,
  onAddVendor,
  onUpdateVendorRating,
}: SuppliersDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const canManageVendors = !currentUser || (currentUser.status === "Actif" && currentUser.permissions?.canManageVendors);

  // New Vendor Form
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Matériel Informatique");
  const [qualityScore, setQualityScore] = useState(90);
  const [onTimeDelivery, setOnTimeDelivery] = useState(92);
  const [riskLevel, setRiskLevel] = useState<"Low" | "Medium" | "High">("Low");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contact || !email) {
      alert("Veuillez renseigner le nom de l'entreprise, le contact et l'adresse e-mail.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddVendor({
        name,
        contact,
        email,
        category,
        qualityScore,
        onTimeDelivery,
        riskLevel
      });
      // Reset
      setName("");
      setContact("");
      setEmail("");
      setIsRegistering(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustValue = async (id: string, field: string, value: any) => {
    await onUpdateVendorRating(id, { [field]: value });
    // Keep sidebar updated
    if (selectedVendor && selectedVendor.id === id) {
      setSelectedVendor({ ...selectedVendor, [field]: value });
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusLabelMap: Record<string, string> = {
    "Preferred": "Privilégié",
    "Approved": "Approuvé",
    "On Probation": "Sous probation"
  };

  const riskLabelMap: Record<string, string> = {
    "Low": "Risque Faible",
    "Medium": "Risque Modéré",
    "High": "Risque Élevé"
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Annuaire des Fournisseurs & Fiches d'Évaluation</h2>
          <p className="text-xs text-slate-500">Suivi des délais de livraison (OTD), indices de qualité et conformité réglementaire.</p>
        </div>
        <button
          onClick={() => {
            if (canManageVendors) {
              setIsRegistering(true);
            }
          }}
          disabled={!canManageVendors}
          title={!canManageVendors ? "Action réservée aux Responsables Achats et Administrateurs" : ""}
          className={`text-xs font-semibold px-4.5 py-2 rounded-lg flex items-center gap-2 transition ${
            canManageVendors
              ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <Plus size={16} /> Référencer un Fournisseur
        </button>
      </div>

      {/* FILTER SEARCH TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Rechercher par raison sociale, catégorie, contact..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SUPPLIER CARD GRID */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredVendors.map((vendor) => {
            const isHigh = vendor.riskLevel === "High";
            const isMedium = vendor.riskLevel === "Medium";
            const statusColor = {
              "Preferred": "bg-emerald-50 text-emerald-800 border-emerald-200",
              "Approved": "bg-indigo-50 text-indigo-800 border-indigo-200",
              "On Probation": "bg-red-50 text-red-800 border-red-200",
            }[vendor.status] || "bg-slate-100 text-slate-700 border-slate-200";

            return (
              <div
                key={vendor.id}
                onClick={() => setSelectedVendor(vendor)}
                className={`bg-white rounded-xl border p-4.5 transition-all cursor-pointer relative flex flex-col justify-between ${
                  selectedVendor?.id === vendor.id
                    ? "border-indigo-500 ring-2 ring-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-semibold">
                      {vendor.category}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 border rounded ${statusColor}`}>
                      {statusLabelMap[vendor.status] || vendor.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-800 mt-2.5">{vendor.name}</h3>
                  
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <p className="flex items-center gap-1 text-[11px]">
                      <User size={12} className="text-slate-400" />
                      {vendor.contact}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] truncate">
                      <Mail size={12} className="text-slate-400" />
                      {vendor.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">QUALITÉ</span>
                      <strong className="text-xs font-bold text-slate-800">{vendor.qualityScore}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">OTD (DÉLAIS)</span>
                      <strong className="text-xs font-bold text-slate-800">{vendor.onTimeDelivery}%</strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <span 
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isHigh 
                          ? "bg-red-100/60 text-red-700" 
                          : isMedium 
                          ? "bg-amber-100/60 text-amber-700" 
                          : "bg-emerald-100/60 text-emerald-700"
                      }`}
                    >
                      {riskLabelMap[vendor.riskLevel] || vendor.riskLevel}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{vendor.totalSpend.toLocaleString()} MAD</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>


        {/* SUPPLIER SCORECARD DETAIL AUDIT DRAWER */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs sticky top-6 h-fit">
          {selectedVendor ? (
            <div className="space-y-5">
              
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-400">{selectedVendor.id}</span>
                  <h3 className="text-xs font-bold text-slate-800 mt-1.5">{selectedVendor.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedVendor(null)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Vendor Performance Score Tuning Modules */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Paramètres de Performance</h4>
                
                {/* Score 1 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" /> Score d'Audit Qualité
                    </span>
                    <strong className="text-slate-900 font-bold">{selectedVendor.qualityScore}%</strong>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                    value={selectedVendor.qualityScore}
                    onChange={(e) => handleAdjustValue(selectedVendor.id, "qualityScore", e.target.value)}
                  />
                </div>

                {/* Score 2 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1">
                      <CheckCircle size={12} className="text-emerald-500" /> Respect des Délais (OTD)
                    </span>
                    <strong className="text-slate-900 font-bold">{selectedVendor.onTimeDelivery}%</strong>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                    value={selectedVendor.onTimeDelivery}
                    onChange={(e) => handleAdjustValue(selectedVendor.id, "onTimeDelivery", e.target.value)}
                  />
                </div>

                {/* Score 3: Risk level audit toggle */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-slate-600 block">Niveau de Risque Fournisseur</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "Low", label: "Faible" },
                      { key: "Medium", label: "Modéré" },
                      { key: "High", label: "Élevé" }
                    ].map(({ key, label }) => {
                      const isActive = selectedVendor.riskLevel === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleAdjustValue(selectedVendor.id, "riskLevel", key)}
                          className={`text-[10px] font-semibold py-1.5 px-2 rounded-md border text-center transition-colors cursor-pointer ${
                            isActive
                              ? key === "High"
                                ? "bg-red-50 text-red-700 border-red-300 ring-2 ring-red-50"
                                : key === "Medium"
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Stats overview details */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Performance Financière</h4>
                <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-700">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">TOTAL DÉPENSES ENGAGÉES</span>
                    <strong className="text-sm font-bold text-slate-800 font-mono">{selectedVendor.totalSpend.toLocaleString()} MAD</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">CONTRATS ACTIFS</span>
                    <strong className="text-sm font-bold text-slate-800 font-mono">{selectedVendor.activeContracts} Contrats</strong>
                  </div>
                </div>
              </div>

              {selectedVendor.riskLevel === "High" && (
                <div className="bg-red-50 border border-red-100 text-red-800 p-3 rounded-xl flex gap-2 items-start text-xs">
                  <span className="mt-0.5 text-red-500"><AlertTriangle size={15} /></span>
                  <div>
                    <strong className="font-bold block">Fournisseur Placé sous Probation</strong>
                    En raison d'alertes sur la qualité ou les délais de livraison, ce fournisseur nécessite un audit renforcé avant validation de toute nouvelle DA.
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
              <BarChart2 className="text-slate-300 mb-2" size={32} />
              <span>Sélectionnez un fournisseur dans la grille pour afficher sa fiche d'évaluation, ajuster ses indicateurs et consulter ses engagements.</span>
            </div>
          )}
        </div>

      </div>

      {/* REGISTER NEW CONTRACTOR / PARTNER MODAL OVERLAY */}
      {isRegistering && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-100 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Référencer un Nouveau Fournisseur</h3>
                <p className="text-[11px] text-slate-500">Ajoutez les informations de l'entreprise partenaire et initialisez ses critères d'évaluation.</p>
              </div>
              <button 
                onClick={() => setIsRegistering(false)}
                className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 uppercase">Raison Sociale du Fournisseur</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DMJ TECHNOLOGIE SARL"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Contact Référent</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Youssef El Mansouri"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">E-mail Commercial</label>
                  <input
                    type="email"
                    required
                    placeholder="contact@fournisseur.ma"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Secteur / Catégorie d'Achats</label>
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
                    <option value="Maintenance & Bâtiment">Maintenance & Bâtiment</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Niveau de Risque Initial</label>
                  <select
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as any)}
                  >
                    <option value="Low">Faible Risque</option>
                    <option value="Medium">Risque Modéré</option>
                    <option value="High">Risque Élevé</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Score Qualité Initial (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                    value={qualityScore}
                    onChange={(e) => setQualityScore(parseInt(e.target.value) || 90)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Ponctualité / Délais (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                    value={onTimeDelivery}
                    onChange={(e) => setOnTimeDelivery(parseInt(e.target.value) || 92)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="border border-slate-200 text-slate-600 font-semibold px-4.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white font-semibold px-5 py-1.5 rounded-lg text-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  {isSubmitting ? "Enregistrement..." : "Enregistrer le Fournisseur"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
