import assert from "node:assert/strict";
import test from "node:test";

import { ExpenseCategory, expenseCreateSchema, expenseUpdateSchema } from "../src/index.ts";

test("expenseCreateSchema defaults paidByFather to false independently of partner settlement flags", () => {
  const parsed = expenseCreateSchema.parse({
    amount: 125.5,
    category: ExpenseCategory.REPAIR,
    date: "2026-07-01",
    paidByPartner: true,
    partnerSettled: true,
  });

  assert.equal(parsed.paidByFather, false);
  assert.equal(parsed.paidByPartner, true);
  assert.equal(parsed.partnerSettled, true);
});

test("expenseCreateSchema preserves father-paid expenses without implying partner settlement", () => {
  const parsed = expenseCreateSchema.parse({
    amount: 80,
    category: ExpenseCategory.MAINTENANCE,
    date: "2026-07-01T12:00:00.000Z",
    paidByFather: true,
  });

  assert.equal(parsed.paidByFather, true);
  assert.equal(parsed.paidByPartner, false);
  assert.equal(parsed.partnerSettled, false);
});

test("expenseUpdateSchema accepts a paidByFather-only patch", () => {
  const parsed = expenseUpdateSchema.parse({ paidByFather: true });

  assert.deepEqual(parsed, { paidByFather: true });
});
