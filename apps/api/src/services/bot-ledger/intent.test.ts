import { describe, expect, it } from "vitest";
import { matchCars } from "./match-cars.js";
import { extractJsonObject, interpretLedgerJson, messageCalendarDate } from "./intent.js";

const fleet = [
  { id: "1", plate: "OP8645U", make: "Toyota", model: "Corolla" },
  { id: "2", plate: "PY5132F", make: "Toyota", model: "Auris" },
  { id: "3", plate: "WA5404F", make: "Suzuki", model: "Swift" },
  { id: "4", plate: "WT86484", make: "Suzuki", model: "Vitara" },
];

describe("matchCars", () => {
  it("matches a plate fragment", () => {
    expect(matchCars("5132", fleet).map((c) => c.plate)).toEqual(["PY5132F"]);
  });

  it("matches a Ukrainian make against both cars of that make", () => {
    expect(matchCars("Сузукі", fleet).map((c) => c.plate)).toEqual(["WA5404F", "WT86484"]);
  });

  it("ignores a job word and still finds the make", () => {
    expect(matchCars("Прошивка Сузукі", fleet).map((c) => c.id)).toEqual(["3", "4"]);
  });

  it("returns nothing when no hint matches", () => {
    expect(matchCars("прошивка", fleet)).toEqual([]);
  });
});

describe("interpretLedgerJson", () => {
  it("reads an expense", () => {
    expect(
      interpretLedgerJson({
        kind: "expense",
        amount: "450",
        carQuery: "Сузукі 450",
        note: "Прошивка",
        expenseCategory: "repair",
      }),
    ).toEqual({
      kind: "expense",
      amount: 450,
      carQuery: "Сузукі",
      note: "Прошивка",
      category: "REPAIR",
    });
  });

  it("defaults income to cash rent", () => {
    expect(
      interpretLedgerJson({
        kind: "income",
        amount: 550,
        carQuery: "5132",
        note: null,
      }),
    ).toMatchObject({
      kind: "income",
      amount: 550,
      carQuery: "5132",
      paymentType: "RENT",
      method: "CASH",
      bank: "NONE",
    });
  });

  it("rejects a missing car", () => {
    expect(interpretLedgerJson({ kind: "expense", amount: 10, carQuery: "" })).toEqual({
      kind: "unknown",
    });
  });
});

describe("extractJsonObject / message date", () => {
  it("parses JSON wrapped in prose", () => {
    expect(extractJsonObject('Sure: {"kind":"unknown"}')).toEqual({ kind: "unknown" });
  });

  it("uses the Kyiv calendar day of the message", () => {
    // 2026-09-30 22:30 UTC is 2026-10-01 01:30 in Kyiv.
    expect(messageCalendarDate(Date.parse("2026-09-30T22:30:00Z") / 1000)).toBe("2026-10-01");
  });
});
