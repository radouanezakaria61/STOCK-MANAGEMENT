import {
  FileCheck2,
  Printer,
  RotateCcw,
  User,
  Calendar,
  Layers,
  Laptop,
  Smartphone,
  Radio,
  Eye,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { MaterialAssignment } from "../../types";

interface AssignmentsTableProps {
  assignments: MaterialAssignment[];
  onViewPdf: (assignment: MaterialAssignment) => void;
  onReturn: (assignment: MaterialAssignment) => void;
  onViewReturnPdf: (assignment: MaterialAssignment) => void;
  onReassign?: (assignment: MaterialAssignment) => void;
}

export default function AssignmentsTable({
  assignments,
  onViewPdf,
  onReturn,
  onViewReturnPdf,
  onReassign,
}: AssignmentsTableProps) {
  if (assignments.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="py-10 text-center text-slate-400">
          <FileCheck2 size={32} className="mx-auto mb-2 text-slate-300" />
          Aucune fiche d'affectation ne correspond à vos critères.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Réf. Fiche</th>
              <th className="py-3 px-4">Bénéficiaire & CIN</th>
              <th className="py-3 px-4">Département & Fonction</th>
              <th className="py-3 px-4">Matériels Affectés</th>
              <th className="py-3 px-4">Date Affectation</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {assignments.map((assignment) => {
              const isActive = assignment.status === "Active";
              return (
                <tr key={assignment.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                    <div className="flex items-center gap-1.5">
                      <span>{assignment.reference}</span>
                      {(assignment.templateType === "DISTRA_SIM_SMARTPHONE" ||
                        assignment.resourceType) && (
                        <span className="text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          IT-02
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      {assignment.beneficiaryName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {assignment.beneficiaryCin
                        ? `CIN/Mat: ${assignment.beneficiaryCin}`
                        : assignment.beneficiaryEmail || assignment.beneficiaryPhone}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">
                      {assignment.beneficiaryDepartment}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>{assignment.beneficiaryJobTitle}</span>
                      {assignment.beneficiarySite && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          • {assignment.beneficiarySite}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {(assignment.templateType === "DISTRA_SIM_SMARTPHONE" ||
                      assignment.resourceType) ? (
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Layers size={11} className="text-emerald-600" />
                          <span>{assignment.resourceType || "Carte SIM + SmartPhone"}</span>
                        </div>
                        {assignment.simPhoneNumber && (
                          <div className="flex items-center gap-1.5 text-slate-700 text-[11px]">
                            <Radio size={11} className="text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-900">
                              {assignment.simOperator || "SIM"}:
                            </span>
                            <span className="font-mono text-slate-600">
                              {assignment.simPhoneNumber}
                            </span>
                          </div>
                        )}
                        {assignment.deviceBrand && (
                          <div className="flex items-center gap-1.5 text-slate-700 text-[11px]">
                            <Smartphone size={11} className="text-indigo-600 shrink-0" />
                            <span className="font-semibold text-slate-900">
                              {assignment.deviceBrand} {assignment.deviceModel}
                            </span>
                            {assignment.deviceImei && (
                              <span className="text-[10px] bg-slate-100 border border-slate-200 px-1 rounded font-mono text-slate-600">
                                {assignment.deviceImei}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {assignment.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                            <Laptop size={12} className="text-indigo-500 shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {item.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 border border-slate-200 px-1 rounded-sm text-slate-600 font-mono">
                              {item.serialNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      {new Date(assignment.assignedDate).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        En Dotation
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <CheckCircle2 size={11} className="text-slate-500" />
                        Restitué
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {isActive ? (
                        <>
                          <button
                            onClick={() => onViewPdf(assignment)}
                            title="Consulter la Fiche d'Affectation, Imprimer ou Télécharger en PDF"
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-indigo-200 cursor-pointer shadow-2xs"
                          >
                            <FileCheck2 size={13} className="text-indigo-600" />
                            <span>Fiche d'Affectation (PDF)</span>
                          </button>
                          <button
                            onClick={() => onReturn(assignment)}
                            title="Enregistrer la Restitution / Retour du Matériel"
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-amber-200 cursor-pointer shadow-2xs"
                          >
                            <RotateCcw size={13} className="text-amber-600" />
                            <span>Restituer</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onViewReturnPdf(assignment)}
                            title="Consulter le Procès-Verbal de Décharge"
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-amber-200 cursor-pointer shadow-2xs"
                          >
                            <Printer size={13} className="text-amber-700" />
                            <span>Décharge de Restitution (PDF)</span>
                          </button>
                          <button
                            onClick={() => onViewPdf(assignment)}
                            title="Consulter la Fiche d'Affectation Initiale"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition border border-slate-300 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span className="text-[11px]">Fiche Initiale</span>
                          </button>
                          {onReassign && (
                            <button
                              onClick={() => onReassign(assignment)}
                              title="Réaffecter cet équipement à un nouveau bénéficiaire"
                              className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-purple-200 cursor-pointer shadow-2xs"
                            >
                              <RefreshCw size={13} className="text-purple-600" />
                              <span>Réaffecter</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
