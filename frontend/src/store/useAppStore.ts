import { create } from "zustand";
import { api, monthRange, Account, Category, Period } from "@/lib/api";

interface AppState {
  accounts: Account[];
  categories: Category[];
  period: Period;
  loading: boolean;
  recordsVersion: number;
  setPeriod: (p: Period) => void;
  bumpRecords: () => void;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  accounts: [],
  categories: [],
  period: monthRange(),
  loading: true,
  recordsVersion: 0,
  setPeriod: (p) => set({ period: p }),
  bumpRecords: () => set({ recordsVersion: get().recordsVersion + 1 }),
  refreshAccounts: async () => {
    const { data } = await api.get<Account[]>("/accounts");
    set({ accounts: data });
  },
  refreshCategories: async () => {
    const { data } = await api.get<Category[]>("/categories");
    set({ categories: data });
  },
  init: async () => {
    try {
      await Promise.all([get().refreshAccounts(), get().refreshCategories()]);
    } catch (e) {
      console.error(e);
    } finally {
      set({ loading: false });
    }
  },
}));

// Selectors
export const selectParentCategories = (state: AppState): Category[] =>
  state.categories.filter((c) => c.parent_id === null);

export const selectSubcategories = (state: AppState, parentId: string): Category[] =>
  state.categories.filter((c) => c.parent_id === parentId);

export const selectCategoryById = (state: AppState, id: string | null | undefined): Category | undefined =>
  id ? state.categories.find((c) => c.id === id) : undefined;
