import assert from "node:assert/strict";
import test from "node:test";

import { ExpenseCategory } from "@taxi/shared";
import { expenseDisplaySubtitle } from "../src/components/finance/financeLabels.ts";

const labels: Record<string, string> = {
  "finance.MAINTENANCE": "Maintenance",
  "finance.paidByFather": "Paid by father",
  "finance.paidByPartner": "Paid by partner",
};

function t(key: string): string {
  return labels[key] ?? key;
}

test("expenseDisplaySubtitle includes father payer marker without partner settlement marker", () => {
  const subtitle = expenseDisplaySubtitle(
    {
      category: ExpenseCategory.MAINTENANCE,
      note: null,
      tag: null,
      paidByFather: true,
      paidByPartner: false,
      car: { plate: "WA1234" },
    },
    "2026-07-01",
    t,
    "No car",
  );

  assert.equal(subtitle, "2026-07-01 · WA1234 · Paid by father");
});

test("expenseDisplaySubtitle renders father and partner payer markers independently", () => {
  const subtitle = expenseDisplaySubtitle(
    {
      category: ExpenseCategory.MAINTENANCE,
      note: "Oil change",
      tag: null,
      paidByFather: true,
      paidByPartner: true,
      car: { plate: "WA1234" },
    },
    "2026-07-01",
    t,
    "No car",
  );

  assert.equal(
    subtitle,
    "2026-07-01 · WA1234 · Paid by father · Paid by partner · Maintenance",
  );
});
