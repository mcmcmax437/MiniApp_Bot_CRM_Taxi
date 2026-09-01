import { describe, expect, it } from "vitest";
import { contractEndTextColor, daysUntilExpiry, expiryUrgency } from "./expiryUrgency";

function asOf(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

describe("daysUntilExpiry", () => {
  it("counts calendar days from as-of to the contract end", () => {
    expect(daysUntilExpiry("2026-09-10", asOf("2026-09-01"))).toBe(9);
    expect(daysUntilExpiry("2026-09-01", asOf("2026-09-01"))).toBe(0);
    expect(daysUntilExpiry("2026-08-31", asOf("2026-09-01"))).toBe(-1);
  });

  it("returns null for missing or invalid dates", () => {
    expect(daysUntilExpiry(null, asOf("2026-09-01"))).toBeNull();
    expect(daysUntilExpiry(undefined, asOf("2026-09-01"))).toBeNull();
    expect(daysUntilExpiry("not-a-date", asOf("2026-09-01"))).toBeNull();
  });
});

describe("expiryUrgency", () => {
  it("classifies threshold boundaries by days until expiry", () => {
    const now = asOf("2026-09-01");

    expect(expiryUrgency("2026-08-31", now)).toBe("overdue");
    expect(expiryUrgency("2026-09-01", now)).toBe("warning");
    expect(expiryUrgency("2026-09-15", now)).toBe("warning");
    expect(expiryUrgency("2026-09-16", now)).toBe("soon");
    expect(expiryUrgency("2026-10-16", now)).toBe("soon");
    expect(expiryUrgency("2026-10-17", now)).toBe("ok");
  });

  it("uses unknown for missing or invalid dates", () => {
    const now = asOf("2026-09-01");

    expect(expiryUrgency(null, now)).toBe("unknown");
    expect(expiryUrgency(undefined, now)).toBe("unknown");
    expect(expiryUrgency("not-a-date", now)).toBe("unknown");
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

  it("pins colors at each interpolation boundary", () => {
    const now = asOf("2026-09-01");

    expect(contractEndTextColor("2026-10-31", now)).toBe("rgb(196, 178, 118)");
    expect(contractEndTextColor("2026-09-22", now)).toBe("rgb(255, 193, 7)");
    expect(contractEndTextColor("2026-09-08", now)).toBe("rgb(255, 145, 0)");
    expect(contractEndTextColor("2026-09-01", now)).toBe("rgb(255, 82, 82)");
    expect(contractEndTextColor("2026-08-31", now)).toBe("rgb(255, 82, 82)");
  });

  it("falls back to muted text for invalid dates", () => {
    expect(contractEndTextColor("not-a-date", asOf("2026-09-01"))).toBe(
      "rgba(255, 255, 255, 0.52)",
    );
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
