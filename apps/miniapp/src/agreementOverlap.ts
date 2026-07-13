import { agreementDriverDisplayName, findRentalPeriodConflict, type AgreementDateValidation } from "@taxi/shared";
import type { Agreement } from "./types";

const DATE_VALIDATION_I18N: Record<string, string> = {
  end_before_start: "fleet.endBeforeStart",
  past_rental_needs_end: "fleet.pastRentalNeedsEndDate",
  past_rental_end_must_be_past: "fleet.pastRentalEndMustBePast",
};

export function agreementDateValidationMessage(
  result: Extract<AgreementDateValidation, { ok: false }>,
  t: (key: string) => string,
): string {
  return t(DATE_VALIDATION_I18N[result.key]);
}

const AGREEMENT_API_ERRORS: Record<string, string> = {
  rental_overlap: "fleet.rentalOverlap",
  car_already_rented: "fleet.carAlreadyRented",
  agreement_exists: "fleet.agreementExists",
  end_before_start: "fleet.endBeforeStart",
  invalid_car_or_driver: "fleet.invalidCarOrDriver",
  driver_or_temp_required: "fleet.driverOrTempRequired",
};

export function agreementApiErrorMessage(
  code: string | undefined,
  t: (key: string) => string,
): string {
  if (code && AGREEMENT_API_ERRORS[code]) return t(AGREEMENT_API_ERRORS[code]);
  return t("common.error");
}

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

export function rentalOverlapMessage(
  conflict: Agreement,
  t: (key: string, opts?: Record<string, unknown>) => string,
  formatDate: (iso: string) => string,
): string {
  return t("fleet.rentalOverlapDetail", {
    driver: agreementDriverDisplayName(conflict),
    start: formatDate(conflict.startDate),
    end: conflict.endDate ? formatDate(conflict.endDate) : t("fleet.present"),
  });
}
