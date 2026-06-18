import type { ReminderItem } from "@taxi/shared";

const CAR_REMINDER_KINDS = new Set<ReminderItem["kind"]>([
  "INSURANCE",
  "INSPECTION",
  "DOCUMENT",
  "MILEAGE_REPORT",
]);

export function carAttentionIds(reminders: ReminderItem[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const item of reminders ?? []) {
    if (!CAR_REMINDER_KINDS.has(item.kind)) continue;
    if (item.carId) ids.add(item.carId);
    else if (item.kind === "INSURANCE" || item.kind === "INSPECTION" || item.kind === "MILEAGE_REPORT") {
      ids.add(item.refId);
    }
  }
  return ids;
}

export function carNeedsAttention(carId: string, reminders: ReminderItem[] | undefined): boolean {
  return carAttentionIds(reminders).has(carId);
}
