import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api, fmtCurrency, prevMonthRange } from "@/lib/api";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import CategoryIcon from "@/components/CategoryIcon";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export default function Analytics() {
  const { period, categories } = useApp();
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const prev = prevMonthRange(period.start);

  useEffect(() => {
    (async () => {
      const params = {
        start_date: period.start,
        end_date: period.end,
        prev_start: prev.start,
        prev_end: prev.end,
      };
      const [r, t, cf] = await Promise.all([
        api.get("/analytics/report", { params }),
        api.get("/analytics/balance-trend", { params: { start_date: period.start, end_date: period.end } }),
        api.get("/analytics/cash-flow", { params: { start_date: shiftBack(period.start, 5), end_date: period.end } }),
      ]);
      setReport(r.data);
      setTrend(t.data.series);
      setCashflow(cf.data.series);
    })();
  }, [period]);

  function shiftBack(yyyy_mm_dd, months) {
    const d = new Date(yyyy_mm_dd);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

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
        </TabsList>

        <TabsContent value="report" className="mt-6">
          {report && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <Section title="Total Income" current={report.income.current_total} previous={report.income.previous_total} positive />
              {report.income.rows.map((row) => <Row key={row.category_id} row={row} positive />)}
              <Section title="Total Expense" current={-report.expense.current_total} previous={-report.expense.previous_total} negative />
              {report.expense.rows.map((row) => <Row key={row.category_id} row={row} negative />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trend" className="mt-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500 mb-2">Balance Trend - {period.label}</div>
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
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
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
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${Math.round(v).toLocaleString("en-IN")}`} width={80} />
                  <Tooltip formatter={(v) => fmtCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Section = ({ title, current, previous, positive, negative }) => {
  const color = positive ? "text-emerald-600" : negative ? "text-rose-500" : "text-stone-900";
  const sign = current >= 0 ? "" : "-";
  return (
    <div className="grid grid-cols-12 px-5 py-4 bg-stone-50 border-y border-stone-200 items-center">
      <div className="col-span-6 font-['Outfit'] font-bold text-lg text-stone-900">{title}</div>
      <div className={`col-span-3 text-right font-['Outfit'] font-bold ${color}`}>{sign}{fmtCurrency(Math.abs(current))}</div>
      <div className="col-span-3 text-right font-['Outfit'] font-semibold text-stone-400">{fmtCurrency(Math.abs(previous))}</div>
    </div>
  );
};

const Row = ({ row, positive, negative }) => {
  const color = positive ? "text-emerald-600" : negative ? "text-rose-500" : "text-stone-900";
  return (
    <div className="grid grid-cols-12 px-5 py-3 items-center hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0">
      <div className="col-span-6 flex items-center gap-3">
        <CategoryIcon name={row.icon} color={row.color} size={32} iconSize={14} />
        <span className="text-sm text-stone-700 font-medium">{row.name}</span>
      </div>
      <div className={`col-span-3 text-right text-sm font-semibold ${row.current > 0 ? color : "text-stone-400"}`}>
        {row.current === 0 ? fmtCurrency(0) : `${negative ? "-" : ""}${fmtCurrency(row.current)}`}
      </div>
      <div className="col-span-3 text-right text-sm text-stone-400">{fmtCurrency(row.previous)}</div>
    </div>
  );
};
