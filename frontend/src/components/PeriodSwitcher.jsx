import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { monthRange, shiftMonth } from "@/lib/api";

export const PeriodSwitcher = () => {
  const { period, setPeriod } = useApp();

  const move = (delta) => {
    const next = shiftMonth(period.start, delta);
    setPeriod(monthRange(next));
  };

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-stone-200 rounded-full p-1 shadow-sm">
      <button
        onClick={() => move(-1)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        data-testid="period-prev-btn"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="px-4 text-sm font-medium text-stone-900 font-['Outfit'] min-w-[140px] text-center" data-testid="period-label">
        {period.label}
      </div>
      <button
        onClick={() => move(1)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
        data-testid="period-next-btn"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

export default PeriodSwitcher;
