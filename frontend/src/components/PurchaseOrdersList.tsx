import React, { useState } from "react";
import { PurchaseOrder, Vendor, AppUser } from "../types";
import { exportPurchaseOrderToPDF } from "../utils/pdfGenerator";
import { Search, Plus, Filter, FileText, Check, X, ClipboardList, Calendar, ShieldCheck, Trash2, Lock, AlertTriangle, Download, Printer } from "lucide-react";

interface PurchaseOrdersListProps {
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  departments: string[];
  currentUser?: AppUser | null;
  onCreatePO: (po: any) => Promise<void>;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}

export default function PurchaseOrdersList({
  purchaseOrders,
  vendors,
  departments,
  currentUser,
  onCreatePO,
  onUpdateStatus,
}: PurchaseOrdersListProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // New PO Form Fields
  const [title, setTitle] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [department, setDepartment] = useState(departments[0] || "");
  const [requester, setRequester] = useState("");
  const [notes, setNotes] = useState("");
  
  // Dynamic line items helper
  const [formItems, setFormItems] = useState<{ desc: string; qty: number; unitPrice: number }[]>([
    { desc: "", qty: 1, unitPrice: 0 }
  ]);

  const handleAddLineItem = () => {
    setFormItems([...formItems, { desc: "", qty: 1, unitPrice: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, idx) => idx !== index));
    }
  };

  const handleUpdateItemField = (index: number, field: string, value: any) => {
    const fresh = [...formItems];
    fresh[index] = { ...fresh[index], [field]: value };
    setFormItems(fresh);
  };

  // Submit PO
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedVendorId || !requester) {
      alert("Veuillez renseigner le titre de la DA, le fournisseur et l'initiateur.");
      return;
    }

    setIsSubmitting(true);
    // Calc total
    const computedItems = formItems.map(item => ({
      desc: item.desc || "Article / Fourniture standard",
      qty: Math.max(1, parseInt(item.qty as any) || 1),
      unitPrice: Math.max(0, parseFloat(item.unitPrice as any) || 0),
      total: (Math.max(1, parseInt(item.qty as any) || 1)) * (Math.max(0, parseFloat(item.unitPrice as any) || 0))
    }));
    const totalAmount = computedItems.reduce((acc, item) => acc + item.total, 0);

    try {
      await onCreatePO({
        title,
        vendorId: selectedVendorId,
        amount: totalAmount,
        department,
        requester,
        items: computedItems,
        notes
      });
      // Reset
      setTitle("");
      setSelectedVendorId("");
      setRequester("");
      setNotes("");
      setFormItems([{ desc: "", qty: 1, unitPrice: 0 }]);
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Translation Map
  const statusLabels: Record<string, string> = {
    "ALL": "Tous les statuts",
    "Draft": "Brouillon",
    "Pending Approval": "En attente de validation",
    "Approved": "Validée",
    "Fulfilled": "Exécutée",
    "Declined": "Rejetée",
    "Cancelled": "Annulée"
  };

  // Filtered List
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch =
      po.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.requester.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // RBAC checks
  const canCreate = !currentUser || (currentUser.status === "Actif" && currentUser.permissions?.canCreatePO);
  const canApprove =
    !currentUser ||
    (currentUser.status === "Actif" &&
      currentUser.permissions?.canApprovePO &&
      (currentUser.spendingLimitMAD === 0 || selectedPO?.amount <= currentUser.spendingLimitMAD));

  let approvalBlockReason = "";
  if (currentUser && selectedPO) {
    if (currentUser.status !== "Actif") {
      approvalBlockReason = `Compte ${currentUser.status.toLowerCase()} : actions désactivées.`;
    } else if (!currentUser.permissions?.canApprovePO) {
      approvalBlockReason = "Habilitation d'approbation non accordée pour ce profil.";
    } else if (currentUser.spendingLimitMAD > 0 && selectedPO.amount > currentUser.spendingLimitMAD) {
      approvalBlockReason = `Montant (${selectedPO.amount.toLocaleString()} MAD) supérieur à votre plafond autorisé (${currentUser.spendingLimitMAD.toLocaleString()} MAD).`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Registre des Demandes d'Achat & Engagements (DA)</h2>
          <p className="text-xs text-slate-500">Suivi, audit et validation des dépenses et engagements budgétaires en Dirhams (MAD).</p>
        </div>
        <button
          onClick={() => {
            if (canCreate) {
              setRequester(currentUser?.name || "");
              setIsCreating(true);
            }
          }}
          disabled={!canCreate}
          title={!canCreate ? "Votre rôle ou statut ne permet pas de créer de demande d'achat" : ""}
          className={`text-xs font-semibold px-4.5 py-2 rounded-lg flex items-center gap-2 transition ${
            canCreate
              ? "bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <Plus size={16} />
          Créer une Demande d'Achat (DA)
        </button>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Rechercher par N° DA, intitulé, fournisseur ou demandeur..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
            <Filter size={14} /> Filtre :
          </span>
          {["ALL", "Pending Approval", "Approved", "Fulfilled", "Declined"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-[11px] px-3 py-1 rounded-full border transition-colors shrink-0 font-medium cursor-pointer ${
                statusFilter === status
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {statusLabels[status] || status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PURCHASE ORDERS GRID LIST */}
        <div className="lg:col-span-2 space-y-3">
          {filteredPOs.length > 0 ? (
            filteredPOs.map((po) => {
              const colors = {
                "Draft": "bg-slate-100 text-slate-700 border-slate-200",
                "Pending Approval": "bg-amber-50 text-amber-900 border-amber-200",
                "Approved": "bg-emerald-50 text-emerald-800 border-emerald-200",
                "Fulfilled": "bg-indigo-50 text-indigo-800 border-indigo-200",
                "Declined": "bg-red-50 text-red-700 border-red-200",
                "Cancelled": "bg-slate-100 text-slate-500 border-slate-200",
              }[po.status] || "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <div
                  key={po.id}
                  onClick={() => setSelectedPO(po)}
                  className={`bg-white rounded-xl border p-4 hover:shadow-xs transition-all cursor-pointer ${
                    selectedPO?.id === po.id
                      ? "border-indigo-500 ring-2 ring-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">{po.id}</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${colors}`}>
                          {statusLabels[po.status] || po.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 mt-1.5">{po.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Fournisseur : <span className="font-semibold text-slate-700">{po.vendorName}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 font-mono">{po.amount.toLocaleString()} MAD</p>
                      <p className="text-[9px] text-slate-400 mt-1">{po.createdDate}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
                    <div className="flex gap-4">
                      <span>Dép. : <strong className="text-slate-700">{po.department}</strong></span>
                      <span>Par : <strong className="text-slate-700">{po.requester}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400">Conformité :</span>
                        <span className={`font-bold ${po.auditScore >= 85 ? "text-emerald-600" : po.auditScore >= 70 ? "text-amber-500" : "text-red-500"}`}>
                          {po.auditScore}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportPurchaseOrderToPDF(po);
                        }}
                        title="Télécharger le Bon de Commande officiel en PDF"
                        className="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold px-2 py-0.5 rounded border border-slate-200 hover:border-indigo-300 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Download size={11} />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              Aucune demande d'achat trouvée pour ces critères de recherche.
            </div>
          )}
        </div>

        {/* PURCHASE GENERAL DETAILED DRAW */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs h-fit sticky top-6">
          {selectedPO ? (
            <div className="space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 font-semibold">{selectedPO.id}</div>
                  <h3 className="text-xs font-bold text-slate-800 mt-1">{selectedPO.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportPurchaseOrderToPDF(selectedPO)}
                    title="Télécharger le Bon de Commande (PDF)"
                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 text-xs flex items-center gap-1 font-bold cursor-pointer transition"
                  >
                    <Download size={13} />
                    <span>PDF</span>
                  </button>
                  <button 
                    onClick={() => setSelectedPO(null)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">MONTANT ENGAGÉ</span>
                  <strong className="text-sm font-bold text-slate-800 font-mono">{selectedPO.amount.toLocaleString()} MAD</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">INDICE DE CONFORMITÉ</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck size={14} className={selectedPO.auditScore >= 80 ? "text-emerald-600" : "text-amber-500"} />
                    <strong className="font-bold">{selectedPO.auditScore}/100</strong>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-dashed border-slate-100 pb-1">
                  <ClipboardList size={13} /> Détail des Postes / Articles
                </h4>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                  {selectedPO.items.map((item, index) => (
                    <div key={index} className="py-2 flex justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{item.desc}</p>
                        <p className="text-[10px] text-slate-400">Qté {item.qty} × {item.unitPrice.toLocaleString()} MAD</p>
                      </div>
                      <span className="font-semibold text-slate-700 font-mono">{item.total.toLocaleString()} MAD</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aux logs */}
              <div className="space-y-2 text-xs">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Historique & Suivi</h4>
                <div className="space-y-2 border-l border-slate-200 pl-3.5 pt-1.5">
                  <div className="relative">
                    <span className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
                    <p className="text-[11px] font-bold text-slate-700">Demande enregistrée</p>
                    <p className="text-[9px] text-slate-500">{selectedPO.createdDate} par {selectedPO.requester}</p>
                  </div>
                  {selectedPO.status !== "Pending Approval" && (
                    <div className="relative mt-2">
                      <span className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 bg-emerald-600 rounded-full"></span>
                      <p className="text-[11px] font-bold text-slate-700">Changement de statut</p>
                      <p className="text-[9px] text-slate-400">Statut : {statusLabels[selectedPO.status] || selectedPO.status}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedPO.notes && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-[11px] text-slate-600">
                  <strong className="block text-slate-500 mb-0.5 font-semibold">COMMENTAIRES & OBSERVATIONS</strong>
                  {selectedPO.notes}
                </div>
              )}

              {/* Authorize buttons */}
              {selectedPO.status === "Pending Approval" && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {!canApprove && approvalBlockReason && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
                      <Lock size={14} className="text-amber-600 shrink-0" />
                      <span>{approvalBlockReason}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (canApprove) {
                          await onUpdateStatus(selectedPO.id, "Approved");
                          setSelectedPO(null);
                        }
                      }}
                      disabled={!canApprove}
                      className={`flex-1 font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                        canApprove
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Check size={14} /> Valider la Demande
                    </button>
                    <button
                      onClick={async () => {
                        if (canApprove) {
                          await onUpdateStatus(selectedPO.id, "Declined");
                          setSelectedPO(null);
                        }
                      }}
                      disabled={!canApprove}
                      className={`flex-1 border font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                        canApprove
                          ? "border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          : "border-slate-200 text-slate-300 cursor-not-allowed"
                      }`}
                    >
                      <X size={14} /> Rejeter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
              <FileText className="text-slate-300 mb-2" size={32} />
              <span>Sélectionnez une demande d'achat dans la liste pour consulter les lignes budgétaires, l'audit de conformité et procéder à la validation.</span>
            </div>
          )}
        </div>

      </div>

      {/* CREATE NEW PURCHASE STATEMENT MODAL OVERLAY */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-100 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Émettre une Demande d'Achat (DA)</h3>
                <p className="text-[11px] text-slate-500">Renseignez les détails de la dépense pour engagement budgétaire en Dirhams (MAD).</p>
              </div>
              <button 
                onClick={() => setIsCreating(false)}
                className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Intitulé de la Demande</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Serveurs Cloud ou Mobilier Ergonomique"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Demandeur / Initiateur</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Zakaria Radouane (DSI)"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={requester}
                    onChange={(e) => setRequester(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Fournisseur Sélectionné</label>
                  <select
                    required
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                  >
                    <option value="">-- Choisir un fournisseur référencé --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category} • Risque: {v.riskLevel === "High" ? "Élevé" : v.riskLevel === "Medium" ? "Modéré" : "Faible"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Département d'Imputation</label>
                  <select
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Itemized list generator */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">Décomposition des Lignes & Articles</label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Ajouter une Ligne
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-0.5">
                  {formItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder="Désignation de l'article / spécification"
                        className="flex-3 text-xs p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                        value={item.desc}
                        onChange={(e) => handleUpdateItemField(index, "desc", e.target.value)}
                      />
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Qté"
                        className="flex-1 text-xs p-2 border border-slate-200 rounded-lg w-16"
                        value={item.qty}
                        onChange={(e) => handleUpdateItemField(index, "qty", e.target.value)}
                      />
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="Prix Unit. (MAD)"
                        className="flex-2 text-xs p-2 border border-slate-200 rounded-lg w-28"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItemField(index, "unitPrice", e.target.value)}
                      />
                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 uppercase">Notes & Conditions Spécifiques</label>
                <textarea
                  rows={2}
                  placeholder="Détails concernant les conditions de livraison, remises négociées ou exigences particulières..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-between items-center bg-white">
                <div className="text-xs text-slate-500">
                  Total Estimé de la DA :{" "}
                  <strong className="text-slate-900 font-bold font-mono">
                    {formItems
                      .reduce((sum, item) => sum + (parseFloat(item.unitPrice as any) || 0) * (parseInt(item.qty as any) || 0), 0)
                      .toLocaleString()}{" "}
                    MAD
                  </strong>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="border border-slate-200 text-slate-600 font-semibold px-4.5 py-2 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-indigo-600 text-white font-semibold px-5 py-2 rounded-lg text-xs hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Enregistrement..." : "Créer la Demande d'Achat"}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
