import { describe, expect, it } from "vitest";
import {
  expenseAmountForSelection,
  expenseMatchesCarFilter,
  expensePlateLabel,
  linkedExpenseCarIds,
  splitExpenseAmount,
} from "./expense-cars.js";

describe("splitExpenseAmount", () => {
  it("keeps a single car on the full amount", () => {
    expect(splitExpenseAmount(300, 1)).toEqual([300]);
  });

  it("splits evenly and gives the remainder to the last car", () => {
    expect(splitExpenseAmount(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitExpenseAmount(0.01, 3)).toEqual([0, 0, 0.01]);
  });
});

describe("linkedExpenseCarIds", () => {
  it("prefers the car list and falls back to carId", () => {
    expect(linkedExpenseCarIds({ carId: "a", cars: [{ id: "b" }, { id: "c" }] })).toEqual(["b", "c"]);
    expect(linkedExpenseCarIds({ carId: "a", cars: [] })).toEqual(["a"]);
    expect(linkedExpenseCarIds({ carId: null })).toEqual([]);
  });
});

describe("expenseAmountForSelection", () => {
  it("counts the full amount once when no car filter is set", () => {
    expect(expenseAmountForSelection(100, ["a", "b"], null)).toBe(100);
  });

  it("counts only the share of the selected cars", () => {
    expect(expenseAmountForSelection(100, ["a", "b"], new Set(["a"]))).toBe(50);
    expect(expenseAmountForSelection(100, ["a", "b"], new Set(["a", "b"]))).toBe(100);
    expect(expenseAmountForSelection(100, ["a"], new Set(["z"]))).toBe(0);
  });
});

describe("expenseMatchesCarFilter", () => {
  it("matches any linked car and treats no car as the empty filter", () => {
    const shared = { carId: "a", cars: [{ id: "a" }, { id: "b" }] };
    expect(expenseMatchesCarFilter(shared, [])).toBe(true);
    expect(expenseMatchesCarFilter(shared, ["b"])).toBe(true);
    expect(expenseMatchesCarFilter(shared, ["c"])).toBe(false);
    expect(expenseMatchesCarFilter({ carId: null, cars: [] }, [""])).toBe(true);
    expect(expenseMatchesCarFilter({ carId: "a" }, [""])).toBe(false);
  });
});

describe("expensePlateLabel", () => {
  it("joins every plate", () => {
    expect(
      expensePlateLabel({ cars: [{ plate: "WX1" }, { plate: "KR2" }], car: { plate: "WX1" } }, "—"),
    ).toBe("WX1, KR2");
    expect(expensePlateLabel({ car: { plate: "WX1" }, cars: [] }, "—")).toBe("WX1");
    expect(expensePlateLabel({ car: null, cars: [] }, "—")).toBe("—");
  });
});
