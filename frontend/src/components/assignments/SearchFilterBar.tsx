import { Search, Plus } from "lucide-react";
import type { MaterialAssignment } from "../../types";

interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeSubTab: "all" | "active" | "returned";
  onSubTabChange: (tab: "all" | "active" | "returned") => void;
  assignments: MaterialAssignment[];
  onCreateClick: () => void;
}

export default function SearchFilterBar({
  searchTerm,
  onSearchChange,
  activeSubTab,
  onSubTabChange,
  assignments,
  onCreateClick,
}: SearchFilterBarProps) {
  const activeCount = assignments.filter((a) => a.status === "Active").length;
  const returnedCount = assignments.filter((a) => a.status === "Restitué").length;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="relative w-full md:w-80">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={15}
        />
        <input
          type="text"
          placeholder="Rechercher par nom, CIN, N° série, référence..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
        />
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => onSubTabChange("all")}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Toutes ({assignments.length})
          </button>
          <button
            onClick={() => onSubTabChange("active")}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === "active"
                ? "bg-white text-indigo-600 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            En cours ({activeCount})
          </button>
          <button
            onClick={() => onSubTabChange("returned")}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === "returned"
                ? "bg-white text-slate-800 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Restituées ({returnedCount})
          </button>
        </div>

        <button
          onClick={onCreateClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
        >
          <Plus size={14} /> Nouvelle Fiche d'Affectation
        </button>
      </div>
    </div>
  );
}
