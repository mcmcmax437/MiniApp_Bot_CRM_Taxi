import type { ReminderItem } from "@taxi/shared";
import type { TFunction } from "i18next";

const CAR_REMINDER_KINDS = new Set<ReminderItem["kind"]>([
  "INSURANCE",
  "INSPECTION",
  "DOCUMENT",
  "MILEAGE_REPORT",
]);

export function carRemindersForCar(
  carId: string,
  reminders: ReminderItem[] | undefined,
): ReminderItem[] {
  return (reminders ?? []).filter((item) => {
    if (!CAR_REMINDER_KINDS.has(item.kind)) return false;
    if (item.carId === carId) return true;
    if (item.kind === "INSURANCE" || item.kind === "INSPECTION" || item.kind === "MILEAGE_REPORT") {
      return item.refId === carId;
    }
    return false;
  });
}

export function carAttentionReasons(
  carId: string,
  reminders: ReminderItem[] | undefined,
  t: TFunction,
): string[] {
  return carRemindersForCar(carId, reminders).map((r) => {
    const parts = [t(`reminders.${r.kind}`), r.label];
    if (r.daysUntil != null) {
      if (r.daysUntil < 0) parts.push(t("reminders.daysOverdue", { count: -r.daysUntil }));
      else parts.push(t("reminders.daysUntil", { count: r.daysUntil }));
    } else if (r.detail) {
      parts.push(r.detail);
    }
    return parts.filter(Boolean).join(" · ");
  });
}

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
