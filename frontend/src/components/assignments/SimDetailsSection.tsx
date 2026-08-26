import { Radio } from "lucide-react";
import type { TelecomOperator } from "../../types";

interface SimDetailsSectionProps {
  simOperator: TelecomOperator;
  onOperatorChange: (v: TelecomOperator) => void;
  simPhoneNumber: string;
  onPhoneNumberChange: (v: string) => void;
  simPuk: string;
  onPukChange: (v: string) => void;
  simPin: string;
  onPinChange: (v: string) => void;
}

export default function SimDetailsSection({
  simOperator,
  onOperatorChange,
  simPhoneNumber,
  onPhoneNumberChange,
  simPuk,
  onPukChange,
  simPin,
  onPinChange,
}: SimDetailsSectionProps) {
  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <Radio size={13} className="text-indigo-600" /> Informations Carte SIM
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Opérateur Télécom
          </label>
          <select
            value={simOperator}
            onChange={(e) => onOperatorChange(e.target.value as TelecomOperator)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
          >
            <option value="IAM">IAM (Maroc Telecom)</option>
            <option value="INWI">INWI</option>
            <option value="ORANGE">ORANGE</option>
            <option value="AUTRE">AUTRE</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            N° de Téléphone
          </label>
          <input
            type="tel"
            placeholder="06 XX XX XX XX"
            value={simPhoneNumber}
            onChange={(e) => onPhoneNumberChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono font-bold"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Code PUK
          </label>
          <input
            type="text"
            placeholder="Ex: 87462910"
            value={simPuk}
            onChange={(e) => onPukChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Code PIN
          </label>
          <input
            type="text"
            placeholder="Ex: 0000"
            value={simPin}
            onChange={(e) => onPinChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
          />
        </div>
      </div>
    </div>
  );
}
