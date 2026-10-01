import { describe, expect, it } from "vitest";
import {
  activeBackupOwnerWhere,
  backupFilename,
  isFirstDayOfMonth,
  kyivCalendarDate,
} from "./fleet-backup.js";

describe("monthly backup calendar", () => {
  it("uses the Kyiv date", () => {
    // 2026-09-30 22:30 UTC is 2026-10-01 01:30 in Kyiv.
    const now = new Date("2026-09-30T22:30:00.000Z");
    expect(kyivCalendarDate(now)).toEqual({ year: "2026", month: "10", day: "01" });
    expect(isFirstDayOfMonth(now)).toBe(true);
    expect(backupFilename(now)).toBe("taxi-backup-2026-10-01.json");
  });

  it("is not the first on other Kyiv days", () => {
    expect(isFirstDayOfMonth(new Date("2026-10-01T21:30:00.000Z"))).toBe(false);
  });
});

describe("monthly backup owner eligibility", () => {
  it("excludes expired active owners from scheduled backups", () => {
    const now = new Date("2026-10-01T06:00:00.000Z");
    expect(activeBackupOwnerWhere(now)).toEqual({
      status: "ACTIVE",
      OR: [{ subscriptionExpiresAt: null }, { subscriptionExpiresAt: { gt: now } }],
    });
  });
});
