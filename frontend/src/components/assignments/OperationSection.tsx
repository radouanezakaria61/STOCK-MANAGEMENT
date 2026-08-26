import { CheckSquare, Square } from "lucide-react";
import type { OperationType, RestitutedDeviceCondition } from "../../types";

interface OperationSectionProps {
  operationType: OperationType;
  onOperationTypeChange: (v: OperationType) => void;
  restitutionPreviousDevice: "OUI" | "NON";
  onRestitutionPreviousDeviceChange: (v: "OUI" | "NON") => void;
  restitutedDeviceCondition: RestitutedDeviceCondition;
  onRestitutedDeviceConditionChange: (v: RestitutedDeviceCondition) => void;
}

export default function OperationSection({
  operationType,
  onOperationTypeChange,
  restitutionPreviousDevice,
  onRestitutionPreviousDeviceChange,
  restitutedDeviceCondition,
  onRestitutedDeviceConditionChange,
}: OperationSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
          Type d'opération
        </label>
        <div className="flex gap-2">
          {(["AFFECTATION", "RÉAFFECTATION"] as OperationType[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onOperationTypeChange(op)}
              className={`flex-1 py-1.5 px-2 rounded-lg border font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                operationType === op
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              {operationType === op ? <CheckSquare size={11} /> : <Square size={11} />}
              <span>{op}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
          Restitution ancien appareil ?
        </label>
        <div className="flex gap-2">
          {(["OUI", "NON"] as ("OUI" | "NON")[]).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                onRestitutionPreviousDeviceChange(val);
                if (val === "NON") {
                  onRestitutedDeviceConditionChange("Non applicable");
                }
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg border font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 ${
                restitutionPreviousDevice === val
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              {restitutionPreviousDevice === val ? (
                <CheckSquare size={11} />
              ) : (
                <Square size={11} />
              )}
              <span>{val}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">
          État de l'appareil restitué
        </label>
        <select
          value={
            restitutionPreviousDevice === "NON" ? "Non applicable" : restitutedDeviceCondition
          }
          disabled={restitutionPreviousDevice === "NON"}
          onChange={(e) =>
            onRestitutedDeviceConditionChange(e.target.value as RestitutedDeviceCondition)
          }
          className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="Non applicable">Non applicable</option>
          <option value="Bon état">Bon état</option>
          <option value="Cassé mais opérationnel">Cassé mais opérationnel</option>
          <option value="Endommagé">Endommagé</option>
        </select>
      </div>
    </div>
  );
}
