import { describe, expect, it } from "vitest";
import {
  findRentalPeriodConflict,
  inferAgreementStatus,
  rentalPeriodsConflict,
  validateAgreementDates,
} from "./agreement-overlap.js";

describe("rentalPeriodsConflict", () => {
  it("allows same-day handoff (previous end === next start)", () => {
    expect(rentalPeriodsConflict("2026-03-01", "2026-03-16", "2026-03-16", "2026-04-01")).toBe(
      false,
    );
  });

  it("detects interior overlap of one or more days", () => {
    expect(rentalPeriodsConflict("2026-03-01", "2026-03-20", "2026-03-16", "2026-04-01")).toBe(
      true,
    );
  });

  it("detects when one rental is fully inside another", () => {
    expect(rentalPeriodsConflict("2026-03-03", "2026-05-23", "2026-03-20", "2026-04-27")).toBe(
      true,
    );
  });

  it("allows disjoint ranges with a gap", () => {
    expect(rentalPeriodsConflict("2026-01-28", "2026-02-13", "2026-03-16", "2026-05-23")).toBe(
      false,
    );
  });

  it("treats null end as open-ended", () => {
    expect(rentalPeriodsConflict("2026-07-11", null, "2026-03-20", "2026-04-27")).toBe(false);
    expect(rentalPeriodsConflict("2026-07-11", null, "2026-07-20", "2026-08-01")).toBe(true);
    expect(rentalPeriodsConflict("2026-01-01", null, "2026-06-01", null)).toBe(true);
  });

  it("accepts UTC noon ISO strings from the API", () => {
    expect(
      rentalPeriodsConflict(
        "2026-03-01T12:00:00.000Z",
        "2026-03-16T12:00:00.000Z",
        "2026-03-16T12:00:00.000Z",
        "2026-04-01T12:00:00.000Z",
      ),
    ).toBe(false);
  });
});

describe("findRentalPeriodConflict", () => {
  const existing = [
    { id: "a1", carId: "car-a", startDate: "2026-03-16", endDate: "2026-05-23" },
    { id: "b1", carId: "car-b", startDate: "2026-03-20", endDate: "2026-04-27" },
    { id: "a2", carId: "car-a", startDate: "2026-03-20", endDate: "2026-04-27" },
  ];

  it("only compares rentals on the same car", () => {
    const hit = findRentalPeriodConflict(
      { carId: "car-b", startDate: "2026-03-03", endDate: "2026-05-23" },
      existing,
    );
    expect(hit?.id).toBe("b1");
  });

  it("skips the candidate itself when editing", () => {
    const hit = findRentalPeriodConflict(
      { id: "a1", carId: "car-a", startDate: "2026-03-03", endDate: "2026-05-23" },
      existing,
    );
    expect(hit?.id).toBe("a2");
  });

  it("returns undefined when no same-car overlap", () => {
    expect(
      findRentalPeriodConflict(
        { carId: "car-a", startDate: "2026-06-01", endDate: "2026-06-15" },
        existing,
      ),
    ).toBeUndefined();
  });
});

describe("inferAgreementStatus", () => {
  it("marks open-ended rentals as ACTIVE", () => {
    expect(inferAgreementStatus(null, "2026-07-13")).toBe("ACTIVE");
    expect(inferAgreementStatus("", "2026-07-13")).toBe("ACTIVE");
  });

  it("marks past end dates as ENDED", () => {
    expect(inferAgreementStatus("2026-04-27", "2026-07-13")).toBe("ENDED");
  });

  it("marks today or future end dates as ACTIVE", () => {
    expect(inferAgreementStatus("2026-07-13", "2026-07-13")).toBe("ACTIVE");
    expect(inferAgreementStatus("2026-08-01", "2026-07-13")).toBe("ACTIVE");
  });
});

describe("validateAgreementDates", () => {
  it("rejects end before start", () => {
    expect(validateAgreementDates("2026-04-01", "2026-03-01")).toEqual({
      ok: false,
      key: "end_before_start",
    });
  });

  it("requires an end date for past rentals", () => {
    expect(
      validateAgreementDates("2026-03-20", null, {
        requireEndDate: true,
        asOf: "2026-07-13",
      }),
    ).toEqual({ ok: false, key: "past_rental_needs_end" });
  });

  it("requires past rental end to be before today", () => {
    expect(
      validateAgreementDates("2026-03-20", "2026-07-13", {
        requireEndDate: true,
        asOf: "2026-07-13",
      }),
    ).toEqual({ ok: false, key: "past_rental_end_must_be_past" });
  });

  it("accepts a finished past rental in a gap", () => {
    expect(
      validateAgreementDates("2026-03-20", "2026-04-27", {
        requireEndDate: true,
        asOf: "2026-07-13",
      }),
    ).toEqual({ ok: true });
  });

  it("allows open-ended current rentals without requireEndDate", () => {
    expect(validateAgreementDates("2026-07-11", null, { asOf: "2026-07-13" })).toEqual({
      ok: true,
    });
  });
});
