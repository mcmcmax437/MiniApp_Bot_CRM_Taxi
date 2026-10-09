import { describe, expect, it } from "vitest";
import { formatTrackerFixTime } from "./formatTrackerTime";

describe("formatTrackerFixTime", () => {
  it("rewrites an ISO tracker stamp to DD:MM:YYYY and keeps the clock time", () => {
    expect(formatTrackerFixTime("2026-08-10 00:54:44")).toBe("10:08:2026 00:54:44");
  });

  it("leaves an unknown string unchanged", () => {
    expect(formatTrackerFixTime("yesterday")).toBe("yesterday");
  });
});
