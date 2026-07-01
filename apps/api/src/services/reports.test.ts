import assert from "node:assert/strict";
import test from "node:test";
import { buildDriverIncomeReportFromRows } from "./driver-income-report.js";

const from = new Date("2026-05-01T00:00:00.000Z");
const to = new Date("2026-06-30T23:59:59.999Z");

test("buildDriverIncomeReportFromRows groups rent and fine income by UTC month, driver, and method", () => {
  const report = buildDriverIncomeReportFromRows(
    [
      {
        driverId: "driver-1",
        amount: 100.1,
        method: "CASH",
        date: new Date("2026-06-03T12:00:00.000Z"),
      },
      {
        driverId: "driver-1",
        amount: 0.2,
        method: "CASH",
        date: new Date("2026-06-04T12:00:00.000Z"),
      },
      {
        driverId: "driver-1",
        amount: 25.35,
        method: "BANK",
        date: new Date("2026-06-05T12:00:00.000Z"),
      },
      {
        driverId: "driver-2",
        amount: 10,
        method: "CASH",
        date: new Date("2026-06-06T12:00:00.000Z"),
      },
      {
        driverId: null,
        amount: 7,
        method: "CASH",
        date: new Date("2026-06-07T12:00:00.000Z"),
      },
      {
        driverId: "driver-2",
        amount: 80,
        method: "BANK",
        date: new Date("2026-05-20T12:00:00.000Z"),
      },
    ],
    [
      { id: "driver-1", fullName: "Ada Lovelace" },
      { id: "driver-2", fullName: "Grace Hopper" },
    ],
    from,
    to,
  );

  assert.equal(report.from, "2026-05-01T00:00:00.000Z");
  assert.equal(report.to, "2026-06-30T23:59:59.999Z");
  assert.deepEqual(report.months, [
    {
      month: "2026-06",
      drivers: [
        {
          driverId: "driver-1",
          driverName: "Ada Lovelace",
          cash: 100.3,
          bank: 25.35,
          total: 125.65,
        },
        {
          driverId: "driver-2",
          driverName: "Grace Hopper",
          cash: 10,
          bank: 0,
          total: 10,
        },
        {
          driverId: "",
          driverName: "",
          cash: 7,
          bank: 0,
          total: 7,
        },
      ],
      totals: { cash: 117.3, bank: 25.35, total: 142.65 },
    },
    {
      month: "2026-05",
      drivers: [
        {
          driverId: "driver-2",
          driverName: "Grace Hopper",
          cash: 0,
          bank: 80,
          total: 80,
        },
      ],
      totals: { cash: 0, bank: 80, total: 80 },
    },
  ]);
  assert.deepEqual(report.grandTotals, { cash: 117.3, bank: 105.35, total: 222.65 });
});

test("buildDriverIncomeReportFromRows returns stable zero totals when there are no payments", () => {
  const report = buildDriverIncomeReportFromRows([], [{ id: "driver-1", fullName: "Ada" }], from, to);

  assert.deepEqual(report, {
    from: "2026-05-01T00:00:00.000Z",
    to: "2026-06-30T23:59:59.999Z",
    months: [],
    grandTotals: { cash: 0, bank: 0, total: 0 },
  });
});
