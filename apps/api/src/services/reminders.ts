import { prisma } from "../prisma.js";
import type { ReminderItem } from "@taxi/shared";
import { computeDriverBalances } from "./balance.js";
import {
  daysUntil,
  isMaintenanceDue,
  parseDaysBeforeList,
} from "./maintenance.js";
import { ensureReminderSettings } from "./reminder-settings.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function carLabel(c: { plate: string; make: string | null; model: string | null }): string {
  const m = [c.make, c.model].filter(Boolean).join(" ");
  return m ? `${c.plate} (${m})` : c.plate;
}

function pushDateReminders(
  items: ReminderItem[],
  kind: ReminderItem["kind"],
  refId: string,
  label: string,
  dueDate: Date,
  daysBeforeList: number[],
  carId?: string,
): void {
  const left = daysUntil(dueDate);
  if (left < 0) {
    items.push({
      kind,
      refId,
      carId,
      label,
      dueDate: dueDate.toISOString(),
      daysUntil: left,
      detail: "overdue",
    });
    return;
  }
  for (const d of daysBeforeList) {
    if (left <= d) {
      items.push({
        kind,
        refId,
        carId,
        label,
        dueDate: dueDate.toISOString(),
        daysUntil: left,
        detail: `${left}d`,
      });
      break;
    }
  }
}

/** Build the reminder list for a single owner. */
export async function buildReminders(ownerId: string): Promise<ReminderItem[]> {
  const settings = await ensureReminderSettings(ownerId);
  const items: ReminderItem[] = [];
  const now = new Date();

  const cars = await prisma.car.findMany({ where: { ownerId } });
  const insuranceDays = parseDaysBeforeList(settings.insuranceDaysBefore);
  const inspectionDays = parseDaysBeforeList(settings.inspectionDaysBefore);

  for (const c of cars) {
    if (c.insuranceExpiry) {
      pushDateReminders(items, "INSURANCE", c.id, carLabel(c), c.insuranceExpiry, insuranceDays, c.id);
    }
    if (c.inspectionExpiry) {
      pushDateReminders(items, "INSPECTION", c.id, carLabel(c), c.inspectionExpiry, inspectionDays, c.id);
    }
  }

  if (settings.inspectionMileageIntervalKm) {
    const interval = settings.inspectionMileageIntervalKm;
    const warnKm = 500;
    const inspectionRecords = await prisma.maintenanceRecord.findMany({
      where: { ownerId, presetKey: "presetInspectionService", mileageAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { carId: true, mileageAt: true },
    });
    const lastInspectionMileage = new Map<string, number>();
    for (const rec of inspectionRecords) {
      if (!lastInspectionMileage.has(rec.carId) && rec.mileageAt != null) {
        lastInspectionMileage.set(rec.carId, rec.mileageAt);
      }
    }
    const inspectionRules = await prisma.maintenanceRule.findMany({
      where: { ownerId, presetKey: "presetInspectionService", lastCompletedMileage: { not: null } },
      select: { carId: true, lastCompletedMileage: true },
    });
    for (const rule of inspectionRules) {
      if (rule.lastCompletedMileage != null && !lastInspectionMileage.has(rule.carId)) {
        lastInspectionMileage.set(rule.carId, rule.lastCompletedMileage);
      }
    }
    for (const c of cars) {
      if (c.currentMileage == null) continue;
      const baseline = lastInspectionMileage.get(c.id) ?? 0;
      const nextDue = baseline + interval;
      const kmLeft = nextDue - c.currentMileage;
      if (kmLeft <= warnKm) {
        items.push({
          kind: "INSPECTION",
          refId: `${c.id}-mileage`,
          carId: c.id,
          label: carLabel(c),
          dueDate: null,
          detail: kmLeft <= 0 ? "overdue" : `${kmLeft} km`,
        });
      }
    }
  }

  const docDays = parseDaysBeforeList(settings.documentDaysBefore);
  const docs = await prisma.carDocument.findMany({
    where: { ownerId, expiryDate: { not: null } },
    include: { car: { select: { plate: true, make: true, model: true } } },
  });
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    const label = `${doc.title} — ${carLabel(doc.car)}`;
    pushDateReminders(items, "DOCUMENT", doc.id, label, doc.expiryDate, docDays, doc.carId);
  }

  const maintDays = parseDaysBeforeList(settings.maintenanceDaysBefore);
  const rules = await prisma.maintenanceRule.findMany({
    where: { ownerId, isActive: true },
    include: { car: { select: { plate: true, make: true, model: true, currentMileage: true } } },
  });
  for (const rule of rules) {
    const label = `${rule.name} — ${carLabel(rule.car)}`;
    if (isMaintenanceDue(rule, rule.car.currentMileage, now)) {
      items.push({
        kind: "MAINTENANCE",
        refId: rule.id,
        carId: rule.carId,
        label,
        dueDate: rule.nextDueDate?.toISOString() ?? null,
        detail: "due",
      });
      continue;
    }
    if (rule.nextDueDate) {
      pushDateReminders(items, "MAINTENANCE", rule.id, label, rule.nextDueDate, maintDays, rule.carId);
    }
    if (rule.nextDueMileage != null && rule.car.currentMileage != null) {
      const kmLeft = rule.nextDueMileage - rule.car.currentMileage;
      if (kmLeft <= 500) {
        items.push({
          kind: "MAINTENANCE",
          refId: rule.id,
          carId: rule.carId,
          label,
          dueDate: null,
          detail: `${kmLeft} km`,
        });
      }
    } else if (!rule.nextDueDate && rule.nextDueMileage != null) {
      const soon = rule.car.currentMileage == null;
      if (soon) {
        items.push({
          kind: "MAINTENANCE",
          refId: rule.id,
          carId: rule.carId,
          label,
          dueDate: null,
          detail: `${rule.nextDueMileage} km`,
        });
      }
    }
  }

  if (settings.weeklyMileageEnabled) {
    const weekAgo = new Date(now.getTime() - WEEK_MS);
    for (const c of cars) {
      const recent = await prisma.mileageLog.findFirst({
        where: { carId: c.id, recordedAt: { gte: weekAgo } },
      });
      if (!recent) {
        items.push({
          kind: "MILEAGE_REPORT",
          refId: c.id,
          carId: c.id,
          label: carLabel(c),
          dueDate: null,
          detail: "weekly",
        });
      }
    }
  }

  const balances = await computeDriverBalances(ownerId);
  for (const b of balances) {
    if (b.balance > 0) {
      items.push({
        kind: "OVERDUE_PAYMENT",
        refId: b.driverId,
        label: b.driverName,
        dueDate: null,
        amount: b.balance,
      });
    }
  }

  items.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (da !== db) return da - db;
    return (a.daysUntil ?? 999) - (b.daysUntil ?? 999);
  });

  return items;
}

function formatReminderLine(item: ReminderItem): string {
  const date = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : "";
  const extra = item.daysUntil != null ? ` (${item.daysUntil}d)` : item.detail ? ` (${item.detail})` : "";
  switch (item.kind) {
    case "INSURANCE":
      return `🛡️ Insurance: <b>${item.label}</b> — ${date}${extra}`;
    case "INSPECTION":
      return `🔧 Inspection: <b>${item.label}</b> — ${date}${extra}`;
    case "DOCUMENT":
      return `📄 Document: <b>${item.label}</b> — ${date}${extra}`;
    case "MAINTENANCE":
      return `🔩 Maintenance: <b>${item.label}</b>${date ? ` — ${date}` : ""}${extra}`;
    case "MILEAGE_REPORT":
      return `📊 Mileage update needed: <b>${item.label}</b>`;
    case "OVERDUE_PAYMENT":
      return `💸 Outstanding balance: <b>${item.label}</b> — ${item.amount?.toFixed(2)}`;
    default:
      return item.label;
  }
}

/** Build reminders for every active owner and push them a Telegram summary. */
export async function runReminderJob(
  sendMessage: (chatId: bigint, text: string) => Promise<void>,
  log: (msg: string, meta?: unknown) => void = () => {},
): Promise<void> {
  const owners = await prisma.owner.findMany({ where: { status: "ACTIVE" } });
  for (const owner of owners) {
    try {
      const items = await buildReminders(owner.id);
      if (items.length === 0) continue;
      const lines = items.slice(0, 30).map(formatReminderLine);
      const text = [`<b>Daily reminders</b>`, "", ...lines].join("\n");
      await sendMessage(owner.telegramUserId, text);
      log(`Sent ${items.length} reminders to owner ${owner.id}`);
    } catch (err) {
      log(`Failed to send reminders to owner ${owner.id}`, err);
    }
  }
}

/** Weekly mileage report nudge on configured weekday. */
export async function runWeeklyMileageJob(
  sendMessage: (chatId: bigint, text: string) => Promise<void>,
  log: (msg: string, meta?: unknown) => void = () => {},
): Promise<void> {
  const weekday = new Date().getDay();
  const owners = await prisma.owner.findMany({
    where: { status: "ACTIVE" },
    include: { reminderSettings: true },
  });

  for (const owner of owners) {
    const settings = owner.reminderSettings ?? (await ensureReminderSettings(owner.id));
    if (!settings.weeklyMileageEnabled || settings.weeklyMileageWeekday !== weekday) continue;

    const cars = await prisma.car.findMany({ where: { ownerId: owner.id } });
    if (cars.length === 0) continue;

    const lines = cars.map((c) => `• ${carLabel(c)}`);
    const text = [
      "<b>Weekly mileage report</b>",
      "",
      "Please update the odometer reading for each vehicle in TaxiCRM.",
      "",
      ...lines,
    ].join("\n");

    try {
      await sendMessage(owner.telegramUserId, text);
      log(`Sent weekly mileage prompt to owner ${owner.id}`);
    } catch (err) {
      log(`Failed weekly mileage for owner ${owner.id}`, err);
    }
  }
}
