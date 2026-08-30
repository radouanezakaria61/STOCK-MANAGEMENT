import { Layers, CheckSquare, Square } from "lucide-react";
import type { AssignedResourceType } from "../../types";

const RESOURCE_TYPES: AssignedResourceType[] = [
  "Carte SIM",
  "SmartPhone",
  "PC / Laptop",
  "Autre matériel IT",
  "Carte SIM + SmartPhone",
];

interface ResourceTypeSelectorProps {
  selected: AssignedResourceType;
  onSelect: (type: AssignedResourceType) => void;
}

export default function ResourceTypeSelector({ selected, onSelect }: ResourceTypeSelectorProps) {
  return (
    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-3">
      <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
        <Layers size={13} className="text-emerald-700" /> Ressource Assignée (Formulaire IT-02)
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {RESOURCE_TYPES.map((rType) => (
          <button
            key={rType}
            type="button"
            onClick={() => onSelect(rType)}
            className={`py-2 px-2.5 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px] ${
              selected === rType
                ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {selected === rType ? <CheckSquare size={13} /> : <Square size={13} />}
            <span>{rType}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
