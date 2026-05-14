import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { format } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";

interface RuleEntity {
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editRule?: RuleEntity | null;
  onSaved?: () => void;
}

const TYPES: { id: "income" | "expense" | "transfer"; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
];

export const RecurringFormModal: React.FC<Props> = ({ open, onOpenChange, editRule, onSaved }) => {
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);

  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [interval, setInterval] = useState("1");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null && c.type === (type === "income" ? "income" : "expense")),
    [categories, type]
  );
  const subs = useMemo(
    () => (selectedParentId ? categories.filter((c) => c.parent_id === selectedParentId) : []),
    [categories, selectedParentId]
  );

  useEffect(() => {
    if (!open) return;
    if (editRule) {
      setName(editRule.name);
      setType(editRule.type);
      setAmount(String(editRule.amount));
      setAccountId(editRule.account_id);
      setToAccountId(editRule.to_account_id || "");
      const sub = categories.find((c) => c.id === editRule.category_id);
      setSelectedParentId(sub?.parent_id || "");
      setCategoryId(editRule.category_id || "");
      setFrequency(editRule.frequency);
      setInterval(String(editRule.interval));
      setStartDate(new Date(editRule.start_date));
      setEndDate(editRule.end_date ? new Date(editRule.end_date) : null);
      setPayee(editRule.payee || "");
      setNote((editRule.note || "").replace(/\s*\[recurring\]\s*$/i, ""));
    } else {
      setName("");
      setType("expense");
      setAmount("");
      setAccountId(accounts[0]?.id || "");
      setToAccountId(accounts[1]?.id || "");
      setSelectedParentId("");
      setCategoryId("");
      setFrequency("monthly");
      setInterval("1");
      setStartDate(new Date());
      setEndDate(null);
      setPayee("");
      setNote("");
    }
  }, [open, editRule, accounts, categories]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!amount || Number(amount) <= 0) return toast.error("Valid amount required");
    if (!accountId) return toast.error("Choose account");
    if (type === "transfer") {
      if (!toAccountId) return toast.error("Choose destination");
      if (toAccountId === accountId) return toast.error("Destination must differ");
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        amount: Number(amount),
        account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category_id: type === "transfer" ? null : (categoryId || null),
        payee,
        note,
        frequency,
        interval: Math.max(1, Number(interval) || 1),
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      };
      if (editRule) {
        await api.patch(`/recurring/${editRule.id}`, payload);
        toast.success("Rule updated");
      } else {
        await api.post("/recurring", payload);
        toast.success("Rule created");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col" data-testid="recurring-dialog">
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-xl">{editRule ? "Edit recurring rule" : "New recurring rule"}</DialogTitle>
            <DialogDescription className="text-sm text-stone-500">Auto-create records on a schedule.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 shrink-0">
          <div className="inline-flex bg-stone-100 p-1 rounded-full">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setType(t.id); setSelectedParentId(""); setCategoryId(""); }}
                data-testid={`recur-type-${t.id}`}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  type === t.id ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Rule name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix subscription" data-testid="recur-name-input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-testid="recur-amount-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger data-testid="recur-account-select"><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "transfer" && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">To account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger data-testid="recur-to-account-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {type !== "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Category</Label>
                <Select value={selectedParentId} onValueChange={(v) => { setSelectedParentId(v); setCategoryId(""); }}>
                  <SelectTrigger data-testid="recur-parent-select"><SelectValue placeholder="Pick parent" /></SelectTrigger>
                  <SelectContent>
                    {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Subcategory</Label>
                <Select value={categoryId} onValueChange={setCategoryId} disabled={!selectedParentId}>
                  <SelectTrigger data-testid="recur-sub-select"><SelectValue placeholder={selectedParentId ? "Pick sub" : "—"} /></SelectTrigger>
                  <SelectContent>
                    {subs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Frequency</Label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger data-testid="recur-frequency-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Every</Label>
              <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} data-testid="recur-interval-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Start date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="recur-start-btn">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">End date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="recur-end-btn">
                    <CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "PPP") : "Never"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="p-3 border-b">
                    <button onClick={() => setEndDate(null)} className="text-xs text-stone-500 hover:text-stone-900" data-testid="recur-end-clear">Clear (never)</button>
                  </div>
                  <Calendar mode="single" selected={endDate || undefined} onSelect={(d) => setEndDate(d || null)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Payee</Label>
            <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Netflix" data-testid="recur-payee-input" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} data-testid="recur-note-input" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="recur-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="recur-save-btn">
            {saving ? "Saving..." : (editRule ? "Update" : "Create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringFormModal;
