import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partnerExpenseDescription } from "./partnerSettlementFormat";

describe("partnerExpenseDescription", () => {
  it("includes the trimmed payer after plate and note", () => {
    const description = partnerExpenseDescription({
      car: { plate: "  AA1234BB  " },
      note: "  tire replacement  ",
      payer: "  father  ",
    });

    assert.equal(description, "AA1234BB · tire replacement · father");
  });

  it("uses payer as the fallback description when plate and note are empty", () => {
    const description = partnerExpenseDescription({
      car: null,
      note: "   ",
      payer: "  partner  ",
    });

    assert.equal(description, "partner");
  });

  it("returns an em dash when no meaningful description fields exist", () => {
    const description = partnerExpenseDescription({
      car: { plate: "   " },
      note: null,
      payer: "   ",
    });

    assert.equal(description, "—");
  });
});
