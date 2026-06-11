export interface RentalPeriodLike {
  id?: string;
  carId: string;
  startDate: Date | string;
  endDate?: Date | string | null;
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
