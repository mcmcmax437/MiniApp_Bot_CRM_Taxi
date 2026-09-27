import { afterEach, describe, expect, it, vi } from "vitest";
import { getFxRate } from "./fx.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getFxRate", () => {
  it("returns 1 for identical currencies", async () => {
    const r = await getFxRate("PLN", "PLN");
    expect(r.rate).toBe(1);
    expect(r.source).toBe("identity");
  });

  it("uses open.er-api rates when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          result: "success",
          time_last_update_utc: "Sun, 27 Sep 2026 00:02:31 +0000",
          rates: { EUR: 1, PLN: 4.373537, USD: 1.14, UAH: 51.12, GBP: 0.86 },
        }),
      })),
    );
    const r = await getFxRate("EUR", "PLN");
    expect(r.rate).toBeCloseTo(4.373537, 5);
    expect(r.from).toBe("EUR");
    expect(r.to).toBe("PLN");
    expect(r.source).toContain("exchangerate");
  });
});
