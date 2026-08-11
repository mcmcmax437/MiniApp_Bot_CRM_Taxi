import { describe, expect, it } from "vitest";
import { shouldEmitDateReminder } from "./reminders.js";

describe("shouldEmitDateReminder", () => {
  const insuranceDefaults = [14, 7, 3];

  it("emits on configured days before expiry", () => {
    expect(shouldEmitDateReminder(14, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(7, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(3, insuranceDefaults)).toBe(true);
  });

  it("emits on the due date itself (daysLeft = 0)", () => {
    expect(shouldEmitDateReminder(0, insuranceDefaults)).toBe(true);
  });

  it("emits when overdue", () => {
    expect(shouldEmitDateReminder(-1, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(-5, insuranceDefaults)).toBe(true);
  });

  it("keeps reminding after a configured day was passed (cron catch-up)", () => {
    // Missed the day-14 ping → still notify on day 13, 12, …
    expect(shouldEmitDateReminder(13, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(8, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(4, insuranceDefaults)).toBe(true);
    expect(shouldEmitDateReminder(1, insuranceDefaults)).toBe(true);
  });

  it("stays quiet before the earliest configured threshold", () => {
    expect(shouldEmitDateReminder(15, insuranceDefaults)).toBe(false);
    expect(shouldEmitDateReminder(30, insuranceDefaults)).toBe(false);
  });

  it("respects a tighter window when only late days are selected", () => {
    expect(shouldEmitDateReminder(10, [3, 1])).toBe(false);
    expect(shouldEmitDateReminder(3, [3, 1])).toBe(true);
    expect(shouldEmitDateReminder(2, [3, 1])).toBe(true);
  });
});
