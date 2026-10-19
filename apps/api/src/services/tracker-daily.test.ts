import { describe, expect, it } from "vitest";
import { parseMileageReports } from "./mking-tracker.js";
import { previousWeekRange } from "./tracker-week.js";

describe("parseMileageReports", () => {
  it("reads daily distance rows from the tracker statistics payload", () => {
    const payload = `{reports:[{name:"TERO-PY0187T",createDate:"2026/10/13",distance:15.33,warnCount:0,speedLimitCount:0,stopCount:4},{name:"TERO-PY0187T",createDate:"2026/10/14",distance:"131.09",warnCount:0,speedLimitCount:0,stopCount:5}]}`;
    expect(parseMileageReports(payload)).toEqual([
      { date: "2026-10-13", distanceKm: 15.33, name: "TERO-PY0187T" },
      { date: "2026-10-14", distanceKm: 131.09, name: "TERO-PY0187T" },
    ]);
  });
});

describe("previousWeekRange", () => {
  it("is the Monday-to-Monday window before a Monday", () => {
    // Monday 19 Oct 2026 09:00 UTC is still Monday morning in Warsaw.
    expect(previousWeekRange(new Date("2026-10-19T09:00:00.000Z"))).toEqual({
      start: "2026-10-12",
      end: "2026-10-19",
    });
  });
});
