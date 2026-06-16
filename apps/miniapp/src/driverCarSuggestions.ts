import { AgreementStatus } from "@taxi/shared";
import type { Agreement } from "./types";

export function rankCarsForDriver(
  driverId: string,
  agreements: Agreement[],
  allCarIds: string[],
): { suggestedCarId: string | null; orderedCarIds: string[] } {
  if (!driverId) {
    return { suggestedCarId: null, orderedCarIds: [...allCarIds] };
  }

  const related = agreements
    .filter((a) => a.driverId === driverId)
    .sort((a, b) => {
      const aActive = a.status === AgreementStatus.ACTIVE ? 1 : 0;
      const bActive = b.status === AgreementStatus.ACTIVE ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

  const orderedCarIds: string[] = [];
  const seen = new Set<string>();
  for (const agreement of related) {
    if (!seen.has(agreement.carId)) {
      seen.add(agreement.carId);
      orderedCarIds.push(agreement.carId);
    }
  }
  for (const carId of allCarIds) {
    if (!seen.has(carId)) orderedCarIds.push(carId);
  }

  return { suggestedCarId: orderedCarIds[0] ?? null, orderedCarIds };
}

export function agreementHintForCar(
  driverId: string,
  carId: string,
  agreements: Agreement[],
): "active" | "past" | null {
  if (!driverId || !carId) return null;
  const match = agreements
    .filter((a) => a.driverId === driverId && a.carId === carId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
  if (!match) return null;
  return match.status === AgreementStatus.ACTIVE ? "active" : "past";
}

/**
 * Returns a list of driver ids that have an active or past agreement for
 * the given car, ordered by recency (active first, then most recent past).
 * The first element is the suggested driver for that car.
 */
export function rankDriversForCar(
  carId: string,
  agreements: Agreement[],
  allDriverIds: string[],
): { suggestedDriverId: string | null; orderedDriverIds: string[] } {
  if (!carId) {
    return { suggestedDriverId: null, orderedDriverIds: [...allDriverIds] };
  }
  const related = agreements
    .filter((a) => a.carId === carId)
    .sort((a, b) => {
      const aActive = a.status === AgreementStatus.ACTIVE ? 1 : 0;
      const bActive = b.status === AgreementStatus.ACTIVE ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  const orderedDriverIds: string[] = [];
  const seen = new Set<string>();
  for (const agreement of related) {
    if (agreement.driverId && !seen.has(agreement.driverId)) {
      seen.add(agreement.driverId);
      orderedDriverIds.push(agreement.driverId);
    }
  }
  for (const driverId of allDriverIds) {
    if (!seen.has(driverId)) orderedDriverIds.push(driverId);
  }
  return { suggestedDriverId: orderedDriverIds[0] ?? null, orderedDriverIds };
}

/**
 * Returns the kind of relationship the most recent agreement has for
 * (carId, driverId). Mirrors `agreementHintForCar` but in the other
 * direction — used to show a hint like "Current rental" or "Previous
 * rental" next to a driver option in the income form.
 */
export function agreementHintForDriver(
  carId: string,
  driverId: string,
  agreements: Agreement[],
): "active" | "past" | null {
  if (!driverId || !carId) return null;
  const match = agreements
    .filter((a) => a.driverId === driverId && a.carId === carId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
  if (!match) return null;
  return match.status === AgreementStatus.ACTIVE ? "active" : "past";
}
