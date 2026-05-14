import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import TopNav from "@/components/TopNav";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import Records from "@/pages/Records";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Recurring from "@/pages/Recurring";
import Import from "@/pages/Import";

const App: React.FC = () => {
  const init = useAppStore((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <div className="App min-h-screen">
      <BrowserRouter>
        <TopNav />
        <main className="min-h-[calc(100vh-4rem)]">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/records" element={<Records />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </div>
  );
};

export default App;
