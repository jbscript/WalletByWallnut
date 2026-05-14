import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Plus, Wallet } from "lucide-react";
import { AddRecordModal } from "@/components/AddRecordModal";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/accounts", label: "Accounts" },
  { to: "/records", label: "Records" },
  { to: "/analytics", label: "Analytics" },
];

export const TopNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass-nav sticky top-0 z-50 border-b border-stone-200">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <NavLink to="/" className="flex items-center gap-2.5" data-testid="brand-link">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600 shadow-sm shadow-emerald-200">
              <Wallet size={18} className="text-white" strokeWidth={2.4} />
            </span>
            <span className="font-['Outfit'] font-bold text-lg tracking-tight text-stone-900">Pocket</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-testid={`nav-${l.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? "text-emerald-600" : "text-stone-500 hover:text-stone-900"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            data-testid="open-add-record-btn"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold pl-3 pr-4 py-2 rounded-full transition-all hover:-translate-y-0.5 shadow-sm shadow-emerald-200"
          >
            <Plus size={16} strokeWidth={2.5} />
            Record
          </button>
          <div className="flex items-center gap-2 pl-2">
            <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-['Outfit'] font-semibold text-sm ring-2 ring-stone-100">D</div>
          </div>
        </div>
      </div>
      <AddRecordModal open={open} onOpenChange={setOpen} />
    </header>
  );
};

export default TopNav;
