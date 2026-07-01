import assert from "node:assert/strict";
import test from "node:test";
import {
  partnerExpenseDescription,
  partnerPaymentDescription,
} from "./partnerSettlementFormat";

test("partnerPaymentDescription combines trimmed driver name and note", () => {
  assert.equal(
    partnerPaymentDescription({
      driver: { id: "driver-a", fullName: "  Ivan Petrenko  " },
      note: "  weekly rent  ",
    }),
    "Ivan Petrenko — weekly rent",
  );
});

test("partnerPaymentDescription falls back to available text or dash", () => {
  assert.equal(partnerPaymentDescription({ note: " cash handoff " }), "cash handoff");
  assert.equal(
    partnerPaymentDescription({ driver: { id: "driver-a", fullName: "  " }, note: "  " }),
    "—",
  );
});

test("partnerExpenseDescription renders plate and action note without category or tags", () => {
  const expense = {
    car: { id: "car-a", plate: "  AA1234BB  " },
    note: "  tire repair  ",
    category: "MAINTENANCE",
    tag: "partner-settlement",
  };

  assert.equal(partnerExpenseDescription(expense), "AA1234BB · tire repair");
});

test("partnerExpenseDescription falls back to note, plate, then dash", () => {
  assert.equal(partnerExpenseDescription({ car: null, note: " parking " }), "parking");
  assert.equal(partnerExpenseDescription({ car: { id: "car-a", plate: " AA1234BB " }, note: " " }), "AA1234BB");
  assert.equal(partnerExpenseDescription({ car: null, note: " " }), "—");
});
