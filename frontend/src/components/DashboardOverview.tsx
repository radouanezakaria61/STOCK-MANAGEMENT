import React, { useState } from "react";
import { Vendor, AppUser, ITStockItem, StockMovement, MaterialAssignment } from "../types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  AlertCircle,
  Languages, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  PackageCheck,
  Boxes,
  FileCheck2,
  Users2
} from "lucide-react";

interface DashboardOverviewProps {
  vendors: Vendor[];
  users: AppUser[];
  stockItems: ITStockItem[];
  stockMovements: StockMovement[];
  assignments: MaterialAssignment[];
  onSelectTab: (tab: string) => void;
}

export default function DashboardOverview({
  vendors,
  users,
  stockItems,
  stockMovements,
  assignments,
  onSelectTab,
}: DashboardOverviewProps) {
  const [lang, setLang] = useState<"FR" | "EN">("FR");

  // Formatage monétaire direct en MAD (Dirham Marocain)
  const formatMAD = (val: number) => {
    return `${Math.round(val).toLocaleString()} MAD`;
  };

  // ── Indicateurs calculés depuis la base ──────────────────────────────
  const articlesSousSeuil = stockItems.filter(
    (i) => i.availableQty <= i.minThreshold && i.status !== "Rebut / Fin de vie"
  );

  const affectationsActives = assignments.filter((a) => a.status === "Active");

  const valeurTotaleParc = stockItems.reduce((sum, i) => sum + (i.totalValueMAD ?? 0), 0);

  const quantiteTotale = stockItems.reduce((sum, i) => sum + i.quantity, 0);

  const fournisseursARisque = vendors.filter(
    (v) => v.riskLevel === "High" || v.status === "On Probation"
  );

  // Graphique : volume mensuel des mouvements de matériel
  const mouvementsMap: { [key: string]: number } = {};
  [...stockMovements]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((m) => {
      const dateLabel = new Date(m.date).toLocaleDateString(lang === "FR" ? "fr-FR" : "en-US", { month: "short" });
      mouvementsMap[dateLabel] = (mouvementsMap[dateLabel] || 0) + Math.abs(m.quantity);
    });

  const chartData = Object.keys(mouvementsMap).map((month) => ({
    name: month,
    quantite: mouvementsMap[month],
  }));

  // Répartition de la valeur du stock par catégorie
  const repartitionCategories = Object.entries(
    stockItems.reduce((acc: { [key: string]: number }, item) => {
      acc[item.category] = (acc[item.category] || 0) + (item.totalValueMAD ?? 0);
      return acc;
    }, {})
  )
    .map(([categorie, valeur]) => ({ categorie, valeur }))
    .sort((a, b) => b.valeur - a.valeur);

  const translate = {
    title: { FR: "Tableau de bord", EN: "IT Asset Dashboard" },
    greeting: { FR: "Bonjour", EN: "Welcome back" },
    role: { FR: "Administrateur", EN: "IT Asset Administrator" },
    priorityTitle: { FR: "ACTIONS PRIORITAIRES", EN: "HIGH PRIORITY TASK BLOCKS" },
    priorityActions: { FR: "actions", EN: "actions pending" },
    stockCritique: { FR: "Stock critique", EN: "Critical low stock" },
    sousSeuil: {
      FR: (n: number) => `${n} article${n > 1 ? "s" : ""} sous seuil d'alerte`,
      EN: (n: number) => `${n} item${n > 1 ? "s" : ""} below alert threshold`
    },
    affectationsCount: { FR: "Affectations en cours", EN: "Active assignments" },
    affectationsDesc: { FR: "Dotations matériel actives à suivre", EN: "Active equipment assignments to track" },
    fournisseursCount: { FR: "Fournisseurs à risque", EN: "At-risk vendors" },
    fournisseursDesc: { FR: "Profils à surveiller ou en période d'essai", EN: "Vendors on probation or flagged" },
    viewBtn: { FR: "Voir", EN: "Inspect" },
    articlesTotal: { FR: "ARTICLES RÉFÉRENCÉS", EN: "REGISTERED ITEMS" },
    unitesEnStock: { FR: "unités en stock", EN: "units in stock" },
    affectationsActives: { FR: "AFFECTATIONS ACTIVES", EN: "ACTIVE ASSIGNMENTS" },
    valeurParc: { FR: "VALEUR DU PARC", EN: "TOTAL ASSET VALUE" },
    utilisateursCount: { FR: "UTILISATEURS RÉFÉRENCÉS", EN: "REGISTERED USERS" },
    derniersMouvements: { FR: "DERNIERS MOUVEMENTS DE MATÉRIEL", EN: "LATEST STOCK MOVEMENTS" },
    colArticle: { FR: "ARTICLE", EN: "ITEM" },
    colType: { FR: "TYPE", EN: "TYPE" },
    colQuantite: { FR: "QTÉ", EN: "QTY" },
    colAuteur: { FR: "OPÉRATEUR", EN: "OPERATOR" },
    colDate: { FR: "DATE", EN: "DATE" },
    evolutionMouvements: { FR: "ÉVOLUTION DES MOUVEMENTS DE MATÉRIEL", EN: "EQUIPMENT MOVEMENT EVOLUTION" },
    chartSub: { FR: "Entrées et sorties de stock - volume mensuel en unités", EN: "Stock in & out - monthly volume in units" },
    statsHeader: { FR: "INDICATEURS CLÉS DU PARC", EN: "IT ASSET SCORECARD" },
    tauxAffectation: { FR: "Taux d'affectation", EN: "Allocation Rate" },
    articlesCritiques: { FR: "Articles critiques", EN: "Critical items" },
    scoreFournisseurs: { FR: "Score fournisseurs", EN: "Vendor Score" },
    repartitionCategorie: { FR: "Valeur du stock par catégorie (MAD)", EN: "Stock Value by Category (MAD)" },
    noData: { FR: "Aucun mouvement enregistré", EN: "No movement recorded yet" }
  };

  const tauxAffectation =
    quantiteTotale > 0
      ? Math.round(
          (stockItems.reduce((sum, i) => sum + i.allocatedQty, 0) / quantiteTotale) * 100
        )
      : 0;

  const scoreMoyenFournisseurs =
    vendors.length > 0
      ? Math.round(vendors.reduce((sum, v) => sum + v.qualityScore, 0) / vendors.length)
      : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. BARRE DE CONTRÔLE SUPÉRIEURE */}
      <div id="data-control-toolbar" className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-xs shrink-0 transition-all">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-600" /> {translate.title[lang]}
          </span>
        </div>

        {/* Devise fixe (MAD) & langue */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold px-3 py-1 rounded-lg">
            <span>🇲🇦</span>
            <span>Devise : Dirham Marocain (MAD)</span>
          </div>

          <div className="flex items-center bg-indigo-50 hover:bg-indigo-100 rounded-lg p-1 border border-indigo-200 transition-colors">
            <Languages size={13} className="text-indigo-600 mr-1 ml-0.5" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "FR" | "EN")}
              className="text-[10.5px] font-bold text-indigo-700 bg-transparent focus:outline-hidden cursor-pointer"
            >
              <option value="FR">FR 🇫🇷</option>
              <option value="EN">EN 🇺🇸</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. BANNIÈRE D'ACCUEIL */}
      <div id="dashboard-header-block" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            {translate.greeting[lang]} <span className="text-indigo-600 font-extrabold">{translate.role[lang]}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des équipements, affectations et stock informatique en Dirhams Marocains (MAD).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800 text-xs font-bold">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Système Conforme & Sécurisé</span>
          </div>
        </div>
      </div>

      {/* 3. ACTIONS PRIORITAIRES */}
      <div id="priority-actions-banner" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={16} />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              {translate.priorityTitle[lang]}
            </span>
          </div>
          <span className="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            {(articlesSousSeuil.length > 0 ? 1 : 0) + (affectationsActives.length > 0 ? 1 : 0) + (fournisseursARisque.length > 0 ? 1 : 0)} {translate.priorityActions[lang]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Carte 1 : Stock critique */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50 shrink-0">
              <AlertCircle size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-amber-600 font-black">{articlesSousSeuil.length}</span> {translate.stockCritique[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.sousSeuil[lang](articlesSousSeuil.length)}
              </p>
              <button 
                onClick={() => onSelectTab("stock")}
                className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.viewBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Carte 2 : Affectations actives */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/50 shrink-0">
              <FileCheck2 size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-indigo-600 font-black">{affectationsActives.length}</span> {translate.affectationsCount[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.affectationsDesc[lang]}
              </p>
              <button 
                onClick={() => onSelectTab("assignments")}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.viewBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Carte 3 : Fournisseurs à risque */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50 shrink-0">
              <PackageCheck size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-emerald-600 font-black">{fournisseursARisque.length}</span> {translate.fournisseursCount[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.fournisseursDesc[lang]}
              </p>
              <button 
                onClick={() => onSelectTab("suppliers")}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.viewBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 4. QUATRE CARTES D'INDICATEURS CLÉS */}
      <div id="visual-stats-row" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Carte 1 : Articles référencés */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-emerald-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.articlesTotal[lang]}</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-2" id="kpi-stock-items-value">
                {stockItems.length}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {quantiteTotale} {translate.unitesEnStock[lang]}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Boxes size={18} />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10.5px] font-bold">
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Inventaire matériel à jour
            </span>
          </div>
        </div>

        {/* Carte 2 : Affectations actives */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-indigo-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.affectationsActives[lang]}</p>
              <h3 className="text-3xl font-black text-slate-700 mt-2">
                {affectationsActives.length}
              </h3>
              <p className="text-[11.5px] text-emerald-600 font-extrabold mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {stockMovements.filter((m) => m.type === "Sortie Affectation").length} sorties enregistrées
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Clock size={18} />
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
            Décharges & restitutions suivies dans le temps
          </div>
        </div>

        {/* Carte 3 : Valeur du parc */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-cyan-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">{translate.valeurParc[lang]}</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-2.5">
                {formatMAD(valeurTotaleParc)}
              </h3>
              <p className="text-[10.5px] text-slate-500 font-semibold mt-1">
                Valeur cumulée des articles en stock
              </p>
            </div>
            <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100">
              <TrendingUp size={18} />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[9px] sm:text-[10px] font-bold">
            <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-100">
              {repartitionCategories.length} catégories
            </span>
            <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-100">
              {vendors.length} fournisseurs
            </span>
          </div>
        </div>

        {/* Carte 4 : Utilisateurs */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-purple-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.utilisateursCount[lang]}</p>
              <h3 className="text-3xl font-black text-slate-850 mt-2">
                {users.length}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {users.filter((u) => u.status === "Actif").length} comptes actifs
              </p>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Users2 size={18} />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10.5px] font-bold">
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded border border-slate-200">
              Rôles & habilitations gérés (RBAC)
            </span>
          </div>
        </div>

      </div>

      {/* 5. TABLEAU : DERNIERS MOUVEMENTS DE MATÉRIEL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" id="movements-table-canvas">
        <div className="bg-slate-50/70 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {translate.derniersMouvements[lang]}
            </span>
          </div>
          <button 
            onClick={() => onSelectTab("stock")}
            className="text-xs text-indigo-600 font-extrabold hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
          >
            {lang === "FR" ? "Accéder au registre complet →" : "View full registry →"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-150">
                <th className="py-3 px-4">{translate.colArticle[lang]}</th>
                <th className="py-3 px-4">{translate.colType[lang]}</th>
                <th className="py-3 px-4 text-right">{translate.colQuantite[lang]}</th>
                <th className="py-3 px-4">{translate.colAuteur[lang]}</th>
                <th className="py-3 px-4 text-center">{translate.colDate[lang]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {stockMovements.slice(0, 8).map((m) => {
                let badgeClass = "bg-sky-50 text-sky-800 border-sky-200 border";
                if (m.type === "Sortie Affectation") {
                  badgeClass = "bg-indigo-50 text-indigo-800 border-indigo-200 border";
                } else if (m.type === "Mise au Rebut") {
                  badgeClass = "bg-rose-50 text-rose-800 border-rose-200 border";
                } else if (m.type === "Retour Stock") {
                  badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200 border";
                }

                return (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-black text-slate-900 leading-tight">{m.itemName}</p>
                      {"reference" in m && m.reference && (
                        <p className="text-[10px] text-slate-400 font-mono">{m.reference}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <span className={`text-[9.5px] px-2.5 py-0.5 rounded-full font-black ${badgeClass}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {m.quantity}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 leading-tight">
                      {m.performedBy}
                      {m.recipient && (
                        <p className="text-[10px] text-slate-400">→ {m.recipient}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-center font-medium">
                      {new Date(m.date).toLocaleDateString("fr-FR", {day:"2-digit", month:"short", year:"numeric"})}
                    </td>
                  </tr>
                );
              })}
              {stockMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    {translate.noData[lang]}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. GRAPHIQUE DES MOUVEMENTS & RÉPARTITION PAR CATÉGORIE */}
      <div id="graph-panel-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graphique principal */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5" id="monthly-evolution-title">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-xs inline-block"></span>
                  {translate.evolutionMouvements[lang]}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  {translate.chartSub[lang]}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="bg-emerald-50 text-emerald-800 px-3 py-1 border border-emerald-200 rounded-lg">
                  Volume en unités
                </span>
              </div>
            </div>

            <div className="h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length > 0 ? chartData : [{ name: "—", quantite: 0 }]} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientStockChart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#94A3B8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    formatter={(val: any) => [`${parseFloat(val).toLocaleString()} unités`, lang === "FR" ? "Volume mouvementé" : "Moved Volume"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0" }}
                  />
                  <Area type="monotone" dataKey="quantite" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#gradientStockChart)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bandeau indicateurs */}
          <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl mt-5 flex flex-wrap items-center justify-between gap-4">
            <span className="text-[10px] font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1 shrink-0">
              <TrendingUp size={12} className="text-emerald-500" /> {translate.statsHeader[lang]} :
            </span>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.tauxAffectation[lang]} :</span>
                <span className="text-emerald-700 font-black" id="allocation-rate-stat">{tauxAffectation}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.articlesCritiques[lang]} :</span>
                <span className={`font-black ${articlesSousSeuil.length > 0 ? "text-rose-600" : "text-emerald-700"}`} id="critical-items-stat">
                  {articlesSousSeuil.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.scoreFournisseurs[lang]} :</span>
                <span className="text-indigo-700 font-black" id="vendor-score-stat">{scoreMoyenFournisseurs}/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau latéral : valeur par catégorie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between" id="right-side-category-breakdown">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="text-indigo-600" size={16} />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                {translate.repartitionCategorie[lang]}
              </h3>
            </div>
            
            <div className="space-y-4 pt-1.5">
              {repartitionCategories.map(({ categorie, valeur }) => {
                const pct = valeurTotaleParc > 0 ? Math.max(2, Math.round((valeur / valeurTotaleParc) * 100)) : 0;

                return (
                  <div key={categorie} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 select-all">{categorie}</span>
                      <span className="text-slate-500 font-medium">
                        <strong className="text-slate-900 font-bold">{formatMAD(valeur)}</strong>{" "}
                        ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct > 85 ? "bg-amber-500" : "bg-indigo-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {repartitionCategories.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">{translate.noData[lang]}</p>
              )}
            </div>
          </div>

          {/* Lien rapide vers le stock */}
          <button 
            onClick={() => onSelectTab("stock")}
            className="w-full mt-6 bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl hover:bg-slate-200/70 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{lang === "FR" ? "Gérer le stock IT & matériels" : "Manage IT Stock & Hardware"}</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>

    </div>
  );
}
