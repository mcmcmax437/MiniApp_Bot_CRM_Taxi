import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isWeeklyMileageSkipped,
  startOfCurrentWeeklyMileageWindow,
} from "./weekly-mileage-window.js";

describe("weekly mileage skip window", () => {
  it("anchors the current weekly window to the configured weekday at midnight", () => {
    const now = new Date("2026-07-01T15:45:00.000Z"); // Wednesday

    assert.equal(
      startOfCurrentWeeklyMileageWindow(now, 1).toISOString(),
      "2026-06-29T00:00:00.000Z",
    );
  });

  it("treats a stored skip for the current window as active", () => {
    const now = new Date("2026-07-01T15:45:00.000Z"); // Wednesday

    assert.equal(
      isWeeklyMileageSkipped({
        weeklyMileageWeekday: 1,
        weeklyMileageSkippedWeekStart: new Date("2026-06-29T00:00:00.000Z"),
      }, now),
      true,
    );
  });

  it("expires the stored skip when the next configured week starts", () => {
    const nextWeek = new Date("2026-07-06T09:00:00.000Z"); // next Monday

    assert.equal(
      isWeeklyMileageSkipped({
        weeklyMileageWeekday: 1,
        weeklyMileageSkippedWeekStart: new Date("2026-06-29T00:00:00.000Z"),
      }, nextWeek),
      false,
    );
  });

  it("uses the owner's configured weekday instead of assuming Monday", () => {
    const now = new Date("2026-07-06T09:00:00.000Z"); // Monday

    assert.equal(
      startOfCurrentWeeklyMileageWindow(now, 0).toISOString(),
      "2026-07-05T00:00:00.000Z",
    );
    assert.equal(
      isWeeklyMileageSkipped({
        weeklyMileageWeekday: 0,
        weeklyMileageSkippedWeekStart: new Date("2026-07-05T00:00:00.000Z"),
      }, now),
      true,
    );
  });

  it("does not skip mileage reminders when no skip is stored", () => {
    assert.equal(
      isWeeklyMileageSkipped({
        weeklyMileageWeekday: 1,
        weeklyMileageSkippedWeekStart: null,
      }, new Date("2026-07-01T15:45:00.000Z")),
      false,
    );
  });
});
