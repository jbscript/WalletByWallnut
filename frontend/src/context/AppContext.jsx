import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, monthRange } from "@/lib/api";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [period, setPeriod] = useState(monthRange());
  const [loading, setLoading] = useState(true);

  const refreshAccounts = useCallback(async () => {
    const { data } = await api.get("/accounts");
    setAccounts(data);
  }, []);

  const refreshCategories = useCallback(async () => {
    const { data } = await api.get("/categories");
    setCategories(data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refreshAccounts(), refreshCategories()]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAccounts, refreshCategories]);

  const value = {
    accounts,
    categories,
    period,
    setPeriod,
    loading,
    refreshAccounts,
    refreshCategories,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
