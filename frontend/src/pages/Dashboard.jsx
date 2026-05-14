import React, { useEffect, useState, useMemo } from "react";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { useApp } from "@/context/AppContext";
import { api, fmtCurrency } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const SummaryCard = ({ label, value, hint, accent, icon: Icon, testid }) => (
  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow rise-in" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500">{label}</div>
        <div className="font-['Outfit'] font-bold text-3xl text-stone-900 mt-2">{value}</div>
        {hint && <div className="text-xs text-stone-500 mt-1">{hint}</div>}
      </div>
      <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${accent}`}>
        <Icon size={18} className="text-white" />
      </span>
    </div>
  </div>
);

export default function Dashboard() {
  const { accounts, period, recordsVersion } = useApp();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [structure, setStructure] = useState({ items: [], total: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [s, t, st] = await Promise.all([
          api.get("/analytics/summary", { params: { start_date: period.start, end_date: period.end } }),
          api.get("/analytics/balance-trend", { params: { start_date: period.start, end_date: period.end } }),
          api.get("/analytics/expenses-structure", { params: { start_date: period.start, end_date: period.end } }),
        ]);
        setSummary(s.data);
        setTrend(t.data.series);
        setStructure(st.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [period, recordsVersion]);

  const balances = summary?.account_balances || {};

  const pieData = useMemo(
    () => structure.items.filter(i => i.amount > 0).map(i => ({ name: i.name, value: i.amount, color: i.color })),
    [structure]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 md:px-8 py-8">
      {/* Account chips */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 mb-6">
        {accounts.map((a) => (
          <div key={a.id} className="shrink-0 flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-4 py-3 shadow-sm min-w-[200px]"
               data-testid={`account-chip-${a.id}`}>
            <CategoryIcon name={a.icon} color={a.color} size={40} iconSize={20} />
            <div>
              <div className="text-xs text-stone-500 font-medium">{a.name}</div>
              <div className="font-['Outfit'] font-semibold text-stone-900">
                {fmtCurrency(balances[a.id] || 0, a.currency)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Dashboard</h1>
        <PeriodSwitcher />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <SummaryCard
          label="Balance"
          value={fmtCurrency(summary?.total_balance || 0)}
          hint="Across all accounts"
          accent="bg-stone-900"
          icon={WalletIcon}
          testid="summary-balance"
        />
        <SummaryCard
          label="Cash Flow"
          value={fmtCurrency(summary?.cash_flow || 0)}
          hint={`${period.label}`}
          accent={(summary?.cash_flow || 0) >= 0 ? "bg-emerald-600" : "bg-rose-500"}
          icon={ArrowUpRight}
          testid="summary-cashflow"
        />
        <SummaryCard
          label="Spending"
          value={fmtCurrency(summary?.expense || 0)}
          hint={`${period.label}`}
          accent="bg-rose-500"
          icon={ArrowDownRight}
          testid="summary-spending"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Balance trend */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm" data-testid="balance-trend-card">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500">Balance Trend</div>
              <div className="font-['Outfit'] font-bold text-2xl text-stone-900 mt-1">
                {fmtCurrency(summary?.total_balance || 0)}
              </div>
            </div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }}
                       tickFormatter={(d) => d.slice(8, 10)}
                       axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false}
                       tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={70} />
                <Tooltip
                  formatter={(v) => fmtCurrency(v)}
                  labelFormatter={(l) => new Date(l).toDateString()}
                />
                <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fill="url(#balGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses structure */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm" data-testid="expenses-structure-card">
          <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-1">Expenses Structure</div>
          <div className="font-['Outfit'] font-bold text-2xl text-stone-900">
            {fmtCurrency(structure.total)}
          </div>
          {pieData.length === 0 ? (
            <div className="text-sm text-stone-400 py-12 text-center">No expenses in this period.</div>
          ) : (
            <>
              <div style={{ width: "100%", height: 180 }} className="mt-2">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2 max-h-44 overflow-y-auto">
                {structure.items.slice(0, 8).map((i) => (
                  <div key={i.category_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: i.color }} />
                      <span className="truncate text-stone-700">{i.name}</span>
                    </div>
                    <span className="font-medium text-stone-900">{fmtCurrency(i.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
