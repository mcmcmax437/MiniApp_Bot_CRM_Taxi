import { prisma } from "../prisma.js";
import { sendTelegramDocument, sendTelegramMessage } from "../notify.js";

const MAX_BYTES = 45 * 1024 * 1024;

export function kyivCalendarDate(now = new Date()): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return { year, month, day };
}

export function isFirstDayOfMonth(now = new Date()): boolean {
  return kyivCalendarDate(now).day === "01";
}

export function backupFilename(now = new Date()): string {
  const { year, month, day } = kyivCalendarDate(now);
  return `taxi-backup-${year}-${month}-${day}.json`;
}

function backupCaption(locale: string, filename: string): string {
  if (locale === "ru") {
    return `Резервная копия автопарка (${filename}). Это записи базы. Фото остаются на сервере.`;
  }
  if (locale === "en") {
    return `Fleet database backup (${filename}). These are the database records. Photos stay on the server.`;
  }
  return `Резервна копія автопарку (${filename}). Це записи бази. Фото лишаються на сервері.`;
}

function tooLargeCaption(locale: string): string {
  if (locale === "ru") return "Резервная копия слишком большая для Telegram. Напишите, если нужен другой способ.";
  if (locale === "en") return "The backup is too large to send in Telegram.";
  return "Резервна копія завелика для Telegram.";
}

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val)),
  );
}

async function purchasePartsForOwner(ownerId: string): Promise<unknown[]> {
  const client = prisma as unknown as {
    carPurchasePart?: { findMany: (args: unknown) => Promise<unknown[]> };
  };
  if (!client.carPurchasePart) return [];
  try {
    return await client.carPurchasePart.findMany({ where: { car: { ownerId } } });
  } catch {
    return [];
  }
}

/** JSON snapshot of one fleet. Other owners' rows are not included. */
export async function buildOwnerBackup(ownerId: string): Promise<Record<string, unknown>> {
  const where = { ownerId };
  const [
    owner,
    cars,
    drivers,
    agreements,
    payments,
    expenses,
    fines,
    shifts,
    documents,
    carDocuments,
    maintenanceRules,
    maintenanceRecords,
    mileageLogs,
    reminderSettings,
    fleetMembers,
    purchaseParts,
  ] = await Promise.all([
    prisma.owner.findUnique({ where: { id: ownerId } }),
    prisma.car.findMany({ where }),
    prisma.driver.findMany({ where }),
    prisma.rentalAgreement.findMany({ where }),
    prisma.payment.findMany({ where }),
    prisma.expense.findMany({ where }),
    prisma.fine.findMany({ where }),
    prisma.shift.findMany({ where }),
    prisma.document.findMany({ where }),
    prisma.carDocument.findMany({ where }),
    prisma.maintenanceRule.findMany({ where }),
    prisma.maintenanceRecord.findMany({ where }),
    prisma.mileageLog.findMany({ where }),
    prisma.ownerReminderSettings.findUnique({ where: { ownerId } }),
    prisma.fleetMember.findMany({ where: { fleetOwnerId: ownerId } }),
    purchasePartsForOwner(ownerId),
  ]);

  return jsonSafe({
    exportedAt: new Date().toISOString(),
    owner,
    cars,
    purchaseParts,
    drivers,
    agreements,
    payments,
    expenses,
    fines,
    shifts,
    documents,
    carDocuments,
    maintenanceRules,
    maintenanceRecords,
    mileageLogs,
    reminderSettings,
    fleetMembers,
  }) as Record<string, unknown>;
}

export async function deliverOwnerBackup(owner: {
  id: string;
  telegramUserId: bigint;
  locale: string;
}): Promise<void> {
  const snapshot = await buildOwnerBackup(owner.id);
  const filename = backupFilename();
  const body = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
  if (body.byteLength > MAX_BYTES) {
    await sendTelegramMessage(owner.telegramUserId, tooLargeCaption(owner.locale));
    return;
  }
  await sendTelegramDocument(owner.telegramUserId, filename, body, backupCaption(owner.locale, filename));
}

/** Send each active fleet owner their own backup. */
export async function runMonthlyBackupJob(log: (msg: string, meta?: unknown) => void = () => {}): Promise<void> {
  if (!isFirstDayOfMonth()) return;
  const owners = await prisma.owner.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, telegramUserId: true, locale: true },
  });
  for (const owner of owners) {
    try {
      await deliverOwnerBackup(owner);
      log(`Sent monthly backup to owner ${owner.id}`);
    } catch (err) {
      log(`Monthly backup failed for owner ${owner.id}`, err);
    }
  }
}
