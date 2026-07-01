import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

process.env.DATABASE_URL ??= "mysql://taxi:taxi@localhost:3306/taxi_test";

const { prisma } = await import("../prisma.js");
const { buildPartnerSettlementReport } = await import("./reports.js");

afterEach(() => {
  mock.restoreAll();
});

describe("buildPartnerSettlementReport", () => {
  it("groups partner cashflow by month and tracks unsettled balances", async () => {
    let paymentQuery: unknown;
    let expenseQuery: unknown;

    mock.method(prisma.payment, "findMany", async (query: unknown) => {
      paymentQuery = query;
      return [
        {
          id: "pay-jan-open",
          amount: 100.105,
          date: new Date("2026-01-15T12:00:00.000Z"),
          partnerSettled: false,
          driverId: "driver-1",
          type: "RENT",
          note: "weekly rent",
        },
        {
          id: "pay-jan-settled",
          amount: 50,
          date: new Date("2026-01-20T12:00:00.000Z"),
          partnerSettled: true,
          driverId: null,
          type: "FINE",
          note: " ",
        },
        {
          id: "pay-feb-open",
          amount: 200,
          date: new Date("2026-02-01T12:00:00.000Z"),
          partnerSettled: false,
          driverId: "missing-driver",
          type: "RENT",
          note: null,
        },
      ];
    });
    mock.method(prisma.expense, "findMany", async (query: unknown) => {
      expenseQuery = query;
      return [
        {
          id: "expense-jan-open",
          amount: 30.335,
          date: new Date("2026-01-18T12:00:00.000Z"),
          partnerSettled: false,
          category: "REPAIR",
          tag: " Tires ",
          note: " ",
          carId: "car-1",
        },
        {
          id: "expense-jan-settled",
          amount: 10,
          date: new Date("2026-01-21T12:00:00.000Z"),
          partnerSettled: true,
          category: "FUEL",
          tag: null,
          note: "Gas",
          carId: null,
        },
        {
          id: "expense-feb-open",
          amount: 75.5,
          date: new Date("2026-02-10T12:00:00.000Z"),
          partnerSettled: false,
          category: "OTHER",
          tag: null,
          note: null,
          carId: "missing-car",
        },
      ];
    });
    mock.method(prisma.driver, "findMany", async () => [
      { id: "driver-1", fullName: "Ada Driver" },
    ]);
    mock.method(prisma.car, "findMany", async () => [
      { id: "car-1", plate: "ABC-123", make: "Toyota", model: "Prius" },
    ]);

    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-02-28T23:59:59.999Z");

    const report = await buildPartnerSettlementReport("owner-1", from, to);

    assert.deepEqual(paymentQuery, {
      where: {
        ownerId: "owner-1",
        date: { gte: from, lte: to },
        receivedByPartner: true,
      },
      select: {
        id: true,
        amount: true,
        date: true,
        partnerSettled: true,
        driverId: true,
        type: true,
        note: true,
      },
      orderBy: { date: "asc" },
    });
    assert.deepEqual(expenseQuery, {
      where: {
        ownerId: "owner-1",
        date: { gte: from, lte: to },
        paidByPartner: true,
      },
      select: {
        id: true,
        amount: true,
        date: true,
        partnerSettled: true,
        category: true,
        tag: true,
        note: true,
        carId: true,
      },
      orderBy: { date: "asc" },
    });

    assert.deepEqual(report, {
      from: from.toISOString(),
      to: to.toISOString(),
      months: [
        {
          month: "2026-01",
          partnerOwesYou: 150.11,
          youOwePartner: 40.34,
          netBalance: 109.77,
          partnerOwesYouUnsettled: 100.11,
          youOwePartnerUnsettled: 30.34,
          payments: [
            {
              id: "pay-jan-open",
              date: "2026-01-15T12:00:00.000Z",
              amount: 100.11,
              description: "Ada Driver — weekly rent",
              settled: false,
            },
            {
              id: "pay-jan-settled",
              date: "2026-01-20T12:00:00.000Z",
              amount: 50,
              description: "FINE",
              settled: true,
            },
          ],
          expenses: [
            {
              id: "expense-jan-open",
              date: "2026-01-18T12:00:00.000Z",
              amount: 30.34,
              description: "Tires · ABC-123 - Toyota Prius · REPAIR",
              settled: false,
            },
            {
              id: "expense-jan-settled",
              date: "2026-01-21T12:00:00.000Z",
              amount: 10,
              description: "Gas · FUEL",
              settled: true,
            },
          ],
        },
        {
          month: "2026-02",
          partnerOwesYou: 200,
          youOwePartner: 75.5,
          netBalance: 124.5,
          partnerOwesYouUnsettled: 200,
          youOwePartnerUnsettled: 75.5,
          payments: [
            {
              id: "pay-feb-open",
              date: "2026-02-01T12:00:00.000Z",
              amount: 200,
              description: "RENT",
              settled: false,
            },
          ],
          expenses: [
            {
              id: "expense-feb-open",
              date: "2026-02-10T12:00:00.000Z",
              amount: 75.5,
              description: "OTHER",
              settled: false,
            },
          ],
        },
      ],
      totals: {
        partnerOwesYou: 350.11,
        youOwePartner: 115.84,
        netBalance: 234.27,
        partnerOwesYouUnsettled: 300.11,
        youOwePartnerUnsettled: 105.84,
      },
    });
  });
});
