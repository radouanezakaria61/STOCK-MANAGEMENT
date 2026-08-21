import React, { useState } from "react";
import { Budget, PurchaseOrder } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";
import {
  Landmark,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface BudgetSpendVisualizerProps {
  budgets: Budget[];
  purchaseOrders: PurchaseOrder[];
  onSelectTab?: (tab: string) => void;
}

export default function BudgetSpendVisualizer({
  budgets,
  purchaseOrders,
  onSelectTab,
}: BudgetSpendVisualizerProps) {
  const [viewMode, setViewMode] = useState<"grouped" | "rate" | "donut">("grouped");

  // Compute live departmental spend in MAD
  const comparisonData = budgets.map((b, index) => {
    const deptOrders = purchaseOrders.filter(
      (po) =>
        po.department === b.name &&
        po.status !== "Declined" &&
        po.status !== "Cancelled"
    );
    const calculatedSpend = deptOrders.reduce((sum, po) => sum + po.amount, 0);
    const actualSpend = calculatedSpend > 0 ? calculatedSpend : b.spent;

    // Direct values in MAD
    const budgetValMAD = b.allocated;
    const spentValMAD = actualSpend;
    const remainingMAD = Math.max(0, budgetValMAD - spentValMAD);
    const consumptionRate = budgetValMAD > 0 ? Math.round((spentValMAD / budgetValMAD) * 100) : 0;

    // Short label for chart readability
    const shortNames: Record<string, string> = {
      "Technologies de l'Information": "IT & Systèmes",
      "Ressources Humaines & Moyens Généraux": "RH & Moyens Gx",
      "Ventes & Marketing": "Marketing & Ventes",
      "Chaîne Logistique & Approvisionnements": "Logistique & Appro",
    };

    const colors = ["#4F46E5", "#059669", "#D97706", "#0284C7", "#7C3AED"];
    const color = colors[index % colors.length];

    return {
      fullName: b.name,
      name: shortNames[b.name] || b.name,
      budgetPrevisionnel: budgetValMAD,
      depensesReelles: spentValMAD,
      soldeDisponible: remainingMAD,
      tauxConsommation: consumptionRate,
      color,
      isOverBudget: spentValMAD > budgetValMAD,
    };
  });

  const totalBudgetMAD = comparisonData.reduce((sum, item) => sum + item.budgetPrevisionnel, 0);
  const totalSpentMAD = comparisonData.reduce((sum, item) => sum + item.depensesReelles, 0);
  const totalRemainingMAD = Math.max(0, totalBudgetMAD - totalSpentMAD);
  const globalRate = totalBudgetMAD > 0 ? Math.round((totalSpentMAD / totalBudgetMAD) * 100) : 0;

  // Colors for rate bars
  const getRateColor = (rate: number) => {
    if (rate > 90) return "#EF4444"; // Red
    if (rate > 70) return "#F59E0B"; // Amber
    return "#10B981"; // Emerald
  };

  // Format currency in MAD
  const formatMAD = (val: number) => `${Math.round(val).toLocaleString("fr-FR")} MAD`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6" id="budget-spend-visualizer">
      {/* Header with Title & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Landmark size={17} className="text-indigo-600" />
              Répartition des Dépenses Réelles vs Budgets Prévisionnels
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analyse comparative des engagements financiers réels par département en Dirhams Marocains (MAD).
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === "grouped"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={13} />
            <span>Comparatif MAD</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("rate")}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === "rate"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <TrendingUp size={13} />
            <span>Taux de Consommation</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("donut")}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              viewMode === "donut"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <PieIcon size={13} />
            <span>Répartition Dépenses</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase">
            <span>Budget Prévisionnel Total</span>
            <Wallet size={15} className="text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-800 mt-1.5">{formatMAD(totalBudgetMAD)}</p>
          <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Dotation globale allouée</p>
        </div>

        <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-200/80">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold uppercase">
            <span>Dépenses Réelles Engagées</span>
            <TrendingUp size={15} className="text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1.5">{formatMAD(totalSpentMAD)}</p>
          <p className="text-[10.5px] text-emerald-600 font-bold mt-0.5">{globalRate}% du budget global</p>
        </div>

        <div className="bg-sky-50/50 rounded-xl p-3.5 border border-sky-200/80">
          <div className="flex items-center justify-between text-sky-800 text-[11px] font-bold uppercase">
            <span>Solde Disponible Restant</span>
            <CheckCircle2 size={15} className="text-sky-600" />
          </div>
          <p className="text-xl font-black text-sky-800 mt-1.5">{formatMAD(totalRemainingMAD)}</p>
          <p className="text-[10.5px] text-sky-600 font-medium mt-0.5">Marge d'engagement restante</p>
        </div>

        <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200/80">
          <div className="flex items-center justify-between text-indigo-800 text-[11px] font-bold uppercase">
            <span>Statut Global d'Exécution</span>
            <Layers size={15} className="text-indigo-600" />
          </div>
          <p className="text-xl font-black text-indigo-700 mt-1.5">
            {globalRate <= 75 ? "Budget Conforme" : globalRate <= 90 ? "Sous Vigilance" : "Tension Budgétaire"}
          </p>
          <p className="text-[10.5px] text-indigo-600 font-medium mt-0.5">
            {comparisonData.length} départements audités
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "grouped" ? (
            <BarChart
              data={comparisonData}
              margin={{ top: 15, right: 20, left: 10, bottom: 20 }}
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                stroke="#64748B"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Math.round(val / 1000)}k`}
              />
              <Tooltip
                formatter={(val: any, name: string) => [
                  formatMAD(Number(val)),
                  name === "budgetPrevisionnel" ? "Budget Prévisionnel Alloué" : "Dépenses Réelles Engagées",
                ]}
                labelFormatter={(label) => `Département : ${label}`}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "12px", fontSize: "12px", fontWeight: 600 }}
                formatter={(value) =>
                  value === "budgetPrevisionnel"
                    ? "Budget Prévisionnel Alloué (MAD)"
                    : "Dépenses Réelles Engagées (MAD)"
                }
              />
              <Bar
                dataKey="budgetPrevisionnel"
                name="budgetPrevisionnel"
                fill="#818CF8"
                radius={[6, 6, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="depensesReelles"
                name="depensesReelles"
                fill="#10B981"
                radius={[6, 6, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          ) : viewMode === "rate" ? (
            <BarChart
              data={comparisonData}
              margin={{ top: 15, right: 20, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                stroke="#64748B"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Plafond 100%", fill: "#EF4444", fontSize: 10 }} />
              <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Seuil Alerte 80%", fill: "#F59E0B", fontSize: 10 }} />
              <Tooltip
                formatter={(val: any, _, item: any) => [
                  `${val}% (${formatMAD(item.payload.depensesReelles)} / ${formatMAD(item.payload.budgetPrevisionnel)})`,
                  "Taux d'Exécution",
                ]}
                labelFormatter={(label) => `Département : ${label}`}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="tauxConsommation" name="Taux de Consommation (%)" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {comparisonData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={getRateColor(entry.tauxConsommation)} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip
                formatter={(val: any, _, item: any) => [
                  `${formatMAD(Number(val))} (${item.payload.tauxConsommation}% du budget divisionnaire)`,
                  item.payload.fullName,
                ]}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "12px", fontSize: "11px", fontWeight: 600 }}
                formatter={(_, item: any) => `${item.payload.name} (${formatMAD(item.payload.depensesReelles)})`}
              />
              <Pie
                data={comparisonData}
                dataKey="depensesReelles"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
              >
                {comparisonData.map((entry, index) => (
                  <Cell key={`pie-cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Breakdown Grid Cards for each Department */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
        {comparisonData.map((item) => {
          const isOver = item.isOverBudget;
          const isWarning = item.tauxConsommation > 80;

          return (
            <div
              key={item.fullName}
              className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-200/70 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between gap-1">
                <h4 className="text-xs font-bold text-slate-800 truncate" title={item.fullName}>
                  {item.fullName}
                </h4>
                <span
                  className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                    isOver
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : isWarning
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {item.tauxConsommation}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, item.tauxConsommation)}%` }}
                />
              </div>

              <div className="mt-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400">Engagé :</span>
                  <span className="font-bold text-slate-800">{formatMAD(item.depensesReelles)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400">Budget alloué :</span>
                  <span className="font-medium text-slate-700">{formatMAD(item.budgetPrevisionnel)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200/50">
                  <span className="text-slate-400">Disponible :</span>
                  <span className="font-bold text-emerald-700">{formatMAD(item.soldeDisponible)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
