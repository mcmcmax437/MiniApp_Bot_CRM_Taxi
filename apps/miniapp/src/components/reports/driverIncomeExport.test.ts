import assert from "node:assert/strict";
import test from "node:test";
import { buildDriverIncomeCsv } from "./driverIncomeExport.js";
import type { DriverIncomeReport } from "@taxi/shared";

const labels = {
  month: "Month",
  driver: "Driver",
  cash: "Cash",
  bank: "Bank",
  total: "Total",
  monthTotal: "Month total",
  grandTotal: "Grand total",
  unassignedDriver: "Unassigned",
  driverLabel: (name: string, id: string) => (id ? `${name} (${id})` : "Unassigned"),
  monthLabel: (monthKey: string) => `Label;${monthKey}`,
};

test("buildDriverIncomeCsv writes escaped driver rows, month totals, and grand totals", () => {
  const report: DriverIncomeReport = {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-30T23:59:59.999Z",
    months: [
      {
        month: "2026-06",
        drivers: [
          {
            driverId: "driver-1",
            driverName: 'Ann "The Boss"; Smith',
            cash: 12,
            bank: 3.5,
            total: 15.5,
          },
          {
            driverId: "",
            driverName: "",
            cash: 1.2,
            bank: 0,
            total: 1.2,
          },
        ],
        totals: { cash: 13.2, bank: 3.5, total: 16.7 },
      },
    ],
    grandTotals: { cash: 13.2, bank: 3.5, total: 16.7 },
  };

  assert.equal(
    buildDriverIncomeCsv(report, labels),
    [
      "Month;Driver;Cash;Bank;Total",
      '"Label;2026-06";"Ann ""The Boss""; Smith (driver-1)";12.00;3.50;15.50',
      '"Label;2026-06";Unassigned;1.20;0.00;1.20',
      '"Label;2026-06";Month total;13.20;3.50;16.70',
      "",
      "Grand total;;13.20;3.50;16.70",
    ].join("\r\n"),
  );
});

test("buildDriverIncomeCsv keeps an empty report exportable", () => {
  const report: DriverIncomeReport = {
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-30T23:59:59.999Z",
    months: [],
    grandTotals: { cash: 0, bank: 0, total: 0 },
  };

  assert.equal(
    buildDriverIncomeCsv(report, labels),
    ["Month;Driver;Cash;Bank;Total", "Grand total;;0.00;0.00;0.00"].join("\r\n"),
  );
});
