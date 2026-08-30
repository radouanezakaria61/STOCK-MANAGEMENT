import { Smartphone } from "lucide-react";
import type { AssignedResourceType } from "../../types";

interface SmartphoneDetailsSectionProps {
  resourceType: AssignedResourceType;
  deviceBrand: string;
  onBrandChange: (v: string) => void;
  deviceImei: string;
  onImeiChange: (v: string) => void;
  deviceModel: string;
  onModelChange: (v: string) => void;
  deviceConfiguration: string;
  onConfigurationChange: (v: string) => void;
}

export default function SmartphoneDetailsSection({
  resourceType,
  deviceBrand,
  onBrandChange,
  deviceImei,
  onImeiChange,
  deviceModel,
  onModelChange,
  deviceConfiguration,
  onConfigurationChange,
}: SmartphoneDetailsSectionProps) {
  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <Smartphone size={13} className="text-indigo-600" /> Informations Matériel (Appareil / PC)
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Marque</label>
          <input
            type="text"
            placeholder="Ex: HP, Dell, Samsung, Lenovo"
            value={deviceBrand}
            onChange={(e) => onBrandChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {resourceType === "SmartPhone"
              ? "IMEI"
              : resourceType === "PC / Laptop"
                ? "N° Série / Service Tag"
                : "N° Série / IMEI"}
          </label>
          <input
            type="text"
            placeholder="Ex: 356789104523120 ou 5CD..."
            value={deviceImei}
            onChange={(e) => onImeiChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono font-bold text-indigo-700"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Modèle</label>
          <input
            type="text"
            placeholder="Ex: EliteBook 840 G8, Galaxy A54"
            value={deviceModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Configuration
          </label>
          <input
            type="text"
            placeholder="Ex: i7 16GB 512GB SSD"
            value={deviceConfiguration}
            onChange={(e) => onConfigurationChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>
    </div>
  );
}
