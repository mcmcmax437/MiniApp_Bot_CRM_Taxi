import { findRentalPeriodConflict } from "@taxi/shared";
import type { Agreement } from "./types";

export function findAgreementDateConflict(
  candidate: {
    id?: string;
    carId: string;
    startDate: string;
    endDate: string | null;
    status?: string;
  },
  agreements: Agreement[],
): Agreement | undefined {
  const endDate =
    candidate.status === "ACTIVE" && !candidate.endDate?.trim() ? null : candidate.endDate;
  const conflict = findRentalPeriodConflict(
    { ...candidate, endDate },
    agreements.map((a) => ({
      id: a.id,
      carId: a.carId,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
  );
  if (!conflict?.id) return undefined;
  return agreements.find((a) => a.id === conflict.id);
}
