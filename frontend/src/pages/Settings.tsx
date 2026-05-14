import React, { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, Category } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { CategoryFormModal } from "@/components/CategoryFormModal";
import { toast } from "sonner";

const Settings: React.FC = () => {
  const categories = useAppStore((s) => s.categories);
  const refreshCategories = useAppStore((s) => s.refreshCategories);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groupedByType = useMemo(() => {
    const result: Record<"expense" | "income", { parent: Category; children: Category[] }[]> = {
      expense: [],
      income: [],
    };
    const parents = categories.filter((c) => c.parent_id === null);
    for (const p of parents) {
      const children = categories.filter((c) => c.parent_id === p.id);
      result[p.type].push({ parent: p, children });
    }
    return result;
  }, [categories]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const handleAddParent = (type: "expense" | "income") => {
    setEditing(null);
    setDefaultParentId(null);
    setDefaultType(type);
    setOpen(true);
  };

  const handleAddSub = (parent: Category) => {
    setEditing(null);
    setDefaultParentId(parent.id);
    setDefaultType(parent.type);
    setOpen(true);
  };

  const handleEdit = (c: Category) => {
    setEditing(c);
    setDefaultParentId(c.parent_id);
    setOpen(true);
  };

  const handleDelete = async (c: Category) => {
    const subsCount = categories.filter((x) => x.parent_id === c.id).length;
    const warning = c.parent_id === null
      ? `Delete "${c.name}" and ${subsCount} subcategories? Records under them will become uncategorised.`
      : `Delete subcategory "${c.name}"? Records under it will become uncategorised.`;
    if (!window.confirm(warning)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success("Deleted");
      await refreshCategories();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    }
  };

  const renderGroup = (parent: Category, children: Category[]) => {
    const isOpen = expanded[parent.id] !== false; // default open
    return (
      <div key={parent.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden" data-testid={`settings-parent-${parent.id}`}>
        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
          <button onClick={() => toggle(parent.id)} className="shrink-0 text-stone-400 hover:text-stone-900" data-testid={`toggle-${parent.id}`}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <CategoryIcon name={parent.icon} color={parent.color} size={40} iconSize={18} />
          <div className="flex-1 min-w-0">
            <div className="font-['Outfit'] font-semibold text-stone-900 truncate">{parent.name}</div>
            <div className="text-xs text-stone-500">{children.length} subcategor{children.length === 1 ? "y" : "ies"}{parent.is_default ? " · default" : ""}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => handleAddSub(parent)} className="text-xs h-8 rounded-full" data-testid={`add-sub-${parent.id}`}>
            <Plus size={12} className="mr-1" /> Sub
          </Button>
          <button onClick={() => handleEdit(parent)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" data-testid={`edit-${parent.id}`} aria-label="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={() => handleDelete(parent)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" data-testid={`delete-${parent.id}`} aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>

        {isOpen && children.length > 0 && (
          <div className="border-t border-stone-100 bg-stone-50/40 divide-y divide-stone-100">
            {children.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 pl-12" data-testid={`settings-sub-${sub.id}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sub.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">{sub.name}</div>
                  {sub.external_id && <div className="text-[10px] text-stone-400 font-mono">{sub.external_id}</div>}
                </div>
                <button onClick={() => handleEdit(sub)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" data-testid={`edit-${sub.id}`} aria-label="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(sub)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" data-testid={`delete-${sub.id}`} aria-label="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {isOpen && children.length === 0 && (
          <div className="px-4 py-3 pl-12 text-xs text-stone-400 italic border-t border-stone-100">No subcategories yet — click <span className="font-semibold">+ Sub</span> to add one.</div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-stone-900 text-white">
            <SettingsIcon size={18} />
          </span>
          <div>
            <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Categories</h1>
            <p className="text-sm text-stone-500">Manage categories and subcategories used across your records.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="expense" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-stone-100 rounded-full p-1 inline-flex">
            <TabsTrigger value="expense" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4" data-testid="settings-tab-expense">
              Expense ({groupedByType.expense.length})
            </TabsTrigger>
            <TabsTrigger value="income" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm px-4" data-testid="settings-tab-income">
              Income ({groupedByType.income.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="expense" className="space-y-3">
          <Button onClick={() => handleAddParent("expense")} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="add-expense-parent-btn">
            <Plus size={14} className="mr-1" /> New Expense Category
          </Button>
          <div className="space-y-3">
            {groupedByType.expense.map(({ parent, children }) => renderGroup(parent, children))}
            {groupedByType.expense.length === 0 && (
              <div className="text-center text-stone-400 py-12 bg-white border border-dashed border-stone-300 rounded-2xl">
                No expense categories. Click the button above to add one.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-3">
          <Button onClick={() => handleAddParent("income")} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="add-income-parent-btn">
            <Plus size={14} className="mr-1" /> New Income Category
          </Button>
          <div className="space-y-3">
            {groupedByType.income.map(({ parent, children }) => renderGroup(parent, children))}
            {groupedByType.income.length === 0 && (
              <div className="text-center text-stone-400 py-12 bg-white border border-dashed border-stone-300 rounded-2xl">
                No income categories. Click the button above to add one.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CategoryFormModal
        open={open}
        onOpenChange={setOpen}
        editCategory={editing}
        defaultParentId={defaultParentId}
        defaultType={defaultType}
      />
    </div>
  );
};

export default Settings;
