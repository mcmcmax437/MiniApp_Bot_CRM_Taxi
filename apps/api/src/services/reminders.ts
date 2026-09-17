import { prisma } from "../prisma.js";
import { AgreementStatus, type ReminderItem } from "@taxi/shared";
import { computeDriverBalances } from "./balance.js";
import {
  daysUntil,
  parseDaysBeforeList,
} from "./maintenance.js";
import { ensureReminderSettings } from "./reminder-settings.js";

function carLabel(c: { plate: string; make: string | null; model: string | null }): string {
  const m = [c.make, c.model].filter(Boolean).join(" ");
  return m ? `${c.plate} (${m})` : c.plate;
}

/**
 * Whether a date-based reminder (insurance / inspection / document) should
 * surface today.
 *
 * Rules:
 *  - always when due today or overdue
 *  - on each configured "N days before" day
 *  - every day after the earliest configured threshold until due
 *    (so a missed cron run still notifies the next morning)
 */
export function shouldEmitDateReminder(daysLeft: number, daysBeforeList: number[]): boolean {
  if (daysLeft <= 0) return true;
  if (daysBeforeList.length === 0) return false;
  if (daysBeforeList.includes(daysLeft)) return true;
  // Catch-up: already inside the reminder window (past at least one threshold).
  return daysBeforeList.some((d) => d > daysLeft);
}

function startOfCurrentWeek(now: Date, weekday: number): Date {
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diff = (day - weekday + 7) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diff);
  return start;
}

export function isWeeklyMileageSkipped(
  settings: { weeklyMileageSkippedWeekStart?: Date | null; weeklyMileageWeekday: number },
  now: Date = new Date(),
): boolean {
  if (!settings.weeklyMileageSkippedWeekStart) return false;
  return (
    settings.weeklyMileageSkippedWeekStart.getTime() ===
    startOfCurrentWeek(now, settings.weeklyMileageWeekday).getTime()
  );
}

/**
 * Start of the current "weekly mileage" window, anchored to the configured
 * weekday (e.g. Monday at 00:00). Anchoring to a fixed weekday — instead of
 * a rolling 7-day window from the last log — guarantees that:
 *
 *  - A car that hasn't been logged this calendar week always shows up in
 *    the in-app reminder list and the weekly Telegram push, regardless of
 *    whether the previous week's notification was acted on.
 *  - A car that *is* logged between two scheduled weekdays is considered
 *    up-to-date for that week and stops showing up everywhere until the
 *    next window opens.
 *  - The same definition is shared between the in-app reminder builder and
 *    the weekly Telegram job so the two channels can never disagree.
 */

/**
 * Return the cars in the owner's fleet that don't have a mileage log
 * recorded since the start of the current weekly window. Used by both the
 * in-app reminder list and the weekly Telegram push so they stay in sync.
 */
async function findCarsNeedingMileage(
  ownerId: string,
  settings: {
    weeklyMileageEnabled: boolean;
    weeklyMileageWeekday: number;
    weeklyMileageSkippedWeekStart?: Date | null;
  },
  now: Date = new Date(),
): Promise<
  Array<{ id: string; plate: string; make: string | null; model: string | null }>
> {
  if (!settings.weeklyMileageEnabled) return [];
  if (isWeeklyMileageSkipped(settings, now)) return [];
  const cars = await prisma.car.findMany({
    where: { ownerId },
    select: { id: true, plate: true, make: true, model: true },
  });
  if (cars.length === 0) return [];
  const windowStart = startOfCurrentWeek(now, settings.weeklyMileageWeekday);
  const stale = await prisma.mileageLog.findMany({
    where: { ownerId, recordedAt: { gte: windowStart } },
    select: { carId: true },
  });
  const logged = new Set(stale.map((m) => m.carId));
  return cars.filter((c) => !logged.has(c.id));
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
  if (!shouldEmitDateReminder(left, daysBeforeList)) return;

  const detail =
    left < 0 ? "overdue" : left === 0 ? "today" : `${left}d`;

  items.push({
    kind,
    refId,
    carId,
    label,
    dueDate: dueDate.toISOString(),
    daysUntil: left,
    detail,
  });
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
    // Inspection-by-mileage reminder. We always emit the entry so the user
    // can see exactly how many km are left until the next inspection — not
    // just when they're close to due. The previous version only emitted
    // when kmLeft <= 500, which made it look like the system had no idea
    // about the inspection interval until the last moment.
    const interval = settings.inspectionMileageIntervalKm;
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
      const baseline = lastInspectionMileage.get(c.id);
      if (baseline == null) continue;
      const nextDue = baseline + interval;
      const kmLeft = nextDue - c.currentMileage;
      // Always include the reminder so the user can plan ahead. The "kmLeft"
      // detail (e.g. "1 240 km") carries the exact remaining distance; the
      // UI styles it red once overdue or amber when close (<500 km).
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

  // Maintenance rules are no longer surfaced as reminders. Insurance,
  // inspection and document reminders already cover the cases that
  // mattered (the next service date, the next inspection mileage, the next
  // insurance/doc expiry). The underlying MaintenanceRule model and the
  // tracking UI stay in place — the user just doesn't get a daily nag
  // for each rule.

  // Weekly mileage check-in. Anchored to the configured weekday (see
  // findCarsNeedingMileage) so a missed week never blocks the next one
  // from surfacing — exactly the behaviour requested when the previous
  // fix was merged. Runs in a single pass so we don't issue a query per
  // car (the fleet at a glance page can be large).
  const needsMileage = await findCarsNeedingMileage(ownerId, settings, now);
  for (const c of needsMileage) {
    items.push({
      kind: "MILEAGE_REPORT",
      refId: c.id,
      carId: c.id,
      label: carLabel(c),
      dueDate: null,
      detail: "weekly",
    });
  }

  const balances = await computeDriverBalances(ownerId);
  for (const b of balances) {
    if (b.balance > 0) {
      // Surface the active car plate(s) alongside the driver name so the
      // owner can immediately tell *which* car the overdue balance is
      // tied to. Most drivers have one active car; if they have
      // multiple, join the plates with a comma. Falls back to the
      // driver name alone when no active car is on file (shouldn't
      // happen in practice, but keep the reminder safe).
      const plateText = b.activeCars.map((c) => c.plate).join(", ");
      const primaryCar = b.activeCars[0];
      const label = plateText ? `${b.driverName} — ${plateText}` : b.driverName;
      items.push({
        kind: "OVERDUE_PAYMENT",
        refId: b.driverId,
        carId: primaryCar?.id,
        label,
        dueDate: null,
        amount: b.balance,
      });
    }
  }

  // Rental agreements with an end date: nudge the owner 7 days before and
  // again 1 day before the contract expires so they have time to arrange
  // hand-off or a follow-up agreement. Skip ENDED/CANCELLED agreements and
  // any whose end date is already in the past (the OVERDUE state would
  // otherwise be redundant with the active-rental logic).
  const rentalEndingDays = [7, 1];
  const activeAgreements = await prisma.rentalAgreement.findMany({
    where: {
      ownerId,
      status: AgreementStatus.ACTIVE,
      endDate: { not: null },
    },
    include: {
      car: { select: { id: true, plate: true, make: true, model: true } },
      driver: { select: { id: true, fullName: true } },
    },
  });
  for (const a of activeAgreements) {
    if (!a.endDate) continue;
    const left = daysUntil(a.endDate);
    if (left < 0) continue;
    if (!rentalEndingDays.includes(left)) continue;
    const carText = carLabel(a.car);
    const driverText = a.driver?.fullName ?? a.temporaryDriverName ?? "";
    const label = driverText ? `${driverText} — ${carText}` : carText;
    items.push({
      kind: "RENTAL_ENDING",
      refId: a.id,
      carId: a.carId,
      driverId: a.driverId ?? undefined,
      label,
      dueDate: a.endDate.toISOString(),
      daysUntil: left,
      detail: `${left}d`,
    });
  }

  items.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (da !== db) return da - db;
    return (a.daysUntil ?? 999) - (b.daysUntil ?? 999);
  });

  return items;
}

/** Skip the weekly mileage report for the owner's current weekly window. */
export async function skipWeeklyMileageReport(ownerId: string): Promise<void> {
  const settings = await ensureReminderSettings(ownerId);
  const weekStart = startOfCurrentWeek(new Date(), settings.weeklyMileageWeekday);
  await prisma.ownerReminderSettings.update({
    where: { ownerId },
    data: { weeklyMileageSkippedWeekStart: weekStart },
  });
}

/** Clear a weekly mileage skip (e.g. owner changed their mind). */
export async function unskipWeeklyMileageReport(ownerId: string): Promise<void> {
  await prisma.ownerReminderSettings.update({
    where: { ownerId },
    data: { weeklyMileageSkippedWeekStart: null },
  });
}

/** Due-date kinds for the compliance Telegram digest (no mileage, no balances). */
const TELEGRAM_DUE_KINDS = new Set<ReminderItem["kind"]>([
  "INSURANCE",
  "INSPECTION",
  "DOCUMENT",
  "RENTAL_ENDING",
]);

const TELEGRAM_DUE_SECTIONS: Array<{
  kind: ReminderItem["kind"];
  emoji: string;
  title: string;
}> = [
  { kind: "INSPECTION", emoji: "🔧", title: "Inspection" },
  { kind: "INSURANCE", emoji: "🛡️", title: "Insurance" },
  { kind: "DOCUMENT", emoji: "📄", title: "Documents" },
  { kind: "RENTAL_ENDING", emoji: "🚗", title: "Rental ending" },
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Split `PLATE (Make Model)` labels into plate + vehicle for cleaner lines. */
export function splitCarLabel(label: string): { plate: string; vehicle: string | null } {
  const m = label.match(/^(.+?)\s+\((.+)\)$/);
  if (!m) return { plate: label, vehicle: null };
  return { plate: m[1], vehicle: m[2] };
}

export function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatReminderTiming(item: ReminderItem): string {
  if (item.daysUntil != null) {
    if (item.daysUntil < 0) return `⚠ ${Math.abs(item.daysUntil)}d overdue`;
    if (item.daysUntil === 0) return "⚠ due today";
    if (item.daysUntil <= 3) return `⏰ ${item.daysUntil}d left`;
    return `${item.daysUntil}d left`;
  }
  if (item.detail && item.detail !== "weekly") return item.detail;
  return "";
}

function urgencyRank(item: ReminderItem): number {
  if (item.daysUntil == null) return 999;
  return item.daysUntil;
}

/** One vehicle block inside a due-date section. */
export function formatDueReminderBlock(item: ReminderItem): string {
  const { plate, vehicle } = splitCarLabel(item.label);
  const title = vehicle ? `<b>${plate}</b> · ${vehicle}` : `<b>${plate}</b>`;
  const date = item.dueDate ? formatDisplayDate(item.dueDate) : "";
  const timing = formatReminderTiming(item);
  const meta = [date, timing].filter(Boolean).join(" · ");
  if (!meta) return title;
  return `${title}\n   ${meta}`;
}

/** One plate line in the mileage message. */
export function formatMileageReminderLine(item: ReminderItem): string {
  const { plate, vehicle } = splitCarLabel(item.label);
  return vehicle ? `• <b>${plate}</b> · ${vehicle}` : `• <b>${plate}</b>`;
}

function appendOmitted(parts: string[], omitted: number): void {
  if (omitted > 0) {
    parts.push("");
    parts.push(`<i>…and ${omitted} more in the app</i>`);
  }
}

/**
 * Compliance digest: inspection, insurance, documents, rental ending.
 * Outstanding balances and mileage are intentionally excluded.
 */
export function formatDueDatesMessage(items: ReminderItem[]): string | null {
  const due = items
    .filter((i) => TELEGRAM_DUE_KINDS.has(i.kind))
    .slice()
    .sort((a, b) => urgencyRank(a) - urgencyRank(b));
  if (due.length === 0) return null;

  const MAX_ITEMS = 30;
  const capped = due.slice(0, MAX_ITEMS);
  const omitted = due.length - capped.length;

  const parts: string[] = ["📅 <b>Fleet due dates</b>", "<i>Insurance · inspection · documents</i>"];

  for (const section of TELEGRAM_DUE_SECTIONS) {
    const sectionItems = capped
      .filter((i) => i.kind === section.kind)
      .sort((a, b) => urgencyRank(a) - urgencyRank(b));
    if (sectionItems.length === 0) continue;
    parts.push("");
    parts.push(`${section.emoji} <b>${section.title}</b> · ${sectionItems.length}`);
    for (const item of sectionItems) {
      parts.push(formatDueReminderBlock(item));
      parts.push("");
    }
    // Drop trailing blank after the last item in this section.
    if (parts[parts.length - 1] === "") parts.pop();
  }

  appendOmitted(parts, omitted);
  return parts.join("\n");
}

/**
 * Separate mileage check-in message — kept apart from due-date reminders
 * so owners can act on compliance without scrolling past a long plate list.
 */
export function formatMileageReminderMessage(items: ReminderItem[]): string | null {
  const mileage = items.filter((i) => i.kind === "MILEAGE_REPORT");
  if (mileage.length === 0) return null;

  const MAX_ITEMS = 40;
  const capped = mileage.slice(0, MAX_ITEMS);
  const omitted = mileage.length - capped.length;

  const intro =
    mileage.length === 1
      ? "One vehicle still needs an odometer update this week:"
      : `${mileage.length} vehicles still need an odometer update this week:`;

  const parts: string[] = ["📊 <b>Mileage check-in</b>", "", intro, ""];
  for (const item of capped) {
    parts.push(formatMileageReminderLine(item));
  }
  appendOmitted(parts, omitted);
  return parts.join("\n");
}

/**
 * Build the Telegram daily digests as separate messages:
 * 1) due dates (inspection / insurance / …)
 * 2) mileage check-in
 *
 * Outstanding balances are never included.
 */
export function formatDailyReminderMessages(items: ReminderItem[]): string[] {
  const messages: string[] = [];
  const due = formatDueDatesMessage(items);
  if (due) messages.push(due);
  const mileage = formatMileageReminderMessage(items);
  if (mileage) messages.push(mileage);
  return messages;
}

/** @deprecated Prefer formatDailyReminderMessages — kept for callers/tests. */
export function formatDailyReminderMessage(items: ReminderItem[]): string | null {
  const messages = formatDailyReminderMessages(items);
  return messages.length > 0 ? messages.join("\n\n————————\n\n") : null;
}

/** Build reminders for every active owner and push them Telegram summaries. */
export async function runReminderJob(
  sendMessage: (chatId: bigint, text: string) => Promise<void>,
  log: (msg: string, meta?: unknown) => void = () => {},
): Promise<void> {
  const owners = await prisma.owner.findMany({ where: { status: "ACTIVE" } });
  for (const owner of owners) {
    try {
      const items = await buildReminders(owner.id);
      const messages = formatDailyReminderMessages(items);
      if (messages.length === 0) continue;
      for (const text of messages) {
        await sendMessage(owner.telegramUserId, text);
      }
      log(`Sent ${messages.length} daily reminder message(s) to owner ${owner.id}`);
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
  const now = new Date();
  const weekday = now.getDay();
  const owners = await prisma.owner.findMany({
    where: { status: "ACTIVE" },
    include: { reminderSettings: true },
  });

  for (const owner of owners) {
    const settings = owner.reminderSettings ?? (await ensureReminderSettings(owner.id));
    if (!settings.weeklyMileageEnabled || settings.weeklyMileageWeekday !== weekday) continue;

    // Only list cars that haven't been logged this week. This is the same
    // definition used by the in-app reminder list, so the two channels
    // agree. A car that wasn't logged last week is still on the list this
    // week — nothing suppresses the next reminder if the previous one
    // was missed.
    const stale = await findCarsNeedingMileage(owner.id, settings, now);
    if (stale.length === 0) continue;

    const lines = stale.map((c) => `• ${carLabel(c)}`);
    const text = [
      "<b>Weekly mileage report</b>",
      "",
      stale.length === 1
        ? "One vehicle still needs an odometer update this week:"
        : `${stale.length} vehicles still need an odometer update this week:`,
      "",
      ...lines,
    ].join("\n");

    try {
      await sendMessage(owner.telegramUserId, text);
      log(`Sent weekly mileage prompt to owner ${owner.id} (${stale.length} cars)`);
    } catch (err) {
      log(`Failed weekly mileage for owner ${owner.id}`, err);
    }
  }
}
