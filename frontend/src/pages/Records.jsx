import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api, fmtCurrency } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Plus, MoreVertical, Trash2, Pencil, ArrowLeftRight } from "lucide-react";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import CategoryIcon from "@/components/CategoryIcon";
import { AddRecordModal } from "@/components/AddRecordModal";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const TYPE_LABELS = { income: "Income", expense: "Expense", transfer: "Transfer" };

export default function Records() {
  const { accounts, categories, period } = useApp();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("date_desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const fetchRecords = async () => {
    const params = {
      start_date: period.start,
      end_date: period.end,
      sort,
    };
    if (accountFilter !== "all") params.account_id = accountFilter;
    if (categoryFilter !== "all") params.category_id = categoryFilter;
    if (typeFilter !== "all") params.type = typeFilter;
    if (search.trim()) params.search = search.trim();
    const { data } = await api.get("/records", { params });
    setRecords(data);
  };

  useEffect(() => { fetchRecords(); }, [period, accountFilter, categoryFilter, typeFilter, sort]);

  const onSearchKey = (e) => { if (e.key === "Enter") fetchRecords(); };

  const grouped = useMemo(() => {
    const out = {};
    for (const r of records) {
      out[r.date] = out[r.date] || [];
      out[r.date].push(r);
    }
    return out;
  }, [records]);

  const total = useMemo(() => records.reduce((s, r) => {
    if (r.type === "income") return s + r.amount;
    if (r.type === "expense") return s - r.amount;
    return s;
  }, 0), [records]);

  const reset = () => {
    setSearch(""); setAccountFilter("all"); setCategoryFilter("all"); setTypeFilter("all"); setSort("date_desc");
  };

  const handleDelete = async (r) => {
    if (!window.confirm("Delete this record?")) return;
    try { await api.delete(`/records/${r.id}`); toast.success("Deleted"); fetchRecords(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 md:px-8 py-8 flex gap-6">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-white border border-stone-200 rounded-2xl p-5 h-fit sticky top-20" data-testid="records-filter-sidebar">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-['Outfit'] text-xl font-bold">Records</h2>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-3 h-8" data-testid="records-add-btn">
            <Plus size={14} />
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Search</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} onBlur={fetchRecords} placeholder="Search notes / payee" className="pl-9" data-testid="records-search-input" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Sort by</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger data-testid="records-sort-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount (high to low)</SelectItem>
                <SelectItem value="amount_asc">Amount (low to high)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Account</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger data-testid="records-account-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="records-category-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Record Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="records-type-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={reset} className="w-full rounded-full" data-testid="records-reset-btn">Reset filters</Button>
        </div>
      </aside>

      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm text-stone-500">Found <span className="font-semibold text-stone-900" data-testid="records-count">{records.length}</span> records</div>
            <div className="font-['Outfit'] text-2xl font-bold mt-1" data-testid="records-total" style={{ color: total >= 0 ? "#059669" : "#e11d48" }}>
              {total >= 0 ? "+" : "-"}{fmtCurrency(Math.abs(total))}
            </div>
          </div>
          <PeriodSwitcher />
        </div>

        {records.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-400">
            No records yet. Click + to add your first one.
          </div>
        ) : (
          Object.keys(grouped).sort((a, b) => sort === "date_asc" ? a.localeCompare(b) : b.localeCompare(a)).map((day) => {
            const items = grouped[day];
            const dayTotal = items.reduce((s, r) => r.type === "income" ? s + r.amount : r.type === "expense" ? s - r.amount : s, 0);
            return (
              <div key={day} className="mb-5">
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <div className="text-xs uppercase tracking-[0.18em] font-semibold text-stone-500">
                    {new Date(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="text-xs font-semibold" style={{ color: dayTotal >= 0 ? "#059669" : "#e11d48" }}>
                    {dayTotal >= 0 ? "+" : "-"}{fmtCurrency(Math.abs(dayTotal))}
                  </div>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden">
                  {items.map((r) => {
                    const cat = r.category_id ? categoryMap[r.category_id] : null;
                    const acc = accountMap[r.account_id];
                    const toAcc = r.to_account_id ? accountMap[r.to_account_id] : null;
                    const amountColor = r.type === "income" ? "text-emerald-600" : r.type === "expense" ? "text-rose-500" : "text-sky-600";
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors" data-testid={`record-row-${r.id}`}>
                        {r.type === "transfer" ? (
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-50 text-sky-600"><ArrowLeftRight size={18} /></div>
                        ) : cat ? (
                          <CategoryIcon name={cat.icon} color={cat.color} size={40} iconSize={18} />
                        ) : (
                          <CategoryIcon name="tag" color="#94a3b8" size={40} iconSize={18} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-stone-900 truncate">
                            {r.type === "transfer" ? "Transfer" : (cat?.name || "Uncategorized")}
                          </div>
                          <div className="text-xs text-stone-500 truncate">
                            {r.payee || r.note || ""}{(r.payee && r.note) ? " · " + r.note : ""}
                          </div>
                        </div>
                        <div className="text-xs text-stone-500 hidden md:flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: acc?.color || "#94a3b8" }} />
                          {acc?.name}{toAcc ? ` → ${toAcc.name}` : ""}
                        </div>
                        <div className={`font-['Outfit'] font-semibold ${amountColor} w-32 text-right`}>
                          {r.type === "expense" ? "-" : r.type === "income" ? "+" : ""}{fmtCurrency(r.amount, acc?.currency)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" data-testid={`record-menu-${r.id}`}>
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true); }} data-testid={`record-edit-${r.id}`}><Pencil size={14} className="mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(r)} className="text-rose-600" data-testid={`record-delete-${r.id}`}><Trash2 size={14} className="mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddRecordModal open={open} onOpenChange={setOpen} editRecord={editing} onSaved={fetchRecords} />
    </div>
  );
}
