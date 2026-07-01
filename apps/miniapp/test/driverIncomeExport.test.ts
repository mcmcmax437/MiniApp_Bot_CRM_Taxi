import assert from "node:assert/strict";
import test from "node:test";

import type { DriverIncomeReport } from "@taxi/shared";
import {
  buildDriverIncomeCsv,
  filterDriverIncomeByMonths,
  monthKeyToFromDate,
  monthKeyToToDate,
} from "../src/components/reports/driverIncomeExport.ts";

const labels = {
  month: "Month",
  driver: "Driver",
  pesel: "PESEL",
  passport: "Passport",
  address: "Address",
  cash: "Cash",
  bank: "Bank",
  total: "Total",
  monthTotal: "Month total",
  grandTotal: "Grand total",
  unassignedDriver: "Unassigned",
  driverLabel: (name: string, id: string) => (name ? `${name} (${id})` : "Unassigned"),
  monthLabel: (monthKey: string) => `Label ${monthKey}`,
};

function reportFixture(): DriverIncomeReport {
  return {
    from: "2026-04-01T00:00:00.000Z",
    to: "2026-06-30T23:59:59.999Z",
    months: [
      {
        month: "2026-06",
        drivers: [
          {
            driverId: "driver-a",
            driverName: "Ada Cash",
            pesel: "12345678901",
            passportNumber: "PA-should-not-export",
            idDocument: "12345678901",
            address: "Warsaw, 00-001, Main; Street, 4, 7",
            cash: 100.125,
            bank: 25.1,
            total: 125.23,
          },
          {
            driverId: "",
            driverName: "",
            pesel: null,
            passportNumber: null,
            idDocument: "",
            address: "",
            cash: 10,
            bank: 0,
            total: 10,
          },
        ],
        totals: { cash: 110.13, bank: 25.1, total: 135.23 },
      },
      {
        month: "2026-05",
        drivers: [
          {
            driverId: "driver-b",
            driverName: "Bohdan Bank",
            pesel: null,
            passportNumber: "PB-42",
            idDocument: "PB-42",
            address: "Krakow, Old Town",
            cash: 0,
            bank: 200,
            total: 200,
          },
        ],
        totals: { cash: 0, bank: 200, total: 200 },
      },
      {
        month: "2026-04",
        drivers: [
          {
            driverId: "driver-c",
            driverName: "Cara Quote",
            pesel: null,
            passportNumber: 'PC-"77"',
            idDocument: 'PC-"77"',
            address: 'Gdansk, "Port"',
            cash: 30,
            bank: 40.56,
            total: 70.56,
          },
        ],
        totals: { cash: 30, bank: 40.56, total: 70.56 },
      },
    ],
    grandTotals: { cash: 140.13, bank: 265.66, total: 405.79 },
  };
}

test("filterDriverIncomeByMonths keeps selected months and recalculates grand totals", () => {
  const filtered = filterDriverIncomeByMonths(reportFixture(), new Set(["2026-06", "2026-04"]));

  assert.ok(filtered);
  assert.deepEqual(
    filtered.months.map((m) => m.month),
    ["2026-06", "2026-04"],
  );
  assert.deepEqual(filtered.grandTotals, { cash: 140.13, bank: 65.66, total: 205.79 });
});

test("filterDriverIncomeByMonths returns null when no visible months remain", () => {
  assert.equal(filterDriverIncomeByMonths(reportFixture(), new Set()), null);
  assert.equal(filterDriverIncomeByMonths(reportFixture(), new Set(["2025-12"])), null);
});

test("buildDriverIncomeCsv exports identity metadata for visible report rows", () => {
  const filtered = filterDriverIncomeByMonths(reportFixture(), new Set(["2026-06", "2026-04"]));
  assert.ok(filtered);

  const csv = buildDriverIncomeCsv(filtered, labels);

  assert.equal(
    csv,
    [
      "Month;Driver;PESEL;Passport;Address;Cash;Bank;Total",
      'Label 2026-06;Ada Cash (driver-a);12345678901;;"Warsaw, 00-001, Main; Street, 4, 7";100.13;25.10;125.23',
      "Label 2026-06;Unassigned;;;;10.00;0.00;10.00",
      "Label 2026-06;Month total;;;;110.13;25.10;135.23",
      "",
      'Label 2026-04;Cara Quote (driver-c);;"PC-""77""";"Gdansk, ""Port""";30.00;40.56;70.56',
      "Label 2026-04;Month total;;;;30.00;40.56;70.56",
      "",
      "Grand total;;;;;140.13;65.66;205.79",
    ].join("\r\n"),
  );
});

test("month key helpers produce month boundaries", () => {
  assert.equal(monthKeyToFromDate("2026-02"), "2026-02-01");
  assert.equal(monthKeyToToDate("2024-02"), "2024-02-29");
  assert.equal(monthKeyToToDate("not-a-month"), "not-a-month");
});
