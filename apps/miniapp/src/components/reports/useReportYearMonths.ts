import { useState } from "react";
import {
  currentYear,
  yearToFromDate,
  yearToToDate,
} from "./driverIncomeExport";

export function useReportYearMonths() {
  const [year, setYear] = useState(currentYear);
  const [applied, setApplied] = useState(() => ({
    from: yearToFromDate(currentYear()),
    to: yearToToDate(currentYear()),
  }));
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  function changeYear(nextYear: number) {
    setYear(nextYear);
    setApplied({ from: yearToFromDate(nextYear), to: yearToToDate(nextYear) });
  }

  function syncAvailableMonths(monthKeys: string[]) {
    setSelectedMonths(new Set(monthKeys));
  }

  function toggleMonth(monthKey: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }

  function selectAllMonths(monthKeys: string[]) {
    setSelectedMonths(new Set(monthKeys));
  }

  return {
    year,
    changeYear,
    applied,
    selectedMonths,
    syncAvailableMonths,
    toggleMonth,
    selectAllMonths,
  };
}
