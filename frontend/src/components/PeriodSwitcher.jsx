import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useApp } from "@/context/AppContext";
import { monthRange, shiftMonth } from "@/lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PeriodSwitcher = () => {
  const { period, setPeriod } = useApp();
  const [open, setOpen] = useState(false);

  const cur = new Date(period.start);
  const curYear = cur.getFullYear();
  const curMonth = cur.getMonth();
  const [pickerYear, setPickerYear] = useState(curYear);

  const move = (delta) => {
    const next = shiftMonth(period.start, delta);
    setPeriod(monthRange(next));
  };

  const pickMonth = (m) => {
    const d = new Date(pickerYear, m, 1);
    setPeriod(monthRange(d.toISOString().slice(0, 10)));
    setOpen(false);
  };

  const presets = [
    { label: "This month", get: () => new Date() },
    { label: "Last month", get: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; } },
    { label: "3 months ago", get: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; } },
    { label: "Same month last year", get: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d; } },
  ];

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-stone-200 rounded-full p-1 shadow-sm" data-testid="period-switcher">
      <button
        onClick={() => move(-1)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        data-testid="period-prev-btn"
        aria-label="Previous month"
      >
        <ChevronLeft size={18} strokeWidth={2.2} />
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="px-4 h-9 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-stone-900 font-['Outfit'] hover:bg-stone-50 transition-colors min-w-[150px] justify-center leading-none"
            data-testid="period-label"
          >
            <CalendarIcon size={14} className="text-emerald-600" />
            <span className="whitespace-nowrap">{period.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 rounded-2xl overflow-hidden" align="end">
          {/* Year header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <button
              onClick={() => setPickerYear((y) => y - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-stone-500 hover:bg-white hover:text-stone-900 transition-colors"
              data-testid="picker-year-prev"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="font-['Outfit'] font-bold text-lg text-stone-900" data-testid="picker-year-label">{pickerYear}</div>
            <button
              onClick={() => setPickerYear((y) => y + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-stone-500 hover:bg-white hover:text-stone-900 transition-colors"
              data-testid="picker-year-next"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2 p-3">
            {MONTHS.map((m, i) => {
              const isActive = pickerYear === curYear && i === curMonth;
              const isToday = pickerYear === new Date().getFullYear() && i === new Date().getMonth();
              return (
                <button
                  key={m}
                  onClick={() => pickMonth(i)}
                  data-testid={`picker-month-${m.toLowerCase()}`}
                  className={`relative py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {m}
                  {isToday && !isActive && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Presets */}
          <div className="border-t border-stone-200 p-2">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-stone-400 px-2 py-1">Quick jump</div>
            <div className="grid grid-cols-2 gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setPeriod(monthRange(p.get().toISOString().slice(0, 10))); setPickerYear(p.get().getFullYear()); setOpen(false); }}
                  data-testid={`preset-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-left text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        onClick={() => move(1)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        data-testid="period-next-btn"
        aria-label="Next month"
      >
        <ChevronRight size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
};

export default PeriodSwitcher;
