import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExpenseCategory, expenseCreateSchema, expenseUpdateSchema } from "./index";

describe("expense payer schema", () => {
  it("trims and preserves an out-of-pocket payer on create", () => {
    const expense = expenseCreateSchema.parse({
      amount: 125.5,
      date: "2026-07-02",
      category: ExpenseCategory.REPAIR,
      payer: "  partner  ",
    });

    assert.equal(expense.payer, "partner");
  });

  it("allows payer to be omitted or cleared on update", () => {
    assert.deepEqual(expenseUpdateSchema.parse({}), {});
    assert.deepEqual(expenseUpdateSchema.parse({ payer: null }), { payer: null });
  });

  it("rejects payer values longer than the supported field length", () => {
    const result = expenseCreateSchema.safeParse({
      amount: 10,
      date: "2026-07-02",
      payer: "x".repeat(121),
    });

    assert.equal(result.success, false);
  });
});
