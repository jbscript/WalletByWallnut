import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
export const API = `${BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API });

export type AccountType = "cash" | "bank" | "card" | "savings" | "investment";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string;
  archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  parent_id: string | null;
  external_id: string | null;
  is_default: boolean;
}

export type RecordType = "income" | "expense" | "transfer";

export interface Record {
  id: string;
  user_id: string;
  type: RecordType;
  amount: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string;
  payee: string;
  date: string;
  created_at: string;
}

export interface Period {
  start: string;
  end: string;
  label: string;
}

export const fmtCurrency = (n: number | null | undefined, currency = "INR"): string => {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `₹${v.toFixed(2)}`;
  }
};

export const monthRange = (refDate?: string | Date): Period => {
  const d = refDate ? new Date(refDate) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) };
};

export const prevMonthRange = (refDate?: string | Date): Period => {
  const d = refDate ? new Date(refDate) : new Date();
  return monthRange(new Date(d.getFullYear(), d.getMonth() - 1, 1));
};

export const shiftMonth = (yyyy_mm_dd: string, delta: number): string => {
  const d = new Date(yyyy_mm_dd);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
};
