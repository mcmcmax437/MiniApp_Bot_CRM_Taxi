import { describe, expect, it } from "vitest";
import {
  PaymentType,
  agreementCreateSchema,
  agreementDriverDisplayName,
  agreementIsTemporaryDriver,
} from "./index.js";

const carId = "clh3k2l0n0000qzrmn831i7rn";
const driverId = "clh3k2l0n0001qzrmn831i7ro";

describe("agreementDriverDisplayName", () => {
  it("prefers registered driver full name", () => {
    expect(
      agreementDriverDisplayName({
        driverId,
        temporaryDriverName: "Temp",
        driver: { fullName: "Anastasiia Borivets" },
      }),
    ).toBe("Anastasiia Borivets");
  });

  it("falls back to temporary driver name", () => {
    expect(
      agreementDriverDisplayName({
        driverId: null,
        temporaryDriverName: "waiting for docs",
      }),
    ).toBe("waiting for docs");
  });

  it("returns em dash when nothing is set", () => {
    expect(agreementDriverDisplayName({})).toBe("—");
  });
});

describe("agreementIsTemporaryDriver", () => {
  it("is true only when there is no driverId and a temp name", () => {
    expect(
      agreementIsTemporaryDriver({ driverId: null, temporaryDriverName: "Guest" }),
    ).toBe(true);
    expect(
      agreementIsTemporaryDriver({ driverId, temporaryDriverName: "Guest" }),
    ).toBe(false);
    expect(agreementIsTemporaryDriver({ temporaryDriverName: "  " })).toBe(false);
  });
});

describe("agreementCreateSchema", () => {
  const base = {
    carId,
    rentAmount: 700,
    startDate: "2026-03-20",
    endDate: "2026-04-27",
  };

  it("accepts a registered driver without temporary name", () => {
    const result = agreementCreateSchema.safeParse({ ...base, driverId });
    expect(result.success).toBe(true);
  });

  it("accepts a temporary driver without driverId", () => {
    const result = agreementCreateSchema.safeParse({
      ...base,
      temporaryDriverName: "New driver",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither driver nor temporary name is provided", () => {
    const result = agreementCreateSchema.safeParse(base);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "driver_or_temp_required")).toBe(
        true,
      );
    }
  });

  it("rejects when both driver and temporary name are provided", () => {
    const result = agreementCreateSchema.safeParse({
      ...base,
      driverId,
      temporaryDriverName: "Also temp",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "driver_xor_temp")).toBe(true);
    }
  });
});

describe("PaymentType income classification (shared constants)", () => {
  it("exposes rent and fine as distinct from deposit", () => {
    expect(PaymentType.RENT).toBe("RENT");
    expect(PaymentType.FINE).toBe("FINE");
    expect(PaymentType.DEPOSIT).toBe("DEPOSIT");
    expect(PaymentType.REFUND).toBe("REFUND");
  });
});
