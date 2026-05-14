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
import { toast } from "sonner";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CategoryIcon from "@/components/CategoryIcon";
import { useAppStore } from "@/store/useAppStore";
import { api, Record as RecordEntity, RecordType } from "@/lib/api";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  editRecord?: RecordEntity | null;
}

const TYPES: { id: RecordType; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income",  label: "Income"  },
  { id: "transfer", label: "Transfer" },
];

export const AddRecordModal: React.FC<Props> = ({ open, onOpenChange, onSaved, editRecord }) => {
  const accounts = useAppStore((s) => s.accounts);
  const categories = useAppStore((s) => s.categories);
  const bumpRecords = useAppStore((s) => s.bumpRecords);

  const [type, setType] = useState<RecordType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editRecord) {
      setType(editRecord.type);
      setAmount(String(editRecord.amount));
      setAccountId(editRecord.account_id);
      setToAccountId(editRecord.to_account_id || "");
      setCategoryId(editRecord.category_id || "");
      const sub = categories.find((c) => c.id === editRecord.category_id);
      setSelectedParentId(sub?.parent_id || null);
      setNote(editRecord.note || "");
      setPayee(editRecord.payee || "");
      setDate(new Date(editRecord.date));
    } else {
      setType("expense");
      setAmount("");
      setAccountId(accounts[0]?.id || "");
      setToAccountId(accounts[1]?.id || "");
      setCategoryId("");
      setSelectedParentId(null);
      setNote("");
      setPayee("");
      setDate(new Date());
    }
  }, [open, editRecord, accounts, categories]);

  // Reset selected parent when switching type
  useEffect(() => {
    if (!editRecord) {
      setSelectedParentId(null);
      setCategoryId("");
    }
  }, [type, editRecord]);

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null && c.type === (type === "income" ? "income" : "expense")),
    [categories, type]
  );

  const subs = useMemo(
    () => (selectedParentId ? categories.filter((c) => c.parent_id === selectedParentId) : []),
    [categories, selectedParentId]
  );

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    if (!accountId) return toast.error("Choose an account");
    if (type === "transfer") {
      if (!toAccountId) return toast.error("Choose destination account");
      if (toAccountId === accountId) return toast.error("Pick a different destination");
    }
    setSaving(true);
    try {
      const payload = {
        type, amount: Number(amount), account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category_id: type === "transfer" ? null : (categoryId || null),
        note, payee, date: format(date, "yyyy-MM-dd"),
      };
      if (editRecord) {
        await api.patch(`/records/${editRecord.id}`, payload);
        toast.success("Record updated");
      } else {
        await api.post("/records", payload);
        toast.success("Record added");
      }
      onOpenChange(false);
      bumpRecords();
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const amountColor = type === "income" ? "text-emerald-600" : type === "expense" ? "text-rose-500" : "text-sky-600";
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedParent = categories.find((c) => c.id === selectedParentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col" data-testid="add-record-dialog">
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-xl">{editRecord ? "Edit Record" : "New Record"}</DialogTitle>
            <DialogDescription className="text-sm text-stone-500">Capture income, expense, or transfer between accounts.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 shrink-0">
          <div className="inline-flex bg-stone-100 p-1 rounded-full">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                data-testid={`record-type-${t.id}`}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  type === t.id ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-end justify-center gap-1 border-b border-stone-200 pb-3">
            <span className={`font-['Outfit'] text-3xl font-semibold ${amountColor}`}>
              {type === "expense" ? "-" : type === "income" ? "+" : ""}₹
            </span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="record-amount-input"
              className={`font-['Outfit'] text-5xl font-bold bg-transparent outline-none w-full text-center ${amountColor}`}
            />
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          {type === "transfer" ? (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">From</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger data-testid="record-account-select"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">To</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger data-testid="record-to-account-select"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger data-testid="record-account-select"><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {type !== "transfer" && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Category</Label>
                {selectedParentId && (
                  <button
                    onClick={() => setSelectedParentId(null)}
                    className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
                    data-testid="category-back-btn"
                  >
                    <ChevronLeft size={12} /> Back
                  </button>
                )}
              </div>

              {selectedParentId && selectedParent && (
                <div className="flex items-center gap-2 my-2 px-2 py-1.5 bg-stone-50 rounded-lg">
                  <CategoryIcon name={selectedParent.icon} color={selectedParent.color} size={24} iconSize={12} />
                  <span className="text-sm font-medium text-stone-700">{selectedParent.name}</span>
                </div>
              )}

              {!selectedParentId ? (
                <div className="grid grid-cols-3 gap-2 mt-2" data-testid="parent-category-grid">
                  {parents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedParentId(p.id)}
                      data-testid={`parent-pick-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        categories.find((c) => c.id === categoryId)?.parent_id === p.id
                          ? "border-emerald-500 bg-emerald-50/60"
                          : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <CategoryIcon name={p.icon} color={p.color} size={40} iconSize={18} />
                      <span className="text-[11px] font-semibold text-stone-700 text-center leading-tight line-clamp-2">{p.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-72 overflow-y-auto" data-testid="sub-category-grid">
                  {subs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCategoryId(s.id)}
                      data-testid={`sub-pick-${s.id}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        categoryId === s.id ? "border-emerald-500 bg-emerald-50/60" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-medium text-stone-700 truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedCategory && (
                <div className="text-xs text-stone-500 mt-2">
                  Selected: <span className="font-semibold text-stone-900">{categories.find(c => c.id === selectedCategory.parent_id)?.name} · {selectedCategory.name}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Payee</Label>
              <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Starbucks" data-testid="record-payee-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="record-date-btn">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" data-testid="record-note-input" rows={2} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="record-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="record-save-btn">
            {saving ? "Saving..." : (editRecord ? "Update" : "Save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddRecordModal;
