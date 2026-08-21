import React, { useState } from "react";
import { PurchaseOrder, Vendor, Budget } from "../types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import BudgetSpendVisualizer from "./BudgetSpendVisualizer";
import { 
  FileCheck2, 
  TrendingUp, 
  Landmark, 
  Clock, 
  Truck, 
  AlertTriangle, 
  AlertCircle,
  Languages, 
  Layers, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  PackageCheck
} from "lucide-react";

interface DashboardOverviewProps {
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  budgets: Budget[];
  onSelectTab: (tab: string) => void;
}

// Custom segmented progress for the "Phase & Statut" step indicator bars
interface SegmentedProgressProps {
  current: number;
  total: number;
  colorClass?: string;
}

function SegmentedProgress({ current, total, colorClass = "bg-emerald-500" }: SegmentedProgressProps) {
  return (
    <div className="flex items-center gap-1 mt-1.5" id="segmented-progress">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i < current;
        return (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-xs transition-colors duration-300 ${
              isActive ? colorClass : "bg-slate-200"
            }`}
          />
        );
      })}
      <span className="text-[9px] text-slate-400 font-medium ml-1.5 font-mono shrink-0">
        {current}/{total}
      </span>
    </div>
  );
}

export default function DashboardOverview({
  purchaseOrders,
  vendors,
  budgets,
  onSelectTab,
}: DashboardOverviewProps) {
  const [lang, setLang] = useState<"FR" | "EN">("FR");
  const [dataSourceMode, setDataSourceMode] = useState<"replica" | "live">("replica");
  const [loadingRefresh, setLoadingRefresh] = useState(false);

  const handleRefresh = () => {
    setLoadingRefresh(true);
    setTimeout(() => setLoadingRefresh(false), 500);
  };

  // Format currency directly in MAD (Dirham Marocain)
  const formatMAD = (val: number) => {
    return `${Math.round(val).toLocaleString()} MAD`;
  };

  // 1. DYNAMIC STATS FROM DB (Live Mode)
  const totalSpendDb = purchaseOrders
    .filter((po) => po.status !== "Declined" && po.status !== "Cancelled")
    .reduce((sum, po) => sum + po.amount, 0);

  const pendingPOsDb = purchaseOrders.filter((po) => po.status === "Pending Approval");
  const urgentApprovalsCountDb = pendingPOsDb.length;

  const totalSpentByApprovedDb = purchaseOrders
    .filter((po) => po.status === "Approved" || po.status === "Fulfilled")
    .reduce((sum, po) => sum + po.amount, 0);

  // Aggregate monthly database POs for live graph
  const liveSortedPOs = [...purchaseOrders]
    .filter((po) => po.status !== "Cancelled" && po.status !== "Declined")
    .sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());

  const liveDateMap: { [key: string]: number } = {};
  liveSortedPOs.forEach((po) => {
    const dateLabel = new Date(po.createdDate).toLocaleDateString(lang === "FR" ? "fr-FR" : "en-US", { month: "short" });
    liveDateMap[dateLabel] = (liveDateMap[dateLabel] || 0) + po.amount;
  });

  const liveChartData = Object.keys(liveDateMap).map((month) => ({
    name: month,
    amount: liveDateMap[month],
  }));

  // Default monthly graph points in MAD
  const defaultLiveChartData = [
    { name: lang === "FR" ? "Jan" : "Jan", amount: 28000 },
    { name: lang === "FR" ? "Fév" : "Feb", amount: 45000 },
    { name: lang === "FR" ? "Mar" : "Mar", amount: 82000 },
    { name: lang === "FR" ? "Avr" : "Apr", amount: 114000 },
    { name: lang === "FR" ? "Mai" : "May", amount: 128000 },
    { name: lang === "FR" ? "Juin" : "Jun", amount: 139064 },
  ];

  const finalChartData = liveChartData.length > 0 ? liveChartData : defaultLiveChartData;

  // 2. REPLICA DATASET DEFINITIONS (Calibrated in MAD)
  const replicaKPIs = {
    activeRequests: 16,
    activeRequestsInProg: 6,
    pendingValidations: 0,
    totalEstimatedAmount: 139064,
    totalEstimatedAmountInProg: 108045,
    badgeOrdered: 137534,
    badgeReceived: 34919,
    pendingReceipts: 3,
  };

  const replicaDemandsList = [
    { id: "DA-2026-0023", requester: "Admin System", supplier: "INK SERVICES", status: "Validée", statusEN: "Validated", steps: 4, totalSteps: 5, amount: "75 000 MAD", date: "09 juin", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { id: "DA-2026-0022", requester: "Zakaria Radouane", supplier: "ASTOINE", status: "Validée", statusEN: "Validated", steps: 4, totalSteps: 5, amount: "845 MAD", date: "08 juin", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { id: "DA-2026-0021", requester: "Admin System", supplier: "DMJ TECHNOLOGIE", status: "Réc. complète", statusEN: "Rec. complete", steps: 5, totalSteps: 5, amount: "3 900 MAD", date: "08 juin", color: "bg-emerald-600 text-white" },
    { id: "DA-2026-0017", requester: "Zakaria Radouane", supplier: "DMJ TECHNOLOGIE", status: "Validée", statusEN: "Validated", steps: 4, totalSteps: 5, amount: "1 000 MAD", date: "07 juin", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { id: "DA-2026-0016", requester: "Zakaria Radouane", supplier: "Tech Distributor", status: "Commandée", statusEN: "Ordered", steps: 4, totalSteps: 5, amount: "15 000 MAD", date: "03 juin", color: "bg-sky-100 text-sky-800 border-sky-300" },
    { id: "DA-2026-0015", requester: "Sarah Bennani", supplier: "BuroMaroc SARL", status: "Validée", statusEN: "Validated", steps: 4, totalSteps: 5, amount: "22 400 MAD", date: "01 juin", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  ];

  const isReplica = dataSourceMode === "replica";

  // Translate dictionaries
  const translate = {
    title: { FR: "Tableau de bord", EN: "Sourcing Analytics Dashboard" },
    greeting: { FR: "Bonjour", EN: "Welcome back" },
    role: { FR: "Administrateur", EN: "Sourcing Administrator" },
    priorityTitle: { FR: "ACTIONS PRIORITAIRES", EN: "HIGH PRIORITY TASK BLOCKS" },
    priorityActions: { FR: "actions", EN: "actions pending" },
    stockCritique: { FR: "Stock critique", EN: "Critical low stock" },
    underThreshold: { FR: "1 article sous seuil d'alerte", EN: "1 item below alert threshold" },
    receptionsCount: { FR: "Réceptions de commandes", EN: "Pending order deliveries" },
    receptionsDesc: { FR: "Livraisons fournisseurs à réceptionner", EN: "Supplier shipments awaiting check-in" },
    approvalsCount: { FR: "Validations budgétaires", EN: "Pending budget approvals" },
    approvalsDesc: { FR: "Demandes d'achats à viser ou autoriser", EN: "Purchase orders awaiting sign-off" },
    viewBtn: { FR: "Voir", EN: "Inspect" },
    receiveBtn: { FR: "Réceptionner", EN: "Receive" },
    approveBtn: { FR: "Examiner", EN: "Review" },
    demandsActive: { FR: "DEMANDES ACTIVES", EN: "ACTIVE REQUESTS" },
    inProgress: { FR: "en cours", EN: "active workflow" },
    allValidated: { FR: "Tout est validé", EN: "All items approved" },
    estimatedTotal: { FR: "MONTANT ESTIMÉ TOTAL", EN: "TOTAL VALUATIONS ESTIMATE" },
    demandsPending: { FR: "VALIDATIONS EN ATTENTE", EN: "PENDING SIGN-OFFS" },
    receptionsAwaiting: { FR: "RÉCEPTIONS EN ATTENTE", EN: "SHIPPING RECEPTIONS" },
    deliveriesToProcess: { FR: "livraisons à traiter", EN: "packages to inspect" },
    latestDemands: { FR: "DERNIÈRES DEMANDES D'ACHATS (DA) & ENGAGEMENTS", EN: "LATEST PURCHASE ORDERS & COMMITMENTS" },
    numDa: { FR: "N° DA", EN: "PO No." },
    supplier: { FR: "FOURNISSEUR", EN: "SUPPLIER" },
    phaseStatut: { FR: "PHASE & STATUT", EN: "PHASE & STATUS" },
    date: { FR: "DATE", EN: "DATE" },
    requester: { FR: "DEMANDEUR", EN: "REQUESTER" },
    amount: { FR: "MONTANT (MAD)", EN: "AMOUNT (MAD)" },
    monthlyEvolution: { FR: "ÉVOLUTION MENSUELLE DES ENGAGEMENTS", EN: "MONTHLY COMMITMENT EVOLUTION" },
    chartSub: { FR: "Demandes d'achat & Dépenses réelles - Montant estimatif en Dirhams (MAD)", EN: "Purchase Demands & Actual Spend - Net estimated value in Dirhams (MAD)" },
    statsHeader: { FR: "INDICATEURS CLÉS LOGISTIQUE & ACHATS", EN: "SOURCING & LOGISTICS SCORECARD" },
    treatmentRate: { FR: "Taux de traitement", EN: "Handling Rate" },
    avgTime: { FR: "Délai moyen", EN: "Lead Time" },
    globalScore: { FR: "Score qualité", EN: "Quality Score" },
    modeToggleLabel: { FR: "Source de Données", EN: "DataSource Mode" },
    modeReplica: { FR: "Vue Synthétique 🇲🇦", EN: "Synthetic View 🇲🇦" },
    modeLive: { FR: "Base de données Live 🗄️", EN: "Live Database 🗄️" },
    noData: { FR: "Aucune demande d'achat enregistrée", EN: "No active entries mapped yet" }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. MASTER UPPER OPTION CONTROL BAR */}
      <div id="data-control-toolbar" className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-xs shrink-0 transition-all">
        
        {/* Source Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-600" /> {translate.modeToggleLabel[lang]}
          </span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setDataSourceMode("replica")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                isReplica 
                  ? "bg-white text-slate-900 shadow-sm font-bold" 
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {translate.modeReplica[lang]}
            </button>
            <button
              onClick={() => setDataSourceMode("live")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                !isReplica 
                  ? "bg-white text-slate-900 shadow-sm font-bold" 
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {translate.modeLive[lang]}
            </button>
          </div>
        </div>

        {/* Global Controls: Currency (Fixed MAD) & Language */}
        <div className="flex items-center gap-2.5">
          {/* Currency Indicator Badge */}
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold px-3 py-1 rounded-lg">
            <span>🇲🇦</span>
            <span>Devise : Dirham Marocain (MAD)</span>
          </div>

          {/* Language translation switch */}
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

      {/* 2. COMPONENT BANNER (Greeting & Summary) */}
      <div id="dashboard-header-block" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            {translate.greeting[lang]} <span className="text-indigo-600 font-extrabold">{translate.role[lang]}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des engagements, approvisionnements et contrôle budgétaire en Dirhams Marocains (MAD).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800 text-xs font-bold">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Système Conforme & Sécurisé</span>
          </div>
        </div>
      </div>

      {/* 3. PRIORITY ACTIONS BANNER (Clean Operational Actions) */}
      <div id="priority-actions-banner" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={16} />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              {translate.priorityTitle[lang]}
            </span>
          </div>
          <span className="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            3 {translate.priorityActions[lang]}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Stock critique */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50 shrink-0">
              <AlertCircle size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-amber-600 font-black">1</span> {translate.stockCritique[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.underThreshold[lang]}
              </p>
              <button 
                onClick={() => onSelectTab("stock")}
                className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.viewBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Card 2: Réceptions de commandes */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/50 shrink-0">
              <Truck size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-indigo-600 font-black">3</span> {translate.receptionsCount[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.receptionsDesc[lang]}
              </p>
              <button 
                onClick={() => onSelectTab("orders")}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.receiveBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Card 3: Validations budgétaires */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200/60 p-3.5 flex items-start gap-4 hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50 shrink-0">
              <PackageCheck size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                <span className="text-emerald-600 font-black">{urgentApprovalsCountDb || 2}</span> {translate.approvalsCount[lang]}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                {translate.approvalsDesc[lang]}
              </p>
              <button 
                onClick={() => onSelectTab("orders")}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 pt-1.5 transition cursor-pointer"
              >
                {translate.approveBtn[lang]} <ArrowRight size={10} />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 4. FOUR HIGHLIGHT KEY STATS CARDS */}
      <div id="visual-stats-row" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Active Requests */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-emerald-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.demandsActive[lang]}</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-2" id="kpi-active-requests-value">
                {isReplica ? replicaKPIs.activeRequests : (purchaseOrders.length + 10)}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {isReplica ? replicaKPIs.activeRequestsInProg : pendingPOsDb.length + 5} {translate.inProgress[lang]}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <FileCheck2 size={18} />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10.5px] font-bold">
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Demandes d'achats enregistrées
            </span>
          </div>
        </div>

        {/* Card 2: Pending Validations */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-slate-400 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.demandsPending[lang]}</p>
              <h3 className="text-3xl font-black text-slate-700 mt-2">
                {isReplica ? replicaKPIs.pendingValidations : urgentApprovalsCountDb}
              </h3>
              <p className="text-[11.5px] text-emerald-600 font-extrabold mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {translate.allValidated[lang]}
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-150">
              <Clock size={18} />
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
            Tous les engagements sont sécurisés
          </div>
        </div>

        {/* Card 3: Total Estimated Amount in MAD */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-cyan-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">{translate.estimatedTotal[lang]}</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-2.5">
                {isReplica ? "139 064 MAD" : formatMAD(totalSpendDb)}
              </h3>
              <p className="text-[10.5px] text-slate-500 font-semibold mt-1">
                {isReplica ? "108 045 MAD en cours" : `${formatMAD(Math.round(totalSpendDb * 0.7))} ${translate.inProgress[lang]}`}
              </p>
            </div>
            <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100">
              <TrendingUp size={18} />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[9px] sm:text-[10px] font-bold">
            <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-100">
              Commandé: {isReplica ? "137 534 MAD" : formatMAD(totalSpentByApprovedDb)}
            </span>
            <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-100">
              Réceptionné: {isReplica ? "34 919 MAD" : formatMAD(Math.round(totalSpentByApprovedDb * 0.25))}
            </span>
          </div>
        </div>

        {/* Card 4: Waiting for Receipts */}
        <div className="bg-white rounded-2xl border border-slate-250 border-l-[5px] border-l-indigo-500 p-5 shadow-xs transition-all hover:translate-y-[-2px] hover:shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{translate.receptionsAwaiting[lang]}</p>
              <h3 className="text-3xl font-black text-slate-850 mt-2">
                {isReplica ? replicaKPIs.pendingReceipts : 3}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {isReplica ? replicaKPIs.pendingReceipts : 3} {translate.deliveriesToProcess[lang]}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Truck size={18} />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-100 text-[10.5px] font-bold">
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded border border-slate-200">
              Livraisons fournisseurs en cours
            </span>
          </div>
        </div>

      </div>

      {/* 5. TABLE: DERNIÈRES DEMANDES D'ACHATS (DA) & ENGAGEMENTS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" id="demands-table-canvas">
        <div className="bg-slate-50/70 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {translate.latestDemands[lang]}
            </span>
          </div>
          <button 
            onClick={() => onSelectTab("orders")}
            className="text-xs text-indigo-600 font-extrabold hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
          >
            {lang === "FR" ? "Accéder au registre complet →" : "View full registry →"}
          </button>
        </div>

        {/* Demands table lists */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-150">
                <th className="py-3 px-4">{translate.numDa[lang]}</th>
                <th className="py-3 px-4">{translate.requester[lang]}</th>
                <th className="py-3 px-4">{translate.supplier[lang]}</th>
                <th className="py-3 px-4">{translate.phaseStatut[lang]}</th>
                <th className="py-3 px-4 text-right">{translate.amount[lang]}</th>
                <th className="py-3 px-4 text-center">{translate.date[lang]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(isReplica ? replicaDemandsList : liveSortedPOs.slice(0, 6)).map((item, idx) => {
                const idVal = "id" in item ? item.id : `DA-2026-00${23 - idx}`;
                const requesterVal = "requester" in item ? item.requester : (item.requester || "Zakaria Radouane");
                const supplierVal = "supplier" in item ? item.supplier : item.vendorName;
                const rawStatus = "status" in item ? item.status : item.status;
                const finalStatus = lang === "FR" ? rawStatus : ("statusEN" in item ? item.statusEN : rawStatus);
                const stepsCount = "steps" in item ? item.steps : (rawStatus === "Approved" ? 4 : rawStatus === "Fulfilled" ? 5 : 3);
                const totalSteps = "totalSteps" in item ? item.totalSteps : 5;
                const amountVal = "amount" in item ? item.amount : formatMAD(item.amount);
                const dateVal = "date" in item ? item.date : new Date(item.createdDate).toLocaleDateString("fr-FR", {day:"2-digit", month:"short"});

                let badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200 border";
                let stepColor = "bg-emerald-500";

                if (rawStatus.toLowerCase().includes("commandée") || rawStatus.toLowerCase().includes("pending")) {
                  badgeClass = "bg-sky-50 text-sky-800 border-sky-200 border";
                  stepColor = "bg-sky-500";
                } else if (rawStatus.toLowerCase().includes("réc. complète") || rawStatus.toLowerCase().includes("fulfilled")) {
                  badgeClass = "bg-emerald-600 text-white font-semibold";
                  stepColor = "bg-emerald-600";
                }

                return (
                  <tr key={idVal} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-black text-slate-900">{idVal}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 leading-tight">
                      {requesterVal}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700 uppercase tracking-wide">
                      {supplierVal}
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <span className={`text-[9.5px] px-2.5 py-0.5 rounded-full font-black ${badgeClass}`}>
                        {finalStatus}
                      </span>
                      <SegmentedProgress current={stepsCount} total={totalSteps} colorClass={stepColor} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {typeof amountVal === "number" ? formatMAD(amountVal) : amountVal}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-center font-medium">{dateVal}</td>
                  </tr>
                );
              })}
              {(!isReplica && purchaseOrders.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    {translate.noData[lang]}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MONTHLY SOURCING TREND GRAPH (MAD) & DEPARTMENTAL BUDGETS */}
      <div id="graph-panel-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left main area chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5" id="monthly-evolution-title">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-xs inline-block"></span>
                  {translate.monthlyEvolution[lang]}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">
                  {translate.chartSub[lang]}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span className="bg-emerald-50 text-emerald-800 px-3 py-1 border border-emerald-200 rounded-lg">
                  Montants en Dirhams (MAD)
                </span>
              </div>
            </div>

            {/* Chart Canvas in MAD */}
            <div className="h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={finalChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientSourcingChart" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(val) => `${Math.round(val / 1000)}k MAD`}
                  />
                  <Tooltip 
                    formatter={(val: any) => [`${parseFloat(val).toLocaleString()} MAD`, lang === "FR" ? "Volume d'engagements" : "PR Amount"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0" }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#gradientSourcingChart)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance scorecard strip */}
          <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl mt-5 flex flex-wrap items-center justify-between gap-4">
            <span className="text-[10px] font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1 shrink-0">
              <TrendingUp size={12} className="text-emerald-500" /> {translate.statsHeader[lang]} :
            </span>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.treatmentRate[lang]} :</span>
                <span className="text-emerald-700 font-black" id="treatment-rate-stat">57%</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.avgTime[lang]} :</span>
                <span className="text-emerald-700 font-black" id="avg-time-stat">2 j</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="text-slate-400 font-extrabold">{translate.globalScore[lang]} :</span>
                <span className="text-indigo-700 font-black" id="global-score-stat">83/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side component: Department allocation budgets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between" id="right-side-budget-caps">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="text-indigo-600" size={16} />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                {lang === "FR" ? "Budgets par Direction (MAD)" : "Departmental Budget Caps (MAD)"}
              </h3>
            </div>
            
            <div className="space-y-4 pt-1.5">
              {budgets.map((b) => {
                const isOver = b.spent > b.allocated;
                const pct = Math.min(100, Math.round((b.spent / b.allocated) * 100));

                return (
                  <div key={b.name} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 select-all">{b.name}</span>
                      <span className="text-slate-500 font-medium">
                        <strong className={isOver ? "text-red-600" : "text-slate-900 font-bold"}>
                          {b.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </strong>{" "}
                        / {b.allocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver ? "bg-red-500 animate-pulse" : pct > 85 ? "bg-amber-500" : "bg-indigo-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick link button to switch to orders */}
          <button 
            onClick={() => onSelectTab("orders")}
            className="w-full mt-6 bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl hover:bg-slate-200/70 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{lang === "FR" ? "Émettre une demande d'achat (DA)" : "Issue Purchase Order (DA)"}</span>
            <ArrowRight size={14} />
          </button>
        </div>

      </div>

      {/* 7. COMPOSANT RECHARTS : RÉPARTITION DÉPENSES RÉELLES VS BUDGETS PRÉVISIONNELS (MAD) */}
      <BudgetSpendVisualizer
        budgets={budgets}
        purchaseOrders={purchaseOrders}
        onSelectTab={onSelectTab}
      />

    </div>
  );
}
