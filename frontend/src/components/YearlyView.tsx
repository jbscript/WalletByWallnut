import React, { useEffect, useState } from "react";
import { api, fmtCurrency } from "@/lib/api";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ShieldCheck, Wallet as WalletIcon, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface YearlySummary {
  total_income: number;
  total_expense: number;
  total_investment: number;
  total_lifestyle: number;
  total_emi: number;
  total_insurance: number;
  total_rent: number;
  emergency_fund: number;
  net_cash_balance: number;
  avg_monthly_expense: number;
  avg_monthly_investment: number;
}

interface Ratio { value: number; verdict: "good" | "watch" | "high"; }

interface YearlyData {
  year: number;
  summary: YearlySummary;
  ratios: { lifestyle: Ratio; committed: Ratio; savings_investment: Ratio; emi: Ratio };
  monthly: { month: string; income: number; expense: number; investment: number }[];
}

const verdictMeta = (v: "good" | "watch" | "high") =>
  v === "good"
    ? { label: "Good", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" }
    : v === "watch"
    ? { label: "Watch", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" }
    : { label: "High", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200" };

const YearlyView: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<YearlyData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<YearlyData>("/analytics/yearly", { params: { year } });
        setData(data);
      } catch (e) { console.error(e); }
    })();
  }, [year]);

  if (!data) return <div className="text-stone-400 text-sm">Loading…</div>;
  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* Year switcher */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 bg-white border border-stone-200 rounded-full p-1 shadow-sm" data-testid="year-switcher">
          <button onClick={() => setYear((y) => y - 1)} className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 transition-colors" data-testid="year-prev-btn">
            <ChevronLeft size={18} />
          </button>
          <div className="px-5 font-['Outfit'] font-bold text-lg text-stone-900 min-w-[100px] text-center" data-testid="year-label">{year}</div>
          <button onClick={() => setYear((y) => y + 1)} className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 transition-colors" data-testid="year-next-btn">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="text-xs text-stone-500">Yearly Cashflow Summary</div>
      </div>

      {/* Top tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile label="Total Income" value={s.total_income} icon={TrendingUp} accent="bg-emerald-600" />
        <Tile label="Total Expenses" value={s.total_expense} icon={TrendingDown} accent="bg-rose-500" />
        <Tile label="Total Investments" value={s.total_investment} icon={ShieldCheck} accent="bg-sky-600" />
        <Tile label="Net Cash Balance" value={s.net_cash_balance} icon={WalletIcon} accent={s.net_cash_balance >= 0 ? "bg-stone-900" : "bg-rose-500"} hint="Income − (Expenses + Investments)" />
      </div>

      {/* Breakdown row */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-4">Yearly cashflow summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
          <RowKV k="Total Income" v={fmtCurrency(s.total_income)} bold />
          <RowKV k="Avg Monthly Expense" v={fmtCurrency(s.avg_monthly_expense)} />
          <RowKV k="Total Expenses" v={fmtCurrency(s.total_expense)} />
          <RowKV k="Avg Monthly Investment" v={fmtCurrency(s.avg_monthly_investment)} />
          <RowKV k="Total Investments" v={fmtCurrency(s.total_investment)} />
          <RowKV k="Total Lifestyle Expense" v={fmtCurrency(s.total_lifestyle)} />
          <RowKV k="Total EMI" v={fmtCurrency(s.total_emi)} />
          <RowKV k="Total Insurance" v={fmtCurrency(s.total_insurance)} />
          <RowKV k="Total Rent" v={fmtCurrency(s.total_rent)} />
          <RowKV k="Emergency Fund" v={fmtCurrency(s.emergency_fund)} hint="Savings account balances" />
          <RowKV k="Net Cash Balance" v={fmtCurrency(s.net_cash_balance)} bold color={s.net_cash_balance >= 0 ? "text-emerald-600" : "text-rose-500"} />
        </div>
      </div>

      {/* Ratios analysis */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-4">Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RatioCard
            title="Lifestyle Expense Ratio"
            formula="Lifestyle Expenses / Income"
            ratio={data.ratios.lifestyle}
            healthyText="Lower is healthier · Target ≤ 50%"
          />
          <RatioCard
            title="Committed Ratio"
            formula="(Lifestyle + EMI + Insurance + Rent) / Income"
            ratio={data.ratios.committed}
            healthyText="Lower is healthier · Target ≤ 70%"
          />
          <RatioCard
            title="Savings + Investment Ratio"
            formula="(Net Cash + Investment) / Income"
            ratio={data.ratios.savings_investment}
            healthyText="Higher is healthier · Target ≥ 20%"
            inverse
          />
          <RatioCard
            title="EMI-to-Income Ratio"
            formula="Total EMIs / Income"
            ratio={data.ratios.emi}
            healthyText="Lower is healthier · Target ≤ 40%"
          />
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-2">Monthly breakdown</h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#78716c" }} tickFormatter={(m: string) => m.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} width={70} />
              <Tooltip formatter={(v: number) => fmtCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="investment" name="Investments" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: number; icon: any; accent: string; hint?: string }> = ({ label, value, icon: Icon, accent, hint }) => (
  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-stone-500">{label}</div>
        <div className="font-['Outfit'] font-bold text-2xl text-stone-900 mt-1.5 truncate">{fmtCurrency(value)}</div>
        {hint && <div className="text-[10px] text-stone-400 mt-0.5">{hint}</div>}
      </div>
      <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${accent} shrink-0`}>
        <Icon size={16} className="text-white" />
      </span>
    </div>
  </div>
);

const RowKV: React.FC<{ k: string; v: string; bold?: boolean; color?: string; hint?: string }> = ({ k, v, bold, color, hint }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-2">
    <div>
      <div className={`text-sm ${bold ? "font-bold text-stone-900" : "text-stone-600"}`}>{k}</div>
      {hint && <div className="text-[10px] text-stone-400">{hint}</div>}
    </div>
    <div className={`font-['Outfit'] ${bold ? "font-bold" : "font-semibold"} text-base ${color || "text-stone-900"} text-right`}>{v}</div>
  </div>
);

const RatioCard: React.FC<{ title: string; formula: string; ratio: Ratio; healthyText: string; inverse?: boolean }> = ({ title, formula, ratio, healthyText, inverse }) => {
  const v = verdictMeta(ratio.verdict);
  return (
    <div className={`rounded-2xl border ${v.border} ${v.bg} p-5 transition-all hover:shadow-md`} data-testid={`ratio-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-['Outfit'] font-bold text-stone-900">{title}</div>
          <div className="text-[10px] text-stone-500 font-mono">{formula}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border ${v.border} text-[11px] font-bold ${v.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
          {v.label}
        </span>
      </div>
      <div className={`font-['Outfit'] font-bold text-3xl mt-3 ${v.text}`}>{ratio.value.toFixed(2)}%</div>
      <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
        {ratio.verdict === "high" && <AlertTriangle size={11} className="text-rose-500" />}
        {healthyText}
      </div>
    </div>
  );
};

export default YearlyView;
