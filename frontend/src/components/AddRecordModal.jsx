import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalendarIcon, ArrowLeftRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CategoryIcon from "@/components/CategoryIcon";
import { useApp } from "@/context/AppContext";
import { api, fmtCurrency } from "@/lib/api";
import { format } from "date-fns";

const TYPES = [
  { id: "expense", label: "Expense", color: "rose" },
  { id: "income", label: "Income", color: "emerald" },
  { id: "transfer", label: "Transfer", color: "sky" },
];

export const AddRecordModal = ({ open, onOpenChange, onSaved, editRecord }) => {
  const { accounts, categories } = useApp();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [payee, setPayee] = useState("");
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !editRecord) {
      // reset defaults
      setType("expense");
      setAmount("");
      setAccountId(accounts[0]?.id || "");
      setToAccountId(accounts[1]?.id || "");
      setCategoryId("");
      setNote("");
      setPayee("");
      setDate(new Date());
    }
    if (open && editRecord) {
      setType(editRecord.type);
      setAmount(String(editRecord.amount));
      setAccountId(editRecord.account_id);
      setToAccountId(editRecord.to_account_id || "");
      setCategoryId(editRecord.category_id || "");
      setNote(editRecord.note || "");
      setPayee(editRecord.payee || "");
      setDate(new Date(editRecord.date));
    }
  }, [open, accounts, editRecord]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (type === "income" ? c.type === "income" : c.type === "expense")),
    [categories, type]
  );

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    if (!accountId) return toast.error("Choose an account");
    if (type === "transfer" && !toAccountId) return toast.error("Choose destination account");
    if (type === "transfer" && toAccountId === accountId) return toast.error("Pick a different destination");
    setSaving(true);
    try {
      const payload = {
        type,
        amount: Number(amount),
        account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category_id: type === "transfer" ? null : (categoryId || null),
        note,
        payee,
        date: format(date, "yyyy-MM-dd"),
      };
      if (editRecord) {
        await api.patch(`/records/${editRecord.id}`, payload);
        toast.success("Record updated");
      } else {
        await api.post("/records", payload);
        toast.success("Record added");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const amountColor = type === "income" ? "text-emerald-600" : type === "expense" ? "text-rose-500" : "text-sky-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden" data-testid="add-record-dialog">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="font-['Outfit'] text-xl">{editRecord ? "Edit Record" : "New Record"}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Type tabs */}
        <div className="px-6">
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

        {/* Amount */}
        <div className="px-6 pt-4 pb-2">
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

        <div className="px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* Accounts */}
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

          {/* Category */}
          {type !== "transfer" && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Category</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    data-testid={`category-pick-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      categoryId === c.id ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <CategoryIcon name={c.icon} color={c.color} size={36} iconSize={16} />
                    <span className="text-[11px] font-medium text-stone-700 text-center line-clamp-2">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note / Payee / Date */}
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

        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
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
