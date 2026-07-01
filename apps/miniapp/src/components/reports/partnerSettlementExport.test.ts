import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartnerSettlementReport } from "@taxi/shared";
import {
  buildPartnerSettlementCsv,
  filterPartnerSettlementByMonths,
} from "./partnerSettlementExport";

const report: PartnerSettlementReport = {
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-28T23:59:59.999Z",
  months: [
    {
      month: "2026-01",
      partnerOwesYou: 100.105,
      youOwePartner: 40.335,
      netBalance: 59.77,
      partnerOwesYouUnsettled: 80.105,
      youOwePartnerUnsettled: 15.335,
      payments: [
        {
          id: "payment-1",
          date: "2026-01-15T12:00:00.000Z",
          amount: 100.105,
          description: 'Ada; "weekly"\nrent',
          settled: false,
        },
      ],
      expenses: [
        {
          id: "expense-1",
          date: "2026-01-18T12:00:00.000Z",
          amount: 40.335,
          description: "Repair",
          settled: true,
        },
      ],
    },
    {
      month: "2026-02",
      partnerOwesYou: 25,
      youOwePartner: 50,
      netBalance: -25,
      partnerOwesYouUnsettled: 25,
      youOwePartnerUnsettled: 50,
      payments: [],
      expenses: [],
    },
  ],
  totals: {
    partnerOwesYou: 125.105,
    youOwePartner: 90.335,
    netBalance: 34.77,
    partnerOwesYouUnsettled: 105.105,
    youOwePartnerUnsettled: 65.335,
  },
};

describe("filterPartnerSettlementByMonths", () => {
  it("returns null when no selected months remain", () => {
    assert.equal(filterPartnerSettlementByMonths(report, new Set()), null);
    assert.equal(filterPartnerSettlementByMonths(report, new Set(["2025-12"])), null);
  });

  it("keeps selected months and recalculates all totals", () => {
    const filtered = filterPartnerSettlementByMonths(report, new Set(["2026-01"]));

    assert.deepEqual(filtered, {
      ...report,
      months: [report.months[0]],
      totals: {
        partnerOwesYou: 100.11,
        youOwePartner: 40.34,
        netBalance: 59.77,
        partnerOwesYouUnsettled: 80.11,
        youOwePartnerUnsettled: 15.34,
      },
    });
  });
});

describe("buildPartnerSettlementCsv", () => {
  it("exports summaries, lines, settled flags, and escaped text", () => {
    const csv = buildPartnerSettlementCsv(report, {
      month: "Month",
      type: "Type",
      date: "Date",
      description: "Description",
      amount: "Amount",
      settled: "Settled",
      partnerOwesYou: "Partner owes you",
      youOwePartner: "You owe partner",
      netBalance: "Net",
      payment: "Payment",
      expense: "Expense",
      yes: "Yes",
      no: "No",
      grandTotal: "Grand total",
      monthLabel: (month) => `Label ${month}`,
      formatDate: (iso) => iso.slice(0, 10),
    });

    assert.equal(
      csv,
      [
        "Month;Partner owes you;You owe partner;Net",
        "Label 2026-01;100.11;40.34;59.77",
        ';Payment;2026-01-15;"Ada; ""weekly""\nrent";100.11;No',
        ";Expense;2026-01-18;Repair;40.34;Yes",
        "",
        "Label 2026-02;25.00;50.00;-25.00",
        "",
        "Grand total;125.10;90.33;34.77",
      ].join("\r\n"),
    );
  });
});
