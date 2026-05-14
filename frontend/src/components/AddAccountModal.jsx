import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { ICON_NAMES } from "@/components/CategoryIcon";
import CategoryIcon from "@/components/CategoryIcon";

const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#a855f7", "#84cc16", "#dc2626", "#0ea5e9", "#64748b"];
const TYPES = ["cash", "bank", "card", "savings", "investment"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"];

export const AddAccountModal = ({ open, onOpenChange, editAccount }) => {
  const { refreshAccounts } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [currency, setCurrency] = useState("INR");
  const [initialBalance, setInitialBalance] = useState("0");
  const [color, setColor] = useState("#06b6d4");
  const [icon, setIcon] = useState("wallet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && editAccount) {
      setName(editAccount.name);
      setType(editAccount.type);
      setCurrency(editAccount.currency);
      setInitialBalance(String(editAccount.initial_balance));
      setColor(editAccount.color);
      setIcon(editAccount.icon);
    } else if (open) {
      setName(""); setType("cash"); setCurrency("INR"); setInitialBalance("0");
      setColor("#06b6d4"); setIcon("wallet");
    }
  }, [open, editAccount]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Account name required");
    setSaving(true);
    try {
      const payload = { name: name.trim(), type, currency, initial_balance: Number(initialBalance) || 0, color, icon };
      if (editAccount) {
        await api.patch(`/accounts/${editAccount.id}`, payload);
        toast.success("Account updated");
      } else {
        await api.post("/accounts", payload);
        toast.success("Account created");
      }
      await refreshAccounts();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl" data-testid="add-account-dialog">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">{editAccount ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <CategoryIcon name={icon} color={color} size={56} iconSize={26} />
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cash, Savings, ..." data-testid="account-name-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="account-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger data-testid="account-currency-select"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Initial Balance</Label>
            <Input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} data-testid="account-balance-input" />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} data-testid={`color-${c}`}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-stone-900" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Icon</Label>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
              {ICON_NAMES.map((n) => (
                <button key={n} onClick={() => setIcon(n)} data-testid={`icon-${n}`}
                  className={`p-1.5 rounded-lg border transition-all ${icon === n ? "border-emerald-500 bg-emerald-50" : "border-stone-200"}`}>
                  <CategoryIcon name={n} color={color} size={28} iconSize={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6 bg-stone-50 rounded-b-3xl">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="account-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="account-save-btn">
            {saving ? "Saving..." : (editAccount ? "Update" : "Create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddAccountModal;
