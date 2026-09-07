import { describe, expect, it } from "vitest";
import {
  PAID_MARKS_STORAGE_KEY,
  loadPaidMarks,
  paidMarkId,
  parsePaidMarks,
  savePaidMarks,
  togglePaidMark,
  type PaidMarks,
} from "./fleetTimelinePaidMarks";

function memoryStorage(seed: Record<string, string> = {}) {
  const values = { ...seed };
  return {
    getItem(key: string) {
      return values[key] ?? null;
    },
    setItem(key: string, value: string) {
      values[key] = value;
    },
    values,
  };
}

describe("paid timeline marks", () => {
  it("scopes mark identifiers by visible range and agreement", () => {
    const weekMark = paidMarkId("2026-08-10", "2026-08-16", "agreement-1");
    const nextWeekMark = paidMarkId("2026-08-17", "2026-08-23", "agreement-1");
    const otherAgreementMark = paidMarkId(
      "2026-08-10",
      "2026-08-16",
      "agreement-2",
    );

    expect(weekMark).toBe("2026-08-10|2026-08-16|agreement-1");
    expect(new Set([weekMark, nextWeekMark, otherAgreementMark]).size).toBe(3);
  });

  it("loads only truthy object entries and normalizes values to true", () => {
    expect(
      parsePaidMarks(
        JSON.stringify({
          paid: true,
          legacyTruthy: 1,
          unpaid: false,
          empty: "",
        }),
      ),
    ).toEqual({ paid: true, legacyTruthy: true });
  });

  it("returns empty marks for corrupt or non-object stored values", () => {
    expect(parsePaidMarks("{bad json")).toEqual({});
    expect(parsePaidMarks(JSON.stringify(["agreement-1"]))).toEqual({});
    expect(parsePaidMarks(JSON.stringify(null))).toEqual({});
    expect(parsePaidMarks(null)).toEqual({});
  });

  it("toggles a paid mark without mutating the previous state", () => {
    const existing = paidMarkId("2026-08-10", "2026-08-16", "agreement-1");
    const added = paidMarkId("2026-08-10", "2026-08-16", "agreement-2");
    const marks: PaidMarks = { [existing]: true };

    const withAdded = togglePaidMark(marks, added);
    expect(withAdded).toEqual({ [existing]: true, [added]: true });
    expect(marks).toEqual({ [existing]: true });

    expect(togglePaidMark(withAdded, existing)).toEqual({ [added]: true });
  });

  it("round-trips marks through the fleet timeline storage key", () => {
    const storage = memoryStorage();
    const mark = paidMarkId("2026-08-10", "2026-08-16", "agreement-1");

    savePaidMarks(storage, { [mark]: true });

    expect(storage.values[PAID_MARKS_STORAGE_KEY]).toBe(
      JSON.stringify({ [mark]: true }),
    );
    expect(loadPaidMarks(storage)).toEqual({ [mark]: true });
  });

  it("treats storage read failures as empty state", () => {
    expect(
      loadPaidMarks({
        getItem() {
          throw new Error("storage unavailable");
        },
      }),
    ).toEqual({});
  });
});
