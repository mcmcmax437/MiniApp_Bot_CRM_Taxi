import { describe, expect, it } from "vitest";
import { getAnchoredPortalMenuStyle } from "./anchoredPortalMenu.js";

describe("getAnchoredPortalMenuStyle", () => {
  it("positions below the anchor when there is enough viewport space", () => {
    expect(
      getAnchoredPortalMenuStyle({
        anchorRect: { top: 100, bottom: 140, right: 260 },
        viewportWidth: 390,
        viewportHeight: 800,
        menuHeight: 280,
      }),
    ).toEqual({
      position: "fixed",
      zIndex: 1200,
      right: 130,
      maxHeight: 420,
      overflowY: "auto",
      visibility: "visible",
      top: 148,
      bottom: "auto",
    });
  });

  it("positions above the anchor when the menu would be clipped below", () => {
    expect(
      getAnchoredPortalMenuStyle({
        anchorRect: { top: 500, bottom: 540, right: 260 },
        viewportWidth: 390,
        viewportHeight: 640,
        menuHeight: 280,
      }),
    ).toMatchObject({
      right: 130,
      maxHeight: 420,
      top: "auto",
      bottom: 148,
    });
  });

  it("keeps a usable minimum max height in cramped viewports", () => {
    expect(
      getAnchoredPortalMenuStyle({
        anchorRect: { top: 80, bottom: 100, right: 260 },
        viewportWidth: 390,
        viewportHeight: 200,
        menuHeight: 280,
      }).maxHeight,
    ).toBe(140);
  });

  it("keeps the menu padded from the right viewport edge", () => {
    expect(
      getAnchoredPortalMenuStyle({
        anchorRect: { top: 100, bottom: 140, right: 340 },
        viewportWidth: 320,
        viewportHeight: 800,
      }).right,
    ).toBe(10);
  });
});
