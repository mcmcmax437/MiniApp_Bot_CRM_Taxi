import { describe, expect, it } from "vitest";
import { Currency } from "@taxi/shared";
import { purchaseExpenseNote, purchaseExpenseRows } from "./purchase-expenses.js";

const eurPart = {
  amount: 2000,
  currency: Currency.EUR,
  fleetAmount: 8600,
  note: "deposit",
};

describe("purchaseExpenseNote", () => {
  it("keeps a single same-currency payment as a short note", () => {
    expect(
      purchaseExpenseNote("OP8645U", {
        amount: 50000,
        currency: Currency.PLN,
        fleetAmount: 50000,
        note: null,
      }, false),
    ).toBe("Purchase of OP8645U");
  });

  it("labels split / converted payments", () => {
    expect(purchaseExpenseNote("OP8645U", eurPart, true)).toBe(
      "Purchase of OP8645U · 2000 EUR @ 4.3 = 8600 · deposit",
    );
  });
});

describe("purchaseExpenseRows", () => {
  it("creates one expense row per payment part", () => {
    const date = new Date("2026-03-01T12:00:00.000Z");
    const rows = purchaseExpenseRows({
      ownerId: "own1",
      carId: "car1",
      plate: "OP8645U",
      date,
      parts: [
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "1" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "2" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "3" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "4" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "5" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "6" },
        { amount: 10000, currency: Currency.PLN, fleetAmount: 10000, note: "7" },
      ],
    });
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.category === "CAR_PURCHASE")).toBe(true);
    expect(rows.every((r) => r.tag === "car-purchase")).toBe(true);
    expect(rows.map((r) => r.note)).toEqual([
      "Purchase of OP8645U · 10000 PLN · 1",
      "Purchase of OP8645U · 10000 PLN · 2",
      "Purchase of OP8645U · 10000 PLN · 3",
      "Purchase of OP8645U · 10000 PLN · 4",
      "Purchase of OP8645U · 10000 PLN · 5",
      "Purchase of OP8645U · 10000 PLN · 6",
      "Purchase of OP8645U · 10000 PLN · 7",
    ]);
  });
});
