import { useCallback, useRef, useState } from "react";
import {
  currentYear,
  yearToFromDate,
  yearToToDate,
} from "./driverIncomeExport";

function sameMonthSet(set: Set<string>, monthKeys: string[]): boolean {
  if (set.size !== monthKeys.length) return false;
  return monthKeys.every((monthKey) => set.has(monthKey));
}

export function useReportYearMonths() {
  const [year, setYear] = useState(currentYear);
  const [applied, setApplied] = useState(() => ({
    from: yearToFromDate(currentYear()),
    to: yearToToDate(currentYear()),
  }));
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const availableMonthsRef = useRef<Set<string>>(new Set());

  const changeYear = useCallback((nextYear: number) => {
    setYear(nextYear);
    setApplied({ from: yearToFromDate(nextYear), to: yearToToDate(nextYear) });
  }, []);

  const syncAvailableMonths = useCallback((monthKeys: string[]) => {
    const previousAvailable = availableMonthsRef.current;
    availableMonthsRef.current = new Set(monthKeys);

    setSelectedMonths((prev) => {
      const next = new Set<string>();
      for (const monthKey of monthKeys) {
        if (prev.has(monthKey) || !previousAvailable.has(monthKey)) {
          next.add(monthKey);
        }
      }
      return sameMonthSet(prev, [...next]) ? prev : next;
    });
  }, []);

  const toggleMonth = useCallback((monthKey: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  const selectAllMonths = useCallback((monthKeys: string[]) => {
    setSelectedMonths(new Set(monthKeys));
  }, []);

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
