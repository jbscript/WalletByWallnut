import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api, Category } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import CategoryIcon, { ICON_NAMES } from "@/components/CategoryIcon";

const COLORS = [
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
  "#94a3b8", "#64748b", "#dc2626", "#0ea5e9",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editCategory?: Category | null;
  defaultParentId?: string | null;
  defaultType?: "income" | "expense";
}

export const CategoryFormModal: React.FC<Props> = ({ open, onOpenChange, editCategory, defaultParentId, defaultType }) => {
  const refreshCategories = useAppStore((s) => s.refreshCategories);
  const categories = useAppStore((s) => s.categories);

  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [parentId, setParentId] = useState<string>("__root__"); // __root__ = top-level
  const [color, setColor] = useState("#10b981");
  const [icon, setIcon] = useState("tag");
  const [saving, setSaving] = useState(false);

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null && c.type === type),
    [categories, type]
  );

  useEffect(() => {
    if (!open) return;
    if (editCategory) {
      setName(editCategory.name);
      setType(editCategory.type);
      setParentId(editCategory.parent_id || "__root__");
      setColor(editCategory.color);
      setIcon(editCategory.icon);
    } else {
      setName("");
      setType(defaultType || "expense");
      setParentId(defaultParentId || "__root__");
      // If sub of a parent, inherit color/icon
      const p = defaultParentId ? categories.find((c) => c.id === defaultParentId) : null;
      setColor(p?.color || "#10b981");
      setIcon(p?.icon || "tag");
    }
  }, [open, editCategory, defaultParentId, defaultType, categories]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Category name required");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        color,
        icon,
        parent_id: parentId === "__root__" ? null : parentId,
      };
      if (editCategory) {
        await api.patch(`/categories/${editCategory.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/categories", payload);
        toast.success("Category created");
      }
      await refreshCategories();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const isSubcategory = parentId !== "__root__";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl" data-testid="category-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">{editCategory ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            {isSubcategory ? "A subcategory belongs to a parent group." : "Top-level categories group related subcategories."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <CategoryIcon name={icon} color={color} size={56} iconSize={26} />
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee, Books" data-testid="cat-name-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Type</Label>
              <Select value={type} onValueChange={(v: any) => { setType(v); setParentId("__root__"); }}>
                <SelectTrigger data-testid="cat-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Parent</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger data-testid="cat-parent-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— None (Top-level)</SelectItem>
                  {parents.filter((p) => !editCategory || p.id !== editCategory.id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Color</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} data-testid={`cat-color-${c}`}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-stone-900" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Icon</Label>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
              {ICON_NAMES.map((n) => (
                <button key={n} onClick={() => setIcon(n)} data-testid={`cat-icon-${n}`}
                  className={`p-1.5 rounded-lg border transition-all ${icon === n ? "border-emerald-500 bg-emerald-50" : "border-stone-200"}`}>
                  <CategoryIcon name={n} color={color} size={26} iconSize={13} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 -mx-6 px-6 -mb-6 pb-6 bg-stone-50 rounded-b-3xl">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="cat-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="cat-save-btn">
            {saving ? "Saving..." : (editCategory ? "Update" : "Create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryFormModal;
