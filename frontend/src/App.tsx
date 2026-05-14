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
          </Routes>
        </main>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </div>
  );
};

export default App;
