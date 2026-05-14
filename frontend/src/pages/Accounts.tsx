import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, fmtCurrency, Account } from "@/lib/api";
import { Plus, MoreVertical, Archive, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import CategoryIcon from "@/components/CategoryIcon";
import { AddAccountModal } from "@/components/AddAccountModal";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const Accounts: React.FC = () => {
  const accounts = useAppStore((s) => s.accounts);
  const refreshAccounts = useAppStore((s) => s.refreshAccounts);
  const bumpRecords = useAppStore((s) => s.bumpRecords);

  const [open, setOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [showArchived, setShowArchived] = useState(false);

  const refresh = async () => {
    const { data } = await api.get<{ account_balances: Record<string, number> }>(
      "/analytics/summary",
      { params: { start_date: "1970-01-01", end_date: "2999-12-31" } }
    );
    setBalances(data.account_balances || {});
  };

  useEffect(() => { refresh(); }, [accounts]);

  const handleEdit = (a: Account) => { setEditAccount(a); setOpen(true); };
  const handleDelete = async (a: Account) => {
    if (!window.confirm(`Delete account "${a.name}"? Linked records will also be removed.`)) return;
    try { await api.delete(`/accounts/${a.id}`); toast.success("Account deleted"); await refreshAccounts(); bumpRecords(); }
    catch { toast.error("Failed to delete"); }
  };
  const handleArchive = async (a: Account) => {
    try { await api.patch(`/accounts/${a.id}`, { archived: !a.archived }); toast.success(a.archived ? "Restored" : "Archived"); await refreshAccounts(); }
    catch { toast.error("Failed to archive"); }
  };

  const visible = showArchived ? accounts : accounts.filter((a) => !a.archived);

  return (
    <div className="mx-auto max-w-7xl px-6 md:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Accounts</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-500" data-testid="show-archived-toggle">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-emerald-600" />
            Show archived
          </label>
          <Button onClick={() => { setEditAccount(null); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="add-account-btn">
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((a) => (
          <div key={a.id} data-testid={`account-card-${a.id}`}
               className={`relative bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all ${a.archived ? "opacity-60" : "border-stone-200"}`}>
            <div className="flex items-start justify-between">
              <CategoryIcon name={a.icon} color={a.color} size={48} iconSize={22} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" data-testid={`account-menu-${a.id}`}>
                    <MoreVertical size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(a)} data-testid={`account-edit-${a.id}`}><Pencil size={14} className="mr-2" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(a)} data-testid={`account-archive-${a.id}`}><Archive size={14} className="mr-2" />{a.archived ? "Restore" : "Archive"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(a)} className="text-rose-600" data-testid={`account-delete-${a.id}`}><Trash2 size={14} className="mr-2" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">{a.type}</div>
              <div className="font-['Outfit'] text-xl font-bold text-stone-900">{a.name}</div>
              <div className="font-['Outfit'] text-2xl font-bold mt-2" style={{ color: a.color }}>
                {fmtCurrency(balances[a.id] ?? a.initial_balance, a.currency)}
              </div>
              <div className="text-xs text-stone-500 mt-1">{a.currency}</div>
            </div>
          </div>
        ))}

        <button onClick={() => { setEditAccount(null); setOpen(true); }} data-testid="add-account-card"
                className="bg-stone-50 border-2 border-dashed border-stone-300 rounded-2xl p-8 flex flex-col items-center justify-center text-stone-500 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all min-h-[180px]">
          <Plus size={24} />
          <span className="mt-2 font-medium">Add Account</span>
        </button>
      </div>

      <AddAccountModal open={open} onOpenChange={setOpen} editAccount={editAccount} />
    </div>
  );
};

export default Accounts;
