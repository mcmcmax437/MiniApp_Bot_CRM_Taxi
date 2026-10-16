import { describe, expect, it } from "vitest";
import { calculateSearchableSelectPopupBox } from "./searchableSelectPopup";

describe("calculateSearchableSelectPopupBox", () => {
  it("opens below the input when enough viewport space is available", () => {
    expect(
      calculateSearchableSelectPopupBox({ top: 100, bottom: 132, left: 24, width: 280 }, 720),
    ).toEqual({
      top: 132,
      left: 24,
      width: 280,
      maxHeight: 220,
    });
  });

  it("opens above the input when the lower viewport is constrained", () => {
    expect(
      calculateSearchableSelectPopupBox({ top: 500, bottom: 540, left: 16, width: 320 }, 650),
    ).toEqual({
      top: 280,
      left: 16,
      width: 320,
      maxHeight: 220,
    });
  });

  it("keeps a minimum tappable height while clamping upward popups inside the viewport gap", () => {
    expect(
      calculateSearchableSelectPopupBox({ top: 100, bottom: 300, left: 12, width: 240 }, 350),
    ).toEqual({
      top: 8,
      left: 12,
      width: 240,
      maxHeight: 120,
    });
  });
});
