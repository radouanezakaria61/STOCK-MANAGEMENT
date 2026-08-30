import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../api";
import {
  Search,
  X,
  Check,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  PackageCheck,
  Laptop,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Package,
} from "lucide-react";
import type { ITStockItem, AssignedItemDetail } from "../../types";

interface StockSearchResult {
  items: ITStockItem[];
  pagination: { page: number; limite: number; total: number; pages: number };
}

interface StockSelectorProps {
  selectedItems: ITStockItem[];
  selectedItemIds: string[];
  onToggleItem: (item: ITStockItem) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  itemConditionMap: Record<string, AssignedItemDetail["condition"]>;
  onSetCondition: (id: string, cond: AssignedItemDetail["condition"]) => void;
  itemAccessoriesMap: Record<string, string[]>;
  onToggleAccessory: (id: string, acc: string) => void;
}

const CATEGORIES = [
  "Tous",
  "Laptops & Portables",
  "Postes Fixes & Écrans",
  "Périphériques & Accessoires",
  "Serveurs & Stockage",
  "Réseau & Sécurité",
];

const ACCESSORY_OPTIONS = [
  "Chargeur secteur d'origine",
  "Câble d'alimentation",
  "Sacoche de transport",
  "Souris sans fil",
  "Câble HDMI",
  "Clavier USB",
  "Adaptateur USB/RJ45",
  "Hub USB-C",
  "Cadenas de sécurité",
];

export default function StockSelector({
  selectedItems,
  selectedItemIds,
  onToggleItem,
  onRemoveItem,
  onClearAll,
  itemConditionMap,
  onSetCondition,
  itemAccessoriesMap,
  onToggleAccessory,
}: StockSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [results, setResults] = useState<StockSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const fetchStock = useCallback(
    async (p: number, q: string, cat: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limite: String(LIMIT),
        });
        if (q.trim()) params.set("q", q.trim());
        if (cat && cat !== "Tous") params.set("category", cat);
        params.set("availableOnly", "true");

        const res = await apiFetch(`/api/stock/search?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data as StockSearchResult);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      fetchStock(page, searchQuery, categoryFilter);
    }
  }, [isOpen, page, categoryFilter, fetchStock]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchStock(1, searchQuery, categoryFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, fetchStock]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  const pagination = results?.pagination;
  const items = results?.items ?? [];

  return (
    <>
      {/* Trigger button */}
      <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Package size={14} className="text-indigo-600" />
              Sélection du matériel depuis le Stock IT
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Recherchez et sélectionnez les équipements à affecter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedItemIds.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                <PackageCheck size={13} />
                {selectedItemIds.length} sélectionné(s)
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Search size={14} />
              {selectedItemIds.length > 0
                ? "Modifier la sélection"
                : "Ouvrir la sélection de stock"}
            </button>
          </div>
        </div>
      </div>

      {/* Selected items detail (always visible) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            Matériels IT Sélectionnés pour la Décharge ({selectedItemIds.length}) *
          </span>
          {selectedItemIds.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={12} /> Tout désélectionner
            </button>
          )}
        </div>

        {selectedItemIds.length === 0 ? (
          <div className="p-4 bg-indigo-50/60 border border-dashed border-indigo-200 rounded-xl text-center space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
              <Laptop size={16} />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Aucun matériel sélectionné
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Cliquez sur « Ouvrir la sélection de stock » pour rechercher et
              choisir les équipements à inclure dans cette fiche.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedItems.map((item, index) => {
              const currentCondition =
                itemConditionMap[item.id] || "Neuf / Excellent état";
              const currentAccessories = itemAccessoriesMap[item.id] || [
                "Chargeur secteur d'origine",
                "Câble d'alimentation",
              ];

              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-xs space-y-3 transition hover:border-indigo-200"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {item.name}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-100">
                            {item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono">
                          <span>
                            N° Série :{" "}
                            <strong className="text-slate-800">
                              {item.serialNumber || "—"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Asset :{" "}
                            <strong className="text-indigo-600">
                              {item.assetTag || item.id}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                      title="Retirer cet équipement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Processeur (CPU)
                      </span>
                      <span className="font-semibold text-slate-900 text-xs">
                        {item.specs?.cpu || "Intel Core"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Mémoire RAM
                      </span>
                      <span className="font-semibold text-slate-900 text-xs">
                        {item.specs?.ram || "—"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Stockage (SSD/HDD)
                      </span>
                      <span className="font-semibold text-slate-900 text-xs">
                        {item.specs?.storage || "—"}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        État du matériel
                      </label>
                      <select
                        value={currentCondition}
                        onChange={(e) =>
                          onSetCondition(
                            item.id,
                            e.target.value as AssignedItemDetail["condition"]
                          )
                        }
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      >
                        <option value="Neuf / Excellent état">
                          Neuf / Excellent état
                        </option>
                        <option value="Très bon état">Très bon état</option>
                        <option value="Bon état">Bon état d'usage</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Accessoires & Éléments inclus :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCESSORY_OPTIONS.map((acc) => {
                        const isChecked = currentAccessories.includes(acc);
                        return (
                          <button
                            key={acc}
                            type="button"
                            onClick={() => onToggleAccessory(item.id, acc)}
                            className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                              isChecked
                                ? "bg-indigo-50 text-indigo-800 border-indigo-300 font-bold"
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare size={12} className="text-indigo-600" />
                            ) : (
                              <Square size={12} />
                            )}
                            <span>{acc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Server-side stock search with pagination */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <Search size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Sélection de matériel IT depuis le stock
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {pagination
                      ? `${pagination.total} article(s) disponible(s)`
                      : "Recherchez et cochez les équipements à affecter"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search bar + category pills */}
            <div className="px-5 pt-4 pb-3 space-y-2.5 shrink-0">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, SN, asset, modèle, CPU, RAM..."
                  autoFocus
                  className="w-full pl-9 pr-8 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px] flex items-center gap-1 ${
                      categoryFilter === cat
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
              {loading && items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  Chargement du stock...
                </div>
              ) : items.length === 0 ? (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle
                    size={16}
                    className="text-amber-600 shrink-0"
                  />
                  <span>
                    Aucun équipement disponible ne correspond à votre recherche.
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1 mb-1">
                    <span>
                      Page {pagination?.page}/{pagination?.pages} —{" "}
                      {pagination?.total} résultat(s)
                    </span>
                    {loading && (
                      <span className="text-indigo-600">Actualisation...</span>
                    )}
                  </div>
                  {items.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => onToggleItem(item)}
                        className={`p-3 rounded-lg border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-indigo-50/90 border-indigo-400 shadow-xs ring-1 ring-indigo-400"
                            : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 mt-0.5 sm:mt-0 rounded flex items-center justify-center border shrink-0 transition ${
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white border-slate-300 text-transparent"
                            }`}
                          >
                            <Check size={12} className="stroke-[3]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {item.name}
                              </h4>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200">
                                {item.category}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              <span>
                                SN :{" "}
                                <strong className="font-mono text-slate-800">
                                  {item.serialNumber || "—"}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Asset :{" "}
                                <strong className="font-mono text-indigo-700">
                                  {item.assetTag || item.id}
                                </strong>
                              </span>
                              {item.specs?.cpu && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">
                                    CPU: {item.specs.cpu}
                                  </span>
                                </>
                              )}
                              {item.specs?.ram && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">
                                    RAM: {item.specs.ram}
                                  </span>
                                </>
                              )}
                              {item.specs?.storage && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">
                                    SSD: {item.specs.storage}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                            Dispo: {item.availableQty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleItem(item);
                            }}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200"
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check size={12} />
                                <span>Ajouté</span>
                              </>
                            ) : (
                              <>
                                <SlidersHorizontal size={12} />
                                <span>Ajouter</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Pagination footer */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Précédent
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page {pagination.page} sur {pagination.pages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.pages, p + 1))
                  }
                  disabled={page >= pagination.pages}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                >
                  Suivant
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
