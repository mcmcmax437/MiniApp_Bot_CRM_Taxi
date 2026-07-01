import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DriverIncomeReport, PartnerSettlementReport } from "@taxi/shared";
import {
  currentMonthKey,
  currentYear,
  filterDriverIncomeByMonths,
  monthKeyToToDate,
  selectableYears,
  yearToFromDate,
  yearToToDate,
} from "./driverIncomeExport";
import { filterPartnerSettlementByMonths } from "./partnerSettlementExport";

describe("report year helpers", () => {
  it("builds year query ranges without requesting future dates", () => {
    const year = currentYear();

    assert.equal(yearToFromDate(year), `${year}-01-01`);
    assert.equal(yearToToDate(year - 1), `${year - 1}-12-31`);
    assert.equal(yearToToDate(year + 1), `${year + 1}-01-01`);
    assert.equal(yearToToDate(year), monthKeyToToDate(currentMonthKey()));
  });

  it("lists selectable report years newest first", () => {
    const year = currentYear();

    assert.deepEqual(selectableYears(year - 2), [year, year - 1, year - 2]);
  });
});

describe("filterDriverIncomeByMonths", () => {
  it("keeps selected months in report order and recalculates grand totals", () => {
    const report: DriverIncomeReport = {
      from: "2026-01-01",
      to: "2026-03-31",
      grandTotals: { cash: 999, bank: 999, total: 999 },
      months: [
        driverMonth("2026-01", 10.005, 0.1),
        driverMonth("2026-02", 50, 5),
        driverMonth("2026-03", 20.005, 0.2),
      ],
    };

    const filtered = filterDriverIncomeByMonths(report, new Set(["2026-03", "2026-01"]));

    assert.ok(filtered);
    assert.deepEqual(
      filtered.months.map((month) => month.month),
      ["2026-01", "2026-03"],
    );
    assert.deepEqual(filtered.grandTotals, {
      cash: 30.01,
      bank: 0.3,
      total: 30.31,
    });
  });

  it("returns null when no selected month is available", () => {
    const report: DriverIncomeReport = {
      from: "2026-01-01",
      to: "2026-01-31",
      grandTotals: { cash: 10, bank: 1, total: 11 },
      months: [driverMonth("2026-01", 10, 1)],
    };

    assert.equal(filterDriverIncomeByMonths(report, new Set()), null);
    assert.equal(filterDriverIncomeByMonths(report, new Set(["2026-02"])), null);
  });
});

describe("filterPartnerSettlementByMonths", () => {
  it("keeps selected months and recalculates settlement totals", () => {
    const report: PartnerSettlementReport = {
      from: "2026-01-01",
      to: "2026-03-31",
      totals: {
        partnerOwesYou: 999,
        youOwePartner: 999,
        netBalance: 999,
        partnerCollectedTotal: 999,
        partnerExpensesTotal: 999,
      },
      months: [
        partnerMonth("2026-01", 10.005, 3.335, 12.005, 4.445),
        partnerMonth("2026-02", 50, 5, 60, 6),
        partnerMonth("2026-03", 3.335, 1.105, 9.105, 2.225),
      ],
    };

    const filtered = filterPartnerSettlementByMonths(report, new Set(["2026-03", "2026-01"]));

    assert.ok(filtered);
    assert.deepEqual(
      filtered.months.map((month) => month.month),
      ["2026-01", "2026-03"],
    );
    assert.deepEqual(filtered.totals, {
      partnerOwesYou: 13.34,
      youOwePartner: 4.44,
      netBalance: 8.9,
      partnerCollectedTotal: 21.11,
      partnerExpensesTotal: 6.67,
    });
  });

  it("returns null when no selected settlement month is available", () => {
    const report: PartnerSettlementReport = {
      from: "2026-01-01",
      to: "2026-01-31",
      totals: {
        partnerOwesYou: 10,
        youOwePartner: 2,
        netBalance: 8,
        partnerCollectedTotal: 12,
        partnerExpensesTotal: 3,
      },
      months: [partnerMonth("2026-01", 10, 2, 12, 3)],
    };

    assert.equal(filterPartnerSettlementByMonths(report, new Set()), null);
    assert.equal(filterPartnerSettlementByMonths(report, new Set(["2026-02"])), null);
  });
});

function driverMonth(month: string, cash: number, bank: number): DriverIncomeReport["months"][number] {
  return {
    month,
    drivers: [
      {
        driverId: `driver-${month}`,
        driverName: `Driver ${month}`,
        pesel: null,
        passportNumber: null,
        idDocument: "",
        address: "",
        cash,
        bank,
        total: cash + bank,
      },
    ],
    totals: { cash, bank, total: cash + bank },
  };
}

function partnerMonth(
  month: string,
  partnerOwesYou: number,
  youOwePartner: number,
  partnerCollectedTotal: number,
  partnerExpensesTotal: number,
): PartnerSettlementReport["months"][number] {
  return {
    month,
    partnerOwesYou,
    youOwePartner,
    netBalance: partnerOwesYou - youOwePartner,
    partnerCollectedTotal,
    partnerExpensesTotal,
    payments: [],
    expenses: [],
  };
}
