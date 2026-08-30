import { CheckCircle2, Laptop, RotateCcw, ShieldCheck } from "lucide-react";
import type { ITStockItem, MaterialAssignment } from "../../types";

interface SummaryCardsProps {
  assignments: MaterialAssignment[];
  stockItems: ITStockItem[];
}

export default function SummaryCards({ assignments, stockItems }: SummaryCardsProps) {
  const activeCount = assignments.filter((a) => a.status === "Active").length;
  const returnedCount = assignments.filter((a) => a.status === "Restitué").length;
  const totalItemsAllocated = assignments
    .filter((a) => a.status === "Active")
    .reduce((acc, a) => acc + a.items.length, 0);
  const availableCount = stockItems.filter(
    (item) => item.availableQty > 0 || item.status === "En Stock"
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Affectations Actives
          </span>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{activeCount}</h3>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
            <CheckCircle2 size={12} /> Collaborateurs dotés
          </span>
        </div>
        <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
          <CheckCircle2 size={22} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Matériels en Circulation
          </span>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">{totalItemsAllocated}</h3>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5">
            PC, Écrans & Périphériques
          </span>
        </div>
        <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
          <Laptop size={22} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Restitutions & Retours
          </span>
          <h3 className="text-2xl font-black text-slate-800 mt-1">{returnedCount}</h3>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5">
            Décharges clôturées DSI
          </span>
        </div>
        <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
          <RotateCcw size={22} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Stock Disponible
          </span>
          <h3 className="text-2xl font-black text-emerald-700 mt-1">{availableCount}</h3>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5">
            Équipements prêts à doter
          </span>
        </div>
        <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
          <ShieldCheck size={22} />
        </div>
      </div>
    </div>
  );
}
