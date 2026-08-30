import { User } from "lucide-react";
import type { AppUser } from "../../types";

interface BeneficiarySectionProps {
  formBeneficiaryName: string;
  onNameChange: (v: string) => void;
  formBeneficiaryCin: string;
  onCinChange: (v: string) => void;
  formBeneficiaryJob: string;
  onJobChange: (v: string) => void;
  formBeneficiaryDept: string;
  onDeptChange: (v: string) => void;
  formBeneficiarySite: string;
  onSiteChange: (v: string) => void;
  formAssignedDate: string;
  onDateChange: (v: string) => void;
  users: AppUser[];
  onSelectUser: (name: string) => void;
}

export default function BeneficiarySection({
  formBeneficiaryName,
  onNameChange,
  formBeneficiaryCin,
  onCinChange,
  formBeneficiaryJob,
  onJobChange,
  formBeneficiaryDept,
  onDeptChange,
  formBeneficiarySite,
  onSiteChange,
  formAssignedDate,
  onDateChange,
  users,
  onSelectUser,
}: BeneficiarySectionProps) {
  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <User size={13} className="text-indigo-600" /> Informations du Bénéficiaire
        </span>
        {users.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Remplir depuis :</span>
            <select
              onChange={(e) => onSelectUser(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1"
              defaultValue=""
            >
              <option value="" disabled>
                Sélectionner un collaborateur...
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name} ({u.department})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Nom & Prénom *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Sarah Bennani"
            value={formBeneficiaryName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            N° CIN / Matricule
          </label>
          <input
            type="text"
            placeholder="Ex: BE892341"
            value={formBeneficiaryCin}
            onChange={(e) => onCinChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Fonction / Poste *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Responsable Commercial / Tech"
            value={formBeneficiaryJob}
            onChange={(e) => onJobChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Département *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: BU - Comm / DSI / Finance"
            value={formBeneficiaryDept}
            onChange={(e) => onDeptChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Site / Localisation *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Berrechid / Casablanca / Tanger"
            value={formBeneficiarySite}
            onChange={(e) => onSiteChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            Date d'Affectation *
          </label>
          <input
            type="date"
            required
            value={formAssignedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>
    </div>
  );
}
