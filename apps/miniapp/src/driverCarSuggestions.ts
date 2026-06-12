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
