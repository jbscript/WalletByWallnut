import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, fmtCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, MoreVertical, Repeat, Play, Pause, CalendarClock } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { RecurringFormModal } from "@/components/RecurringFormModal";
import { toast } from "sonner";
import { format } from "date-fns";

interface Rule {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  payee: string;
  note: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  start_date: string;
  end_date: string | null;
  next_run: string;
  last_run: string | null;
  active: boolean;
}

const formatFreq = (f: string, i: number) => {
  const u = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[f] || f;
  return i === 1 ? `every ${u}` : `every ${i} ${u}s`;
};

const Recurring: React.FC = () => {
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const bumpRecords = useAppStore((s) => s.bumpRecords);

  const [rules, setRules] = useState<Rule[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [running, setRunning] = useState(false);

  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const fetchRules = async () => {
    const { data } = await api.get<Rule[]>("/recurring");
    setRules(data);
  };

  useEffect(() => { fetchRules(); }, []);

  const handleDelete = async (r: Rule) => {
    if (!window.confirm(`Delete recurring rule "${r.name}"?`)) return;
    try {
      await api.delete(`/recurring/${r.id}`);
      toast.success("Rule deleted");
      fetchRules();
    } catch { toast.error("Failed"); }
  };

  const handleToggle = async (r: Rule) => {
    try {
      await api.patch(`/recurring/${r.id}`, { active: !r.active });
      toast.success(r.active ? "Paused" : "Activated");
      fetchRules();
    } catch { toast.error("Failed"); }
  };

  const runDue = async () => {
    setRunning(true);
    try {
      const { data } = await api.post<{ created: number }>("/recurring/run", {});
      toast.success(data.created === 0 ? "Nothing due" : `Created ${data.created} record${data.created === 1 ? "" : "s"}`);
      bumpRecords();
      fetchRules();
    } catch (e) {
      console.error(e);
      toast.error("Failed to run");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-8 py-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-stone-900 text-white">
            <Repeat size={18} />
          </span>
          <div>
            <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Recurring</h1>
            <p className="text-sm text-stone-500">Automate scheduled income, expenses or transfers.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDue} disabled={running} className="rounded-full" data-testid="run-due-btn">
            <CalendarClock size={14} className="mr-1.5" /> {running ? "Running..." : "Run due now"}
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="add-rule-btn">
            <Plus size={14} className="mr-1" /> New Rule
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-stone-300 rounded-2xl p-16 text-center">
          <Repeat size={32} className="text-stone-300 mx-auto mb-3" />
          <div className="font-['Outfit'] font-semibold text-stone-700">No recurring rules yet</div>
          <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">Set up a rule for any income, subscription, rent or transfer and Pocket will auto-create the records on schedule.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 mt-5 rounded-full" data-testid="empty-add-rule-btn">
            <Plus size={14} className="mr-1" /> Create first rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => {
            const cat = r.category_id ? categoryMap[r.category_id] : null;
            const parent = cat?.parent_id ? categoryMap[cat.parent_id] : null;
            const acc = accountMap[r.account_id];
            const toAcc = r.to_account_id ? accountMap[r.to_account_id] : null;
            const amountColor = r.type === "income" ? "text-emerald-600" : r.type === "expense" ? "text-rose-500" : "text-sky-600";
            return (
              <div key={r.id} data-testid={`rule-row-${r.id}`}
                className={`bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all ${r.active ? "border-stone-200 hover:border-emerald-500 hover:shadow-md" : "border-stone-200 opacity-60"}`}>
                {cat ? (
                  <CategoryIcon name={cat.icon} color={cat.color} size={44} iconSize={20} />
                ) : (
                  <CategoryIcon name="repeat" color="#06b6d4" size={44} iconSize={20} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-['Outfit'] font-semibold text-stone-900 truncate">{r.name}</span>
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{r.type}</span>
                    {!r.active && <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">Paused</span>}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {formatFreq(r.frequency, r.interval)} · {parent?.name || ""}{parent && cat && parent.name !== cat.name ? ` · ${cat.name}` : (cat && !parent ? cat.name : "")}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    {acc?.name}{toAcc ? ` → ${toAcc.name}` : ""} · Next: <span className="font-semibold text-stone-700">{format(new Date(r.next_run), "MMM d, yyyy")}</span>
                    {r.end_date && <> · Ends {format(new Date(r.end_date), "MMM d, yyyy")}</>}
                  </div>
                </div>
                <div className={`font-['Outfit'] font-bold text-lg ${amountColor}`}>
                  {r.type === "expense" ? "-" : r.type === "income" ? "+" : ""}{fmtCurrency(r.amount, acc?.currency)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" data-testid={`rule-menu-${r.id}`}>
                      <MoreVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true); }} data-testid={`rule-edit-${r.id}`}><Pencil size={14} className="mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(r)} data-testid={`rule-toggle-${r.id}`}>
                      {r.active ? <><Pause size={14} className="mr-2" />Pause</> : <><Play size={14} className="mr-2" />Activate</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(r)} className="text-rose-600" data-testid={`rule-delete-${r.id}`}><Trash2 size={14} className="mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <RecurringFormModal open={open} onOpenChange={setOpen} editRule={editing} onSaved={fetchRules} />
    </div>
  );
};

export default Recurring;
