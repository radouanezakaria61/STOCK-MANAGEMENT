import { Download, Printer, X } from "lucide-react";
import { MaterialAssignment } from "../../types";
import { exportAssignmentToPDF } from "../../utils/pdfGenerator";

interface FicheImpressionAffectationProps {
  assignment: MaterialAssignment;
  onFermer: () => void;
}

// Apercu imprimable de la fiche d'affectation - extrait de
// MaterialAssignmentModule (decomposition prudente, comportement inchange).
// L'export PDF passe par un import dynamique de jsPDF cote pdfGenerator.
export default function FicheImpressionAffectation({ assignment, onFermer }: FicheImpressionAffectationProps) {
  const gererImpressionNavigateur = () => window.print();

  return (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onFermer();
            }
          }}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static"
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 print:shadow-none print:border-none print:m-0 print:p-4 print:max-w-none relative">
            
            {/* Sticky Action Bar (Hidden in Print) */}
            <div className="sticky top-0 -mt-2 -mx-2 sm:-mx-4 px-4 py-3 bg-white/95 backdrop-blur-md rounded-xl border-b border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <span className="hidden sm:inline">Fiche Officielle d'Affectation &amp; Prise en Charge</span>
                  <span className="sm:hidden">Fiche d'Affectation</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAssignmentToPDF(assignment).catch(() => alert("Erreur lors de la generation du PDF."))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={gererImpressionNavigateur}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Printer size={14} /> Imprimer (A4)
                </button>
                <button
                  type="button"
                  onClick={() => onFermer()}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <X size={15} /> Fermer
                </button>
              </div>
            </div>

            {/* PRINTABLE SHEET CONTENT */}
            <div id="printable-handover-slip" className="text-slate-900 font-sans">
              
              {/* IF DISTRA IT-02 FORM */}
              {assignment.templateType === "DISTRA_SIM_SMARTPHONE" || assignment.resourceType ? (
                <div className="space-y-3.5 text-slate-900 border-2 border-slate-300 p-4 sm:p-6 bg-white rounded-lg text-xs">
                  
                  {/* Top Header */}
                  <div className="grid grid-cols-12 border-2 border-slate-900 rounded overflow-hidden">
                    {/* Distra Brand */}
                    <div className="col-span-3 p-3 border-r-2 border-slate-900 flex items-center justify-center bg-white">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-[#7cb342] flex items-center justify-center text-white font-black text-xs">D</div>
                          <div className="w-5 h-5 -ml-2 rounded-full bg-[#558b2f] opacity-80"></div>
                          <div className="w-4 h-4 -ml-2 rounded-full bg-[#33691e] opacity-70"></div>
                        </div>
                        <span className="text-xl font-black tracking-tight text-slate-800 font-sans">Distra</span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="col-span-6 p-3 border-r-2 border-slate-900 flex items-center justify-center text-center bg-white">
                      <h1 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight leading-tight">
                        DÉCHARGE D'AFFECTATION<br />DE MATÉRIEL IT
                      </h1>
                    </div>

                    {/* Reference & Form code */}
                    <div className="col-span-3 flex flex-col justify-between bg-white text-center">
                      <div className="p-2 border-b-2 border-slate-900 font-bold text-slate-700 text-[11px]">
                        Formulaire : {assignment.formCode || "IT-02"}
                      </div>
                      <div className="p-2 font-black text-blue-700 text-[11px] font-mono">
                        N° AFFECTATION : {assignment.reference?.replace("AFF-DSI-2026-", "")?.replace(/^0+/, "") || "1"}
                      </div>
                    </div>
                  </div>

                  {/* DSI Green Banner */}
                  <div className="bg-[#689f38] text-white py-1.5 px-3 text-center text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs">
                    DÉPARTEMENT SYSTÈMES D'INFORMATION
                  </div>

                  {/* 1 — BÉNÉFICIAIRE GRID */}
                  <div className="border border-slate-900 rounded overflow-hidden text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 border-b border-slate-300">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Nom et Prénom :</div>
                      <div className="p-2 font-bold text-slate-900 border-r border-slate-300 sm:col-span-1">{assignment.beneficiaryName}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Date d'affectation :</div>
                      <div className="p-2 font-semibold text-slate-900">{assignment.assignedDate}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 border-b border-slate-300">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Fonction :</div>
                      <div className="p-2 text-slate-900 border-r border-slate-300 sm:col-span-1">{assignment.beneficiaryJobTitle || "—"}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Département :</div>
                      <div className="p-2 text-slate-900">{assignment.beneficiaryDepartment || "—"}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4">
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Site :</div>
                      <div className="p-2 text-slate-900 border-r border-slate-300 sm:col-span-1">{assignment.beneficiarySite || "Berrechid"}</div>
                      <div className="p-2 bg-slate-50 font-bold text-slate-700 border-r border-slate-300">Société :</div>
                      <div className="p-2 font-bold text-slate-900">Distra SA</div>
                    </div>
                  </div>

                  {/* 2 — TYPE D'AFFECTATION & 3 — RESSOURCE AFFECTÉE */}
                  <div className="border border-slate-900 rounded p-3 bg-white space-y-2.5">
                    {/* Row 1: Type d'affectation */}
                    <div className="flex flex-wrap items-center gap-6 pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-900 min-w-[130px]">Type d'affectation :</span>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                          <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                            assignment.operationType !== "RÉAFFECTATION" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                          }`}>
                            {assignment.operationType !== "RÉAFFECTATION" ? "✓" : ""}
                          </span>
                          <span>Affectation</span>
                        </label>
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                          <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                            assignment.operationType === "RÉAFFECTATION" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                          }`}>
                            {assignment.operationType === "RÉAFFECTATION" ? "✓" : ""}
                          </span>
                          <span>Réaffectation</span>
                        </label>
                      </div>
                    </div>

                    {/* Row 2: Ressource affectée */}
                    <div className="flex flex-wrap items-center gap-6">
                      <span className="font-bold text-slate-900 min-w-[130px]">Ressource affectée :</span>
                      <div className="flex flex-wrap items-center gap-5">
                        {(() => {
                          const rTypeStr = assignment.resourceType || "";
                          const isSim = assignment.hasSimCard || rTypeStr === "Carte SIM" || rTypeStr === "Carte SIM + SmartPhone" || rTypeStr.includes("SIM");
                          const isPhone = assignment.hasSmartphone || rTypeStr === "SmartPhone" || rTypeStr === "Carte SIM + SmartPhone" || (assignment.deviceBrand && !assignment.equipmentType && !assignment.deviceModel?.toLowerCase().includes("hp"));
                          const isPc = rTypeStr === "PC / Laptop" || (assignment.equipmentType && (assignment.equipmentType.toLowerCase().includes("pc") || assignment.equipmentType.toLowerCase().includes("laptop") || assignment.equipmentType.toLowerCase().includes("ordinateur"))) || (assignment.deviceBrand?.toUpperCase() === "HP" || assignment.items?.some(i => i.category?.includes("Laptop") || i.category?.includes("Postes Fixes")));
                          const isOther = rTypeStr === "Autre matériel IT" || (!isSim && !isPhone && !isPc && (assignment.items?.length || assignment.equipmentType));

                          return (
                            <>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isSim ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isSim ? "✓" : ""}
                                </span>
                                <span>Carte SIM</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isPhone ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isPhone ? "✓" : ""}
                                </span>
                                <span>Smartphone</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isPc ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isPc ? "✓" : ""}
                                </span>
                                <span>PC / Laptop</span>
                              </label>
                              <label className="flex items-center gap-2 font-semibold">
                                <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${isOther ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"}`}>
                                  {isOther ? "✓" : ""}
                                </span>
                                <span>Autre matériel IT</span>
                              </label>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 4 — INFORMATIONS CARTE SIM */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      INFORMATIONS CARTE SIM
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">Opérateur :</span>
                        <div className="flex items-center gap-2.5">
                          {["IAM", "INWI", "ORANGE", "AUTRE"].map((op) => (
                            <label key={op} className="flex items-center gap-1 font-semibold text-[11px]">
                              <span className={`w-3 h-3 border border-slate-800 rounded-xs flex items-center justify-center text-[9px] font-bold ${
                                (assignment.simOperator || "IAM") === op ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                              }`}>
                                {(assignment.simOperator || "IAM") === op ? "✓" : ""}
                              </span>
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[11px]">
                        <div>
                          <span className="text-slate-600 mr-1">N° Tél :</span>
                          <strong className="font-mono text-slate-900 font-bold">{assignment.simPhoneNumber || assignment.beneficiaryPhone || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-600 mr-1">PIN :</span>
                          <strong className="font-mono text-slate-900">{assignment.simPin || "—"}</strong>
                        </div>
                        <div>
                          <span className="text-slate-600 mr-1">PUK :</span>
                          <strong className="font-mono text-slate-900">{assignment.simPuk || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5 — INFORMATIONS DU MATÉRIEL */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      INFORMATIONS MATÉRIEL
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#689f38] text-white font-bold">
                          <th className="p-2 border-r border-emerald-700 text-center">Type de matériel</th>
                          <th className="p-2 border-r border-emerald-700 text-center">Marque</th>
                          <th className="p-2 border-r border-emerald-700 text-center">Modèle</th>
                          <th className="p-2 border-r border-emerald-700 text-center">
                            {assignment.resourceType === "SmartPhone" ? "IMEI" : (assignment.resourceType === "PC / Laptop" ? "N° Série / Service Tag" : "N° Série / IMEI")}
                          </th>
                          <th className="p-2 text-center">Configuration</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white border-t border-slate-300 text-center">
                          <td className="p-2 border-r border-slate-300 font-medium">
                            {assignment.equipmentType || (assignment.resourceType === "PC / Laptop" ? "PC Portable" : (assignment.resourceType === "SmartPhone" ? "Smartphone" : assignment.items?.[0]?.name || "Matériel IT"))}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-semibold">{assignment.deviceBrand || assignment.items?.[0]?.brand || "—"}</td>
                          <td className="p-2 border-r border-slate-300">{assignment.deviceModel || assignment.items?.[0]?.model || "—"}</td>
                          <td className="p-2 border-r border-slate-300 font-mono font-bold text-indigo-700">
                            {assignment.deviceImei || assignment.items?.[0]?.serialNumber || "—"}
                          </td>
                          <td className="p-2 text-slate-700">
                            {assignment.deviceConfiguration || [
                              assignment.equipmentCpu ? `CPU: ${assignment.equipmentCpu}` : "",
                              assignment.equipmentRam ? `RAM: ${assignment.equipmentRam}GB` : "",
                              assignment.equipmentStorage ? `SSD: ${assignment.equipmentStorage}GB` : ""
                            ].filter(Boolean).join(" | ") || (assignment.items?.[0]?.specs ? `${assignment.items[0].specs.ram || ""} ${assignment.items[0].specs.storage || ""}`.trim() : "") || "Standard"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 6 — RESTITUTION ANCIEN MATÉRIEL & REMARQUES */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase border-b border-slate-900">
                      RESTITUTION ANCIEN MATÉRIEL
                    </div>
                    <div className="p-3 space-y-2 bg-white text-xs">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-800">Restitution de l'ancien appareil :</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 font-semibold">
                            <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                              assignment.restitutionPreviousDevice === "OUI" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                            }`}>
                              {assignment.restitutionPreviousDevice === "OUI" ? "✓" : ""}
                            </span>
                            <span>OUI</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-semibold">
                            <span className={`w-3.5 h-3.5 border border-slate-800 rounded-xs flex items-center justify-center text-[10px] font-bold ${
                              assignment.restitutionPreviousDevice !== "OUI" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                            }`}>
                              {assignment.restitutionPreviousDevice !== "OUI" ? "✓" : ""}
                            </span>
                            <span>NON</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-bold text-slate-800">État de l'appareil restitué :</span>
                        <div className="flex flex-wrap items-center gap-3">
                          {["Endommagé", "Cassé mais opérationnel", "Bon état", "Non applicable"].map((cond) => {
                            const isCondMatch = (assignment.restitutionPreviousDevice !== "OUI" && cond === "Non applicable") ||
                                                (assignment.restitutionPreviousDevice === "OUI" && (assignment.restitutedDeviceCondition || "Non applicable") === cond);
                            return (
                              <label key={cond} className="flex items-center gap-1 font-semibold text-[11px]">
                                <span className={`w-3 h-3 border border-slate-800 rounded-xs flex items-center justify-center text-[9px] font-bold ${
                                  isCondMatch ? "bg-emerald-700 text-white border-emerald-700" : "bg-white"
                                }`}>
                                  {isCondMatch ? "✓" : ""}
                                </span>
                                <span>{cond}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-800">Remarques :</span>
                        <span className="text-slate-900 font-medium">
                          {assignment.incidentRemarks && assignment.incidentRemarks.trim() !== "INCIDENT / PANNE"
                            ? assignment.incidentRemarks
                            : (assignment.notes || "—")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 7 — ENGAGEMENT DU BÉNÉFICIAIRE */}
                  <div className="border border-slate-900 rounded overflow-hidden">
                    <div className="bg-[#ecf5e9] text-[#285014] px-3 py-1 font-bold text-[11px] uppercase text-center border-b border-slate-900">
                      ENGAGEMENT DU BÉNÉFICIAIRE
                    </div>
                    <div className="p-3 space-y-2 text-[10px] text-slate-800 leading-relaxed bg-white">
                      <p>
                        1. Le bénéficiaire s'engage à rendre le matériel (SIM et/ou équipement) en bon état en cas de cessation de travail ou suite à une demande de Distra SA. En cas de non-restitution, la valeur sera déduite du solde de tout compte ou du salaire mensuel.
                      </p>
                      <p>
                        2. En cas de perte, casse, panne ou vol suite à une mauvaise manipulation ou négligence, le bénéficiaire prendra en charge les frais d'achat d'un appareil de même gamme. Le département SI se charge de la récupération de la ligne SIM.
                      </p>
                      <p>
                        3. L'opérateur prend en charge la réparation (ou le remplacement) des appareils sous garantie uniquement pour les anomalies d'usine. Ces réclamations doivent être faites dans les premières semaines suivant la réception.
                      </p>
                    </div>
                  </div>

                  {/* 8 — SIGNATURES */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="border border-slate-900 rounded overflow-hidden flex flex-col justify-between min-h-[105px] bg-white">
                      <div className="bg-slate-100 text-slate-900 px-2.5 py-1 font-bold text-[11px] border-b border-slate-900 text-center">
                        Signature du bénéficiaire
                      </div>
                      <div className="p-2 text-center text-[9px] text-slate-400 italic">
                        (Date et mention manuscrite "Lu et approuvé")
                      </div>
                      <div className="p-2 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date & signature :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>

                    <div className="border border-slate-900 rounded overflow-hidden flex flex-col justify-between min-h-[105px] bg-white">
                      <div className="bg-slate-100 text-slate-900 px-2.5 py-1 font-bold text-[11px] border-b border-slate-900 text-center">
                        Visa Département Systèmes d'Information
                      </div>
                      <div className="p-2 text-center text-[9px] text-slate-400 italic">
                        (Date, visa et cachet DSI)
                      </div>
                      <div className="p-2 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Visa & cachet :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="border-t border-slate-900 pt-2 text-[10px] text-slate-600 text-center font-bold tracking-wider">
                    Département Systèmes D'Information &nbsp;|&nbsp; <span className="font-normal text-slate-500">DIS-IT-02 | Version 1.0</span>
                  </div>

                </div>
              ) : (
                /* DISTRA STANDARD IT EQUIPMENT FORM (DIS-IT-01) */
                <div className="space-y-4 text-slate-900 border-2 border-slate-300 p-4 sm:p-6 bg-white rounded-lg">
                  {/* Top Header */}
                  <div className="grid grid-cols-3 items-center border-b-2 border-[#7cb342] pb-3 gap-2">
                    {/* Distra Brand */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-[#7cb342] flex items-center justify-center text-white font-black text-xs">D</div>
                        <div className="w-5 h-5 -ml-2 rounded-full bg-[#558b2f] opacity-80"></div>
                        <div className="w-4 h-4 -ml-2 rounded-full bg-[#33691e] opacity-70"></div>
                      </div>
                      <span className="text-xl font-black tracking-tight text-slate-800 font-sans">Distra</span>
                    </div>

                    {/* Title */}
                    <div className="text-center border-2 border-[#7cb342] py-2 px-3 rounded bg-emerald-50/40">
                      <h1 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight leading-snug">
                        FORMULAIRE DE DÉCHARGE MATÉRIEL INFORMATIQUE
                      </h1>
                    </div>

                    {/* Reference & Form code */}
                    <div className="text-right text-xs">
                      <div className="font-bold text-slate-700">Formulaire IT-01</div>
                      <div className="font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded inline-block font-mono mt-0.5">
                        N° AFFECTATION : {assignment.reference}
                      </div>
                    </div>
                  </div>

                  {/* DSI Green Banner */}
                  <div className="bg-[#7cb342] text-white py-1 px-3 text-center text-xs font-bold uppercase tracking-wider rounded-xs">
                    Département Systèmes D'Information
                  </div>

                  {/* Information Bénéficiaire */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      INFORMATION BÉNÉFICIAIRE :
                    </div>
                    <div className="border border-slate-300 rounded overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#7cb342] text-white text-[11px]">
                            <th className="p-2 font-bold border-r border-emerald-600">Nom Complet</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Fonction</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Département</th>
                            <th className="p-2 font-bold">Emplacement</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white text-slate-900">
                            <td className="p-2 border-r border-slate-300 font-bold">{assignment.beneficiaryName}</td>
                            <td className="p-2 border-r border-slate-300">{assignment.beneficiaryJobTitle || "Operateur"}</td>
                            <td className="p-2 border-r border-slate-300 font-semibold">{assignment.beneficiaryDepartment || "Technique"}</td>
                            <td className="p-2">{assignment.beneficiarySite || "Berrechid"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Informations du bien */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      INFORMATIONS DU BIEN :
                    </div>
                    <div className="border border-slate-300 rounded overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#7cb342] text-white text-[11px]">
                            <th className="p-2 font-bold border-r border-emerald-600">Type du bien</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Numéro de série</th>
                            <th className="p-2 font-bold border-r border-emerald-600">Configuration</th>
                            <th className="p-2 font-bold">Date d'acquisition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignment.items.map((it, idx) => {
                            const configStr = [
                              assignment.equipmentCpu ? `CPU: ${assignment.equipmentCpu}` : (it.specs?.cpu ? `CPU: ${it.specs.cpu}` : ""),
                              assignment.equipmentRam ? `RAM: ${assignment.equipmentRam} GB` : (it.specs?.ram ? `RAM: ${it.specs.ram}` : ""),
                              assignment.equipmentStorage ? `SSD: ${assignment.equipmentStorage} GB` : (it.specs?.storage ? `SSD: ${it.specs.storage}` : "")
                            ].filter(Boolean).join(" | ") || (assignment.deviceConfiguration || "Standard");

                            const acqDate = assignment.equipmentAcquisitionDate 
                              ? new Date(assignment.equipmentAcquisitionDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                              : "06/12/2021";

                            return (
                              <tr key={idx} className="bg-white text-slate-900 border-b border-slate-200">
                                <td className="p-2 border-r border-slate-300 font-semibold">{assignment.equipmentType || it.category || it.name}</td>
                                <td className="p-2 border-r border-slate-300 font-mono font-bold text-[#33691e]">{it.serialNumber}</td>
                                <td className="p-2 border-r border-slate-300 font-medium">{configStr}</td>
                                <td className="p-2 font-mono">{acqDate}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Compléments & Type d'opération */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Compléments */}
                    <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1.5">
                      <span className="font-bold text-slate-800 uppercase text-[11px] block">Compléments :</span>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { label: "Clavier", checked: !!assignment.hasKeyboard },
                          { label: "Souris", checked: !!assignment.hasMouse },
                          { label: "Adaptateur USB / RJ45", checked: !!assignment.hasUsbAdapter }
                        ].map((c) => (
                          <div key={c.label} className="flex items-center gap-1.5 font-bold text-slate-800">
                            <span className={`w-4 h-4 rounded-xs border flex items-center justify-center ${
                              c.checked ? "bg-[#7cb342] text-white border-[#558b2f]" : "bg-white border-slate-400"
                            }`}>
                              {c.checked ? "✓" : ""}
                            </span>
                            <span>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Type d'opération */}
                    <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1.5">
                      <span className="font-bold text-slate-800 uppercase text-[11px] block">Type d'opération :</span>
                      <div className="flex items-center gap-4">
                        {["AFFECTATION", "RÉAFFECTATION"].map((op) => {
                          const isOp = (assignment.operationType || "AFFECTATION") === op;
                          return (
                            <div key={op} className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span className={`w-4 h-4 rounded-xs border flex items-center justify-center ${
                                isOp ? "bg-[#7cb342] text-white border-[#558b2f]" : "bg-white border-slate-400"
                              }`}>
                                {isOp ? "✓" : ""}
                              </span>
                              <span>{op}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Engagement du bénéficiaire */}
                  <div className="border border-slate-300 rounded overflow-hidden text-xs">
                    <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px] uppercase">
                      Engagement du bénéficiaire
                    </div>
                    <div className="p-3 space-y-1 text-[10px] text-slate-800 leading-relaxed bg-white">
                      <p>
                        1. Par la présente, je soussigné(e) M/Mme <strong>{assignment.beneficiaryName}</strong>, atteste avoir reçu le matériel informatique ci-dessus mentionné en parfait état de marche.
                      </p>
                      <p>
                        2. Je m'engage à en prendre soin, à l'utiliser exclusivement à des fins professionnelles conformément aux directives de la Direction des Systèmes d'Information (DSI).
                      </p>
                      <p>
                        3. En cas de perte, vol ou dégradation par négligence, j'en informerai immédiatement la DSI et reconnais ma responsabilité selon le règlement intérieur de l'entreprise.
                      </p>
                      <p>
                        4. Tout le matériel ainsi que ses accessoires devront être restitués à la DSI lors de mon départ ou sur simple demande.
                      </p>
                    </div>
                  </div>

                  {/* Remarques */}
                  <div className="border border-slate-300 rounded p-2 text-xs flex items-center gap-2 bg-white">
                    <span className="font-bold text-slate-700 shrink-0">Remarques :</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {assignment.incidentRemarks || assignment.notes || "INFORMATION / SUIVI"}
                    </span>
                  </div>

                  {/* Dual Signatures */}
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                    <div className="border border-slate-300 rounded overflow-hidden flex flex-col justify-between min-h-[110px] bg-white">
                      <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px]">
                        Signature du bénéficiaire
                      </div>
                      <div className="p-2.5 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date et signature :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded overflow-hidden flex flex-col justify-between min-h-[110px] bg-white">
                      <div className="bg-[#7cb342] text-white px-2.5 py-1 font-bold text-[11px]">
                        Visa Département Systèmes d'Information
                      </div>
                      <div className="p-2.5 flex justify-between items-end text-[10px] text-slate-400 border-t border-slate-100">
                        <span>Date, visa et cachet :</span>
                        <span className="font-mono text-slate-300">__________________</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Distra */}
                  <div className="border-t border-slate-300 pt-2 text-[9px] text-slate-500 text-center font-semibold tracking-wider uppercase">
                    Département Systèmes D'Information | DIS-IT-01 | Version 1.0
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
  );
}
