export interface RentalPeriodLike {
  id?: string;
  carId: string;
  startDate: Date | string;
  endDate?: Date | string | null;
}

export type AgreementDateValidation =
  | { ok: true }
  | {
      ok: false;
      key: "end_before_start" | "past_rental_needs_end" | "past_rental_end_must_be_past";
    };

/** ISO YYYY-MM-DD in UTC — matches API date-only comparisons. */
export function calendarDateOnly(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * ACTIVE when open-ended or end date is today/future; ENDED when end is in the past.
 * Mirrors `POST /agreements` status inference on the server.
 */
export function inferAgreementStatus(
  endDate: string | null | undefined,
  asOf: string = calendarDateOnly(),
): "ACTIVE" | "ENDED" {
  const end = endDate?.trim();
  if (!end) return "ACTIVE";
  if (end < asOf) return "ENDED";
  return "ACTIVE";
}

export function validateAgreementDates(
  startDate: string,
  endDate: string | null | undefined,
  options?: { requireEndDate?: boolean; asOf?: string },
): AgreementDateValidation {
  const start = startDate.trim();
  const end = endDate?.trim() ?? "";
  const asOf = options?.asOf ?? calendarDateOnly();

  if (end && end < start) {
    return { ok: false, key: "end_before_start" };
  }
  if (options?.requireEndDate && !end) {
    return { ok: false, key: "past_rental_needs_end" };
  }
  if (options?.requireEndDate && end && end >= asOf) {
    return { ok: false, key: "past_rental_end_must_be_past" };
  }
  return { ok: true };
}

function dateKey(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** True when two rental periods share at least one day, except same-day handoff (endA === startB). */
export function rentalPeriodsConflict(
  startA: Date | string,
  endA: Date | string | null | undefined,
  startB: Date | string,
  endB: Date | string | null | undefined,
): boolean {
  const sA = dateKey(startA);
  const sB = dateKey(startB);
  const eA = endA != null ? dateKey(endA) : Number.MAX_SAFE_INTEGER;
  const eB = endB != null ? dateKey(endB) : Number.MAX_SAFE_INTEGER;
  return sB < eA && sA < eB;
}

export function findRentalPeriodConflict(
  candidate: RentalPeriodLike,
  existing: RentalPeriodLike[],
): RentalPeriodLike | undefined {
  return existing.find((other) => {
    if (candidate.id && other.id === candidate.id) return false;
    if (other.carId !== candidate.carId) return false;
    return rentalPeriodsConflict(
      candidate.startDate,
      candidate.endDate,
      other.startDate,
      other.endDate,
    );
  });
}
