import { describe, expect, it } from "vitest";
import { pickMisfiledSalePayments } from "./car-sale-payments.js";

describe("pickMisfiledSalePayments", () => {
  it("returns rent rows whose note is the sale note", () => {
    const picked = pickMisfiledSalePayments(
      [
        { id: "a", type: "RENT", amount: 10_000, note: "Продаж авто WT86484 (1/2)", driverId: null },
        { id: "b", type: "RENT", amount: 10_500, note: "Продаж авто WT86484 (2/2)", driverId: null },
        { id: "c", type: "RENT", amount: 700, note: "Weekly rent", driverId: "driver-1" },
      ],
      { plate: "WT86484", saleNote: "Продаж авто WT86484", salePrice: 20_500 },
    );
    expect(picked.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("returns the one driverless rent that equals the stored sale price", () => {
    const picked = pickMisfiledSalePayments(
      [
        { id: "sale", type: "RENT", amount: 20_500, note: null, driverId: null },
        { id: "rent", type: "RENT", amount: 700, note: null, driverId: "driver-1" },
      ],
      { plate: "WT86484", saleNote: null, salePrice: 20_500 },
    );
    expect(picked.map((row) => row.id)).toEqual(["sale"]);
  });

  it("leaves payments alone when a sale row is already present", () => {
    expect(
      pickMisfiledSalePayments(
        [
          { id: "sale", type: "SALE", amount: 20_500, note: "Продаж авто WT86484", driverId: null },
          { id: "copy", type: "RENT", amount: 20_500, note: "Продаж авто WT86484", driverId: null },
        ],
        { plate: "WT86484", saleNote: "Продаж авто WT86484", salePrice: 20_500 },
      ),
    ).toEqual([]);
  });
});
