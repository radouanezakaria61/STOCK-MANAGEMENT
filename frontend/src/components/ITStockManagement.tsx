import React, { useState } from "react";
import { ITStockItem, StockMovement, AppUser, StockCategory, StockStatus } from "../types";
import {
  Boxes,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Filter,
  AlertTriangle,
  Laptop,
  Monitor,
  Server,
  Network,
  Cpu,
  Package,
  KeyRound,
  CheckCircle2,
  Clock,
  UserCheck,
  Building,
  Tag,
  Barcode,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Trash2,
  Edit,
  History,
  FileCheck2,
  X,
  ExternalLink,
  ShieldAlert
} from "lucide-react";

interface ITStockManagementProps {
  stockItems: ITStockItem[];
  stockMovements: StockMovement[];
  currentUser: AppUser | null;
  onRefresh: () => void;
  onSelectTab?: (tab: string) => void;
}

export default function ITStockManagement({
  stockItems,
  stockMovements,
  currentUser,
  onRefresh,
  onSelectTab
}: ITStockManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<"inventory" | "movements">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [onlyCritical, setOnlyCritical] = useState<boolean>(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<ITStockItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Item Form State
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    category: "Laptops & Portables" as StockCategory,
    brand: "",
    model: "",
    serialNumber: "",
    quantity: 1,
    minThreshold: 2,
    unitPriceMAD: 0,
    location: "Magasin Central IT (Casablanca)",
    status: "En Stock" as StockStatus,
    fournisseur: "",
    notes: ""
  });

  // Adjust Form State
  const [adjustForm, setAdjustForm] = useState({
    type: "Entrée Achat" as "Entrée Achat" | "Retour Stock" | "Ajustement Inventaire" | "Mise au Rebut",
    quantity: 1,
    notes: ""
  });

  // Format MAD
  const formatMAD = (val: number) => {
    return `${Math.round(val).toLocaleString()} MAD`;
  };

  // KPIs Calculations
  const totalStockValueMAD = stockItems.reduce((sum, item) => sum + item.totalValueMAD, 0);
  const totalUnits = stockItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAvailable = stockItems.reduce((sum, item) => sum + item.availableQty, 0);
  const totalAllocated = stockItems.reduce((sum, item) => sum + item.allocatedQty, 0);
  const criticalItemsCount = stockItems.filter(item => item.availableQty <= item.minThreshold).length;

  // Filtered stock list
  const filteredStock = stockItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.assignedTo?.userName && item.assignedTo.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.fournisseur && item.fournisseur.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesCritical = !onlyCritical || item.availableQty <= item.minThreshold;

    return matchesSearch && matchesCategory && matchesStatus && matchesCritical;
  });

  // Helper Category Icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Laptops & Portables": return <Laptop size={14} className="text-indigo-600" />;
      case "Postes Fixes & Écrans": return <Monitor size={14} className="text-sky-600" />;
      case "Serveurs & Stockage": return <Server size={14} className="text-purple-600" />;
      case "Réseau & Sécurité": return <Network size={14} className="text-emerald-600" />;
      case "Consommables & Pièces": return <Package size={14} className="text-amber-600" />;
      case "Licences & Logiciels": return <KeyRound size={14} className="text-pink-600" />;
      default: return <Cpu size={14} className="text-slate-600" />;
    }
  };

  // 1. Handle Add New Stock Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.name) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItemForm,
          performedBy: currentUser ? `${currentUser.name} (${currentUser.jobTitle})` : "Admin Système"
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewItemForm({
          name: "",
          category: "Laptops & Portables",
          brand: "",
          model: "",
          serialNumber: "",
          quantity: 1,
          minThreshold: 2,
          unitPriceMAD: 0,
          location: "Magasin Central IT (Casablanca)",
          status: "En Stock",
          fournisseur: "",
          notes: ""
        });
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Handle Adjust Movement (Entrée / Retour / Rebut / Ajustement)
  const handleAdjustItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustModal) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/stock/${showAdjustModal.id}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: adjustForm.type,
          quantity: adjustForm.quantity,
          notes: adjustForm.notes,
          performedBy: currentUser ? `${currentUser.name} (${currentUser.jobTitle})` : "Admin IT"
        })
      });
      if (res.ok) {
        setShowAdjustModal(null);
        setAdjustForm({
          type: "Entrée Achat",
          quantity: 1,
          notes: ""
        });
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur lors du mouvement de stock.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Handle Delete Item
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Confirmez-vous la suppression définitive de "${name}" du stock IT ?`)) return;
    try {
      const res = await fetch(`/api/stock/${id}`, { method: "DELETE" });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" id="it-stock-management-root">
      
      {/* 1. TOP HEADER & MAIN METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="it-stock-kpi-row">
        
        {/* Card 1: Total Stock Value */}
        <div className="bg-white rounded-2xl border border-slate-200 border-l-[5px] border-l-indigo-600 p-4.5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Valeur Marchande du Parc</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1.5">{formatMAD(totalStockValueMAD)}</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{totalUnits} matériels & licences valorisés</p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Boxes size={18} />
            </div>
          </div>
        </div>

        {/* Card 2: Units Available */}
        <div className="bg-white rounded-2xl border border-slate-200 border-l-[5px] border-l-emerald-500 p-4.5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Matériels Disponibles</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1.5">{totalAvailable} unités</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Prêts pour affectation immédiate</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        {/* Card 3: Units Allocated */}
        <div className="bg-white rounded-2xl border border-slate-200 border-l-[5px] border-l-sky-500 p-4.5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">En Dotation Collaborateurs</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1.5">{totalAllocated} actifs</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Affectés aux départements de l'entreprise</p>
            </div>
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
              <UserCheck size={18} />
            </div>
          </div>
        </div>

        {/* Card 4: Critical Low Stock */}
        <div className="bg-white rounded-2xl border border-slate-200 border-l-[5px] border-l-amber-500 p-4.5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Alerte Seuil Critique</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1.5">{criticalItemsCount} article(s)</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Niveau de réserve sous le seuil d'alerte</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

      </div>

      {/* 2. ACTION BAR & MAIN CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Subtabs Selector: Inventaire vs Journal des Mouvements */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab("inventory")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "inventory"
                ? "bg-white text-slate-900 shadow-xs font-black"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Boxes size={14} />
            <span>Inventaire & Actifs IT ({stockItems.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab("movements")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "movements"
                ? "bg-white text-slate-900 shadow-xs font-black"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <History size={14} />
            <span>Historique Mouvements ({stockMovements.length})</span>
          </button>
        </div>

        {/* Action Buttons: Add Stock */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Ajouter Article au Stock</span>
          </button>
        </div>

      </div>

      {/* 3. INVENTORY VIEW */}
      {activeSubTab === "inventory" && (
        <div className="space-y-4">
          
          {/* Filters and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Rechercher désignation, N° série, asset tag, marque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            {/* Category and Critical Filters */}
            <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-xl focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Toutes Catégories</option>
                <option value="Laptops & Portables">Laptops & Portables</option>
                <option value="Postes Fixes & Écrans">Postes Fixes & Écrans</option>
                <option value="Serveurs & Stockage">Serveurs & Stockage</option>
                <option value="Réseau & Sécurité">Réseau & Sécurité</option>
                <option value="Périphériques & Accessoires">Périphériques & Accessoires</option>
                <option value="Consommables & Pièces">Consommables & Pièces</option>
                <option value="Licences & Logiciels">Licences & Logiciels</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-xl focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Tous Statuts</option>
                <option value="En Stock">En Stock</option>
                <option value="Affecté">Affecté</option>
                <option value="En Maintenance">En Maintenance</option>
                <option value="Rebut / Fin de vie">Rebut / Fin de vie</option>
              </select>

              <button
                onClick={() => setOnlyCritical(!onlyCritical)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                  onlyCritical
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                <AlertTriangle size={13} />
                <span>Seuil Critique ({criticalItemsCount})</span>
              </button>
            </div>

          </div>

          {/* Stock Items Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Asset Tag / Réf</th>
                    <th className="py-3 px-4">Désignation & Marque</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4 text-center">Quantités (Dispo / Total)</th>
                    <th className="py-3 px-4 text-right">Prix Unitaire & Total (MAD)</th>
                    <th className="py-3 px-4">Emplacement / Affectation</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStock.map((item) => {
                    const isCritical = item.availableQty <= item.minThreshold;
                    const fillPct = item.quantity > 0 ? Math.round((item.availableQty / item.quantity) * 100) : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        {/* Asset Tag & ID */}
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900 font-mono text-[11px]">{item.assetTag}</div>
                          <span className="text-[10px] text-slate-400 font-mono">SN: {item.serialNumber}</span>
                        </td>

                        {/* Name & Model */}
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="font-bold text-slate-800 leading-snug">{item.name}</div>
                          <div className="text-[10.5px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-slate-600">{item.brand}</span>
                            {item.model && <span>• {item.model}</span>}
                            {item.fournisseur && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9.5px]">
                                {item.fournisseur}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold text-slate-700">
                            {getCategoryIcon(item.category)}
                            <span>{item.category}</span>
                          </div>
                        </td>

                        {/* Quantities (Available / Total) */}
                        <td className="py-3 px-4 text-center min-w-[130px]">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            <strong className={`font-black ${isCritical ? "text-amber-600" : "text-emerald-700"}`}>
                              {item.availableQty}
                            </strong>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-700 font-semibold">{item.quantity}</span>
                            <span className="text-[10px] text-slate-400">({item.allocatedQty} affectés)</span>
                          </div>
                          
                          {/* Mini Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCritical ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${fillPct}%` }}
                            ></div>
                          </div>

                          {isCritical && (
                            <span className="text-[9.5px] font-bold text-amber-700 flex items-center justify-center gap-0.5 mt-1">
                              <AlertTriangle size={10} /> Seuil critique (min: {item.minThreshold})
                            </span>
                          )}
                        </td>

                        {/* Price in MAD */}
                        <td className="py-3 px-4 text-right">
                          <div className="font-black text-slate-900">{formatMAD(item.totalValueMAD)}</div>
                          <div className="text-[10px] text-slate-400">{formatMAD(item.unitPriceMAD)} / unité</div>
                        </td>

                        {/* Location / Assignee */}
                        <td className="py-3 px-4 max-w-[180px]">
                          <div className="text-[11px] font-semibold text-slate-700 truncate" title={item.location}>
                            📍 {item.location}
                          </div>
                          {item.assignedTo ? (
                            <div className="text-[10px] text-indigo-700 font-bold mt-0.5 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate">
                              👤 {item.assignedTo.userName} ({item.assignedTo.department})
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 mt-0.5">En réserve magasin</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-block ${
                              item.status === "En Stock"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : item.status === "Affecté"
                                ? "bg-sky-50 text-sky-800 border border-sky-200"
                                : item.status === "En Maintenance"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Adjust / Movement Button */}
                            <button
                              onClick={() => {
                                setShowAdjustModal(item);
                                setAdjustForm({
                                  type: "Entrée Achat",
                                  quantity: 1,
                                  notes: ""
                                });
                              }}
                              className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                              title="Enregistrer un mouvement / Ajuster le stock"
                            >
                              <ArrowUpFromLine size={14} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Supprimer l'article"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Boxes className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-600">Aucun article de stock trouvé</p>
                        <p className="text-xs text-slate-400 mt-1">Ajustez vos filtres ou intégrez une commande d'achat (DA).</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. MOVEMENT LOGS VIEW */}
      {activeSubTab === "movements" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Journal des Mouvements & Entrées/Sorties
              </span>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {stockMovements.length} transactions enregistrées
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Date & Réf Mvt</th>
                  <th className="py-3 px-4">Type de Mouvement</th>
                  <th className="py-3 px-4">Article Concerne</th>
                  <th className="py-3 px-4 text-center">Quantité</th>
                  <th className="py-3 px-4">Opérateur / Bénéficiaire</th>
                  <th className="py-3 px-4">Détails & Justificatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {stockMovements.map((mvt) => {
                  let typeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
                  let TypeIcon = ArrowDownToLine;

                  if (mvt.type === "Sortie Affectation") {
                    typeColor = "bg-sky-50 text-sky-800 border-sky-200";
                    TypeIcon = ArrowUpFromLine;
                  } else if (mvt.type === "Mise au Rebut") {
                    typeColor = "bg-rose-50 text-rose-800 border-rose-200";
                    TypeIcon = Trash2;
                  } else if (mvt.type === "Retour Stock") {
                    typeColor = "bg-purple-50 text-purple-800 border-purple-200";
                    TypeIcon = RefreshCw;
                  }

                  return (
                    <tr key={mvt.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{mvt.date}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{mvt.id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] border ${typeColor}`}>
                          <TypeIcon size={11} />
                          <span>{mvt.type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {mvt.itemName}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900 text-sm">
                        {mvt.type === "Sortie Affectation" || mvt.type === "Mise au Rebut" ? `-${mvt.quantity}` : `+${mvt.quantity}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700">Par : {mvt.performedBy}</div>
                        {mvt.recipient && (
                          <div className="text-[10.5px] text-sky-700 font-bold">
                            Pour : {mvt.recipient} {mvt.department && `(${mvt.department})`}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[240px] truncate">
                        {mvt.notes || "Mouvement standard"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD NEW ITEM MANUALLY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Ajouter un Article au Stock IT
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="py-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Désignation du Matériel *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Dell Latitude 5540 i7 32GB"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Catégorie</label>
                  <select
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value as StockCategory })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="Laptops & Portables">Laptops & Portables</option>
                    <option value="Postes Fixes & Écrans">Postes Fixes & Écrans</option>
                    <option value="Serveurs & Stockage">Serveurs & Stockage</option>
                    <option value="Réseau & Sécurité">Réseau & Sécurité</option>
                    <option value="Périphériques & Accessoires">Périphériques & Accessoires</option>
                    <option value="Consommables & Pièces">Consommables & Pièces</option>
                    <option value="Licences & Logiciels">Licences & Logiciels</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Marque / Constructeur</label>
                  <input
                    type="text"
                    placeholder="ex: Dell, Lenovo, Cisco, HP"
                    value={newItemForm.brand}
                    onChange={(e) => setNewItemForm({ ...newItemForm, brand: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Quantité Initiale</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Seuil d'Alerte</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemForm.minThreshold}
                    onChange={(e) => setNewItemForm({ ...newItemForm, minThreshold: parseInt(e.target.value) || 1 })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Prix Unitaire (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemForm.unitPriceMAD}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unitPriceMAD: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Emplacement Magasin</label>
                  <input
                    type="text"
                    value={newItemForm.location}
                    onChange={(e) => setNewItemForm({ ...newItemForm, location: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">N° de Série (Optionnel)</label>
                  <input
                    type="text"
                    placeholder="ex: SN-Dell-98124"
                    value={newItemForm.serialNumber}
                    onChange={(e) => setNewItemForm({ ...newItemForm, serialNumber: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
                >
                  Enregistrer l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ADJUST STOCK / RECORD MOVEMENT */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="text-indigo-600" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Enregistrer un Mouvement de Stock
                </h3>
              </div>
              <button
                onClick={() => setShowAdjustModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustItem} className="py-4 space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-black">Article</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{showAdjustModal.name}</p>
                <p className="text-[11px] text-slate-500">
                  Stock Total : {showAdjustModal.quantity} • Disponible : {showAdjustModal.availableQty} • Affecté : {showAdjustModal.allocatedQty}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Type de Mouvement</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as typeof adjustForm.type })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-bold"
                >
                  <option value="Entrée Achat">📥 Entrée Achat (Réception fournisseur supplémentaire)</option>
                  <option value="Retour Stock">🔄 Retour Stock (Restitution matériel collaborateur)</option>
                  <option value="Ajustement Inventaire">⚖️ Ajustement Inventaire (Régularisation suite à comptage)</option>
                  <option value="Mise au Rebut">🗑️ Mise au Rebut / Fin de cycle</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Quantité</label>
                <input
                  type="number"
                  min="1"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Remarques / Justificatif</label>
                <input
                  type="text"
                  placeholder="ex: Réception complémentaire de livraison, retour départ collaborateur..."
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
                >
                  Valider le Mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
