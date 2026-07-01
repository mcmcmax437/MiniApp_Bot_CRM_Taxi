import assert from "node:assert/strict";
import test from "node:test";
import { paymentMatchesSearch } from "./paymentFilters";

const payment = {
  driver: { id: "driver-1", fullName: "Olena Kovalenko" },
  car: { id: "car-1", plate: "KR-123-TX" },
  note: "weekly rent",
  amount: 450,
};

test("payment search matches car plate numbers case-insensitively", () => {
  assert.equal(paymentMatchesSearch(payment, "kr-123"), true);
  assert.equal(paymentMatchesSearch(payment, "TX"), true);
});

test("payment search keeps matching existing driver, note, and amount fields", () => {
  assert.equal(paymentMatchesSearch(payment, "olena"), true);
  assert.equal(paymentMatchesSearch(payment, "weekly"), true);
  assert.equal(paymentMatchesSearch(payment, "450"), true);
  assert.equal(paymentMatchesSearch(payment, "missing"), false);
  assert.equal(paymentMatchesSearch(payment, "   "), true);
});
