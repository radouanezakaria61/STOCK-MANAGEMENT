import { Download, Printer, ExternalLink, X } from "lucide-react";
import { MaterialAssignment } from "../../types";
import { exportReturnToPDF } from "../../utils/pdfGenerator";

interface FicheImpressionRestitutionProps {
  assignment: MaterialAssignment;
  onFermer: () => void;
}

// Proces-verbal de restitution imprimable - extrait de
// MaterialAssignmentModule (decomposition prudente, comportement inchange).
// Le parent ne rend ce composant qu'avec une restitution enregistree ;
// le garde-fou ci-dessous protege tout usage direct.
export default function FicheImpressionRestitution({ assignment, onFermer }: FicheImpressionRestitutionProps) {
  const gererImpressionNavigateur = () => window.print();
  if (!assignment.returnRecord) return null;

  const ouvrirNouvelOnglet = () => {
    const el = document.getElementById("printable-return-slip");
    if (!el) return;
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Décharge de Restitution — ${assignment.reference || "IT"}</title>
        <style>
          @media print { @page { margin: 10mm; size: A4; } body { margin: 0; } }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 16px; max-width: 210mm; margin: 0 auto; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #334155; padding: 4px 6px; text-align: left; font-size: 11px; }
          th { background: #f1f5f9; font-weight: 700; }
          .sig-box { border-top: 1px solid #334155; padding-top: 8px; margin-top: 24px; display: flex; justify-content: space-between; }
          .sig-box > div { width: 45%; }
        </style>
      </head>
      <body>${el.innerHTML}</body>
      </html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(htmlContent);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
  };

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
            
            {/* Sticky Action Bar */}
            <div className="sticky -top-6 -mt-2 -mx-2 sm:-mx-4 px-4 py-3 bg-white/95 backdrop-blur-md rounded-xl border-b border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-amber-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Décharge Officielle de Restitution
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportReturnToPDF(assignment).catch(() => alert("Erreur lors de la generation du PDF."))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={ouvrirNouvelOnglet}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <ExternalLink size={14} /> Nouvel onglet
                </button>
                <button
                  type="button"
                  onClick={gererImpressionNavigateur}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Printer size={14} /> Imprimer Décharge (A4)
                </button>
                <button
                  type="button"
                  onClick={() => onFermer()}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <X size={15} /> Fermer
                </button>
              </div>
            </div>

            {/* PRINTABLE RETURN SHEET */}
            <div id="printable-return-slip" className="space-y-6 text-slate-900 font-sans">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">
                    DIRECTION DES SYSTÈMES D'INFORMATION (DSI)
                  </h1>
                  <p className="text-xs font-semibold text-amber-800 uppercase">
                    Procès-Verbal de Restitution & Décharge de Matériel Informatique
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-black text-amber-900 bg-amber-50 px-3 py-1 rounded border border-amber-300">
                    DÉCHARGE N° {assignment.returnRecord.id}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium">
                    Casablanca, le {new Date(assignment.returnRecord.returnDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                
                {/* Beneficiary Return details */}
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1.5 bg-slate-50/50">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 text-[11px]">
                    1. Bénéficiaire Restituant
                  </h4>
                  <div><strong>Nom & Prénom :</strong> {assignment.beneficiaryName}</div>
                  <div><strong>N° CIN / Matricule :</strong> {assignment.beneficiaryCin || "Non renseigné"}</div>
                  <div><strong>Département :</strong> {assignment.beneficiaryDepartment}</div>
                  <div><strong>Fonction :</strong> {assignment.beneficiaryJobTitle || "Collaborateur"}</div>
                  <div><strong>Réf. Affectation Initiale :</strong> {assignment.reference}</div>
                </div>

                {/* Return Inspection */}
                <div className="border border-slate-300 rounded-lg p-3.5 space-y-1.5 bg-slate-50/50">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 text-[11px]">
                    2. Constat & Motif de Restitution
                  </h4>
                  <div><strong>Motif du Retour :</strong> <span className="font-bold text-slate-900">{assignment.returnRecord.cause}</span></div>
                  <div><strong>État Constaté :</strong> <span className="font-bold text-slate-900">{assignment.returnRecord.equipmentCondition}</span></div>
                  <div><strong>Action DSI :</strong> <span className="font-bold text-indigo-700">{assignment.returnRecord.actionTaken}</span></div>
                  <div><strong>Inspecté par :</strong> {assignment.returnRecord.inspectedBy}</div>
                </div>
              </div>

              {/* Table of Returned Gear */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  3. Matériels Restitués & Contrôle des Composants
                </h4>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                      <th className="border border-slate-300 p-2 text-left">Désignation</th>
                      <th className="border border-slate-300 p-2 text-left">N° Série (SN)</th>
                      <th className="border border-slate-300 p-2 text-left">Asset Tag</th>
                      <th className="border border-slate-300 p-2 text-left">Accessoires Reçus</th>
                      <th className="border border-slate-300 p-2 text-left">Accessoires Manquants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 font-bold text-slate-900">{it.name}</td>
                        <td className="border border-slate-300 p-2 font-mono font-semibold">{it.serialNumber}</td>
                        <td className="border border-slate-300 p-2 font-mono text-indigo-700 font-bold">{it.assetTag}</td>
                        <td className="border border-slate-300 p-2 text-[11px] text-emerald-700 font-medium">
                          {assignment.returnRecord?.accessoriesReturned.join(", ") || "Tous reçus"}
                        </td>
                        <td className="border border-slate-300 p-2 text-[11px] text-rose-700 font-medium">
                          {assignment.returnRecord?.missingAccessories && assignment.returnRecord.missingAccessories.length > 0
                            ? assignment.returnRecord.missingAccessories.join(", ")
                            : "Aucun (Complet)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Technical Observations */}
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 space-y-1 text-xs">
                <span className="font-bold text-slate-900 uppercase text-[11px] block">4. Diagnostic Technique & Quitus de Sécurité DSI :</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {assignment.returnRecord.technicalDiagnosis}
                </p>
                <div className="flex items-center gap-4 text-[10px] text-slate-600 font-semibold pt-1">
                  <span>• Nettoyage des Données : {assignment.returnRecord.dataWiped ? "Effectué (OK)" : "En attente"}</span>
                  <span>• Déconnexion BitLocker : {assignment.returnRecord.bitlockerUnlocked ? "Effectuée (OK)" : "En attente"}</span>
                </div>
              </div>

              {/* Quitus & Décharge text */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-[10px] text-slate-700 leading-relaxed">
                Par la présente, la Direction des Systèmes d'Information (DSI) atteste avoir réceptionné les matériels et accessoires décrits ci-dessus, et délivre au collaborateur <strong>{assignment.beneficiaryName}</strong> un quitus complet de décharge de prise en charge matérielle sous réserve des constats contradictoires ci-énoncés.
              </div>

              {/* SIGNATURES */}
              <div className="pt-4 grid grid-cols-2 gap-8 text-xs">
                
                {/* Beneficiary */}
                <div className="border border-slate-400 rounded-xl p-4 flex flex-col justify-between min-h-[140px] bg-white">
                  <div>
                    <span className="font-bold text-slate-900 uppercase block text-[11px]">
                      Le Collaborateur (Restituant)
                    </span>
                    <div className="font-semibold text-slate-800 mt-2">
                      {assignment.beneficiaryName}
                    </div>
                  </div>
                  <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400 flex justify-between items-end">
                    <span>Date & Signature :</span>
                    <span className="font-mono text-slate-300">________________________</span>
                  </div>
                </div>

                {/* DSI */}
                <div className="border border-slate-400 rounded-xl p-4 flex flex-col justify-between min-h-[140px] bg-white">
                  <div>
                    <span className="font-bold text-slate-900 uppercase block text-[11px]">
                      Pour la DSI (Inspecteur Réception)
                    </span>
                    <div className="font-semibold text-slate-800 mt-2">
                      {assignment.returnRecord.inspectedBy}
                    </div>
                  </div>
                  <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400 flex justify-between items-end">
                    <span>Cachet & Signature DSI :</span>
                    <span className="font-mono text-slate-300">________________________</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-400 text-center uppercase tracking-widest font-mono">
                Procès-Verbal Officiel de Restitution DSI • Page 1/1
              </div>

            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <span className="text-xs text-slate-500 font-medium">
                Décharge certifiée par la DSI • Exportation PDF pour archivage légal ou impression papier.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportReturnToPDF(assignment).catch(() => alert("Erreur lors de la generation du PDF."))}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download size={14} /> Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={gererImpressionNavigateur}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer size={14} /> Imprimer Décharge (A4)
                </button>
                <button
                  type="button"
                  onClick={() => onFermer()}
                  className="bg-slate-800 hover:bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <X size={15} /> Fermer la Décharge
                </button>
              </div>
            </div>

          </div>
        </div>
  );
}
