import { describe, expect, it } from "vitest";
import { contractEndTextColor, daysUntilExpiry } from "./expiryUrgency";

function asOf(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

describe("daysUntilExpiry", () => {
  it("counts calendar days from as-of to the contract end", () => {
    expect(daysUntilExpiry("2026-09-10", asOf("2026-09-01"))).toBe(9);
    expect(daysUntilExpiry("2026-09-01", asOf("2026-09-01"))).toBe(0);
    expect(daysUntilExpiry("2026-08-31", asOf("2026-09-01"))).toBe(-1);
  });
});

describe("contractEndTextColor", () => {
  const far = contractEndTextColor("2026-12-01", asOf("2026-09-01"));
  const mid = contractEndTextColor("2026-09-22", asOf("2026-09-01"));
  const close = contractEndTextColor("2026-09-10", asOf("2026-09-01"));
  const due = contractEndTextColor("2026-09-01", asOf("2026-09-01"));

  it("uses a warm sand when the end date is far away", () => {
    expect(far).toBe("rgb(196, 178, 118)");
  });

  it("shifts toward amber, then orange, then red as the end day nears", () => {
    expect(mid).not.toBe(far);
    expect(close).not.toBe(mid);
    expect(due).toBe("rgb(255, 82, 82)");
    const green = (c: string) => Number(c.match(/rgb\(\d+, (\d+)/)?.[1]);
    expect(green(close)).toBeLessThan(green(mid));
    expect(green(due)).toBeLessThan(green(close));
  });
});
