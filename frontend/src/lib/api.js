import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fmtCurrency = (n, currency = "INR") => {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `₹${v.toFixed(2)}`;
  }
};

export const monthRange = (refDate) => {
  const d = refDate ? new Date(refDate) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) };
};

export const prevMonthRange = (refDate) => {
  const d = refDate ? new Date(refDate) : new Date();
  const dt = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return monthRange(dt);
};

export const shiftMonth = (yyyy_mm_dd, delta) => {
  const d = new Date(yyyy_mm_dd);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
};
