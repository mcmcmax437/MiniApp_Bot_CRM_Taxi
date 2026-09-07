import { describe, expect, it } from "vitest";
import { clipRangeToAsOf, fleetTimelinePaidMarkId } from "./fleetTimeline";

describe("fleetTimelinePaidMarkId", () => {
  it("stays stable for a selected current period as the visible range is clipped by as-of", () => {
    const selectedMonth = { from: "2026-09-01", to: "2026-09-30" };
    const firstVisible = clipRangeToAsOf(selectedMonth, "2026-09-07");
    const nextVisible = clipRangeToAsOf(selectedMonth, "2026-09-08");

    expect(firstVisible).toEqual({ from: "2026-09-01", to: "2026-09-07" });
    expect(nextVisible).toEqual({ from: "2026-09-01", to: "2026-09-08" });
    expect(`${firstVisible?.from}|${firstVisible?.to}|agreement-1`).not.toBe(
      `${nextVisible?.from}|${nextVisible?.to}|agreement-1`,
    );
    expect(fleetTimelinePaidMarkId(selectedMonth, "agreement-1")).toBe("2026-09-01|2026-09-30|agreement-1");
  });
});
