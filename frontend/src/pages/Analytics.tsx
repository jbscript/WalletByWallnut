import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, fmtCurrency, prevMonthRange } from "@/lib/api";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import CategoryIcon from "@/components/CategoryIcon";
import { ChevronDown, ChevronRight } from "lucide-react";
import YearlyView from "@/components/YearlyView";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface ReportRow {
  category_id: string;
  name: string;
  color: string;
  icon: string;
  current: number;
  previous: number;
  children?: ReportRow[];
}

interface ReportSide {
  rows: ReportRow[];
  current_total: number;
  previous_total: number;
}

interface ReportData {
  income: ReportSide;
  expense: ReportSide;
}

const Analytics: React.FC = () => {
  const period = useAppStore((s) => s.period);
  const recordsVersion = useAppStore((s) => s.recordsVersion);
  const [report, setReport] = useState<ReportData | null>(null);
  const [trend, setTrend] = useState<{ date: string; balance: number }[]>([]);
  const [cashflow, setCashflow] = useState<{ month: string; income: number; expense: number; net: number }[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const prev = prevMonthRange(period.start);

  const shiftBack = (yyyy_mm_dd: string, months: number): string => {
    const d = new Date(yyyy_mm_dd);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    (async () => {
      const params = { start_date: period.start, end_date: period.end, prev_start: prev.start, prev_end: prev.end };
      const [r, t, cf] = await Promise.all([
        api.get<ReportData>("/analytics/report", { params }),
        api.get<{ series: { date: string; balance: number }[] }>("/analytics/balance-trend", { params: { start_date: period.start, end_date: period.end } }),
        api.get<{ series: { month: string; income: number; expense: number; net: number }[] }>(
          "/analytics/cash-flow", { params: { start_date: shiftBack(period.start, 5), end_date: period.end } }
        ),
      ]);
      setReport(r.data);
      setTrend(t.data.series);
      setCashflow(cf.data.series);
    })();
  }, [period, recordsVersion]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="mx-auto max-w-7xl px-6 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Analytics</h1>
        <PeriodSwitcher />
      </div>

      <Tabs defaultValue="report" className="w-full">
        <TabsList className="bg-stone-100 rounded-full p-1 inline-flex">
          <TabsTrigger value="report" data-testid="analytics-tab-report" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Incomes & Expenses</TabsTrigger>
          <TabsTrigger value="trend" data-testid="analytics-tab-trend" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Balance Trend</TabsTrigger>
          <TabsTrigger value="cashflow" data-testid="analytics-tab-cashflow" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Cash Flow</TabsTrigger>
          <TabsTrigger value="yearly" data-testid="analytics-tab-yearly" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="mt-6">
          {report && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <SectionHeader title="Total Income" current={report.income.current_total} previous={report.income.previous_total} sign="positive" />
              {report.income.rows.map((row) => (
                <ParentRow key={row.category_id} row={row} expanded={!!expanded[row.category_id]} onToggle={() => toggle(row.category_id)} sign="positive" />
              ))}
              <SectionHeader title="Total Expense" current={report.expense.current_total} previous={report.expense.previous_total} sign="negative" />
              {report.expense.rows.map((row) => (
                <ParentRow key={row.category_id} row={row} expanded={!!expanded[row.category_id]} onToggle={() => toggle(row.category_id)} sign="negative" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trend" className="mt-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-2">Balance Trend — {period.label}</div>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fill="url(#trendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-2">Cash Flow (last 6 months)</div>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={cashflow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="yearly" className="mt-6">
          <YearlyView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; current: number; previous: number; sign: "positive" | "negative" }> = ({ title, current, previous, sign }) => {
  const color = sign === "positive" ? "text-emerald-600" : "text-rose-500";
  const prefix = sign === "negative" && current > 0 ? "-" : "";
  return (
    <div className="grid grid-cols-12 px-5 py-4 bg-stone-50 border-y border-stone-200 items-center">
      <div className="col-span-6 font-['Outfit'] font-bold text-lg text-stone-900">{title}</div>
      <div className={`col-span-3 text-right font-['Outfit'] font-bold ${color}`}>{prefix}{fmtCurrency(current)}</div>
      <div className="col-span-3 text-right font-['Outfit'] font-semibold text-stone-400">{prefix}{fmtCurrency(previous)}</div>
    </div>
  );
};

const ParentRow: React.FC<{ row: ReportRow; expanded: boolean; onToggle: () => void; sign: "positive" | "negative" }> = ({ row, expanded, onToggle, sign }) => {
  const color = sign === "positive" ? "text-emerald-600" : "text-rose-500";
  const prefix = sign === "negative" && row.current > 0 ? "-" : "";
  const hasChildren = (row.children?.length ?? 0) > 0;
  return (
    <>
      <button
        onClick={hasChildren ? onToggle : undefined}
        className={`w-full grid grid-cols-12 px-5 py-3 items-center transition-colors border-b border-stone-100 last:border-b-0 ${hasChildren ? "hover:bg-stone-50 cursor-pointer" : "cursor-default"}`}
        data-testid={`parent-row-${row.category_id}`}
      >
        <div className="col-span-6 flex items-center gap-3">
          <div className="w-4 h-4 flex items-center justify-center text-stone-400">
            {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </div>
          <CategoryIcon name={row.icon} color={row.color} size={32} iconSize={14} />
          <span className="text-sm text-stone-900 font-semibold">{row.name}</span>
        </div>
        <div className={`col-span-3 text-right text-sm font-bold ${row.current > 0 ? color : "text-stone-400"}`}>
          {row.current === 0 ? fmtCurrency(0) : `${prefix}${fmtCurrency(row.current)}`}
        </div>
        <div className="col-span-3 text-right text-sm text-stone-400">{fmtCurrency(row.previous)}</div>
      </button>

      {expanded && row.children?.map((c) => (
        <div key={c.category_id} className="grid grid-cols-12 px-5 py-2.5 items-center bg-stone-50/40 border-b border-stone-100 last:border-b-0">
          <div className="col-span-6 flex items-center gap-3 pl-7">
            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            <span className="text-sm text-stone-700">{c.name}</span>
          </div>
          <div className={`col-span-3 text-right text-sm font-medium ${c.current > 0 ? color : "text-stone-400"}`}>
            {c.current === 0 ? fmtCurrency(0) : `${prefix}${fmtCurrency(c.current)}`}
          </div>
          <div className="col-span-3 text-right text-sm text-stone-400">{fmtCurrency(c.previous)}</div>
        </div>
      ))}
    </>
  );
};

export default Analytics;
