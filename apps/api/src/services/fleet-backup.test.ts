import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, notifyMock } = vi.hoisted(() => ({
  prismaMock: {
    owner: { findUnique: vi.fn(), findMany: vi.fn() },
    car: { findMany: vi.fn() },
    driver: { findMany: vi.fn() },
    rentalAgreement: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    fine: { findMany: vi.fn() },
    shift: { findMany: vi.fn() },
    document: { findMany: vi.fn() },
    carDocument: { findMany: vi.fn() },
    maintenanceRule: { findMany: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    mileageLog: { findMany: vi.fn() },
    ownerReminderSettings: { findUnique: vi.fn() },
    fleetMember: { findMany: vi.fn() },
    carPurchasePart: { findMany: vi.fn() },
  },
  notifyMock: {
    sendTelegramDocument: vi.fn(),
    sendTelegramMessage: vi.fn(),
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../notify.js", () => notifyMock);

import {
  backupFilename,
  buildOwnerBackup,
  deliverOwnerBackup,
  isFirstDayOfMonth,
  kyivCalendarDate,
  runMonthlyBackupJob,
} from "./fleet-backup.js";

function resetPrismaDefaults(): void {
  prismaMock.owner.findUnique.mockResolvedValue({ id: "owner-1", telegramUserId: 42n });
  prismaMock.owner.findMany.mockResolvedValue([]);
  prismaMock.car.findMany.mockResolvedValue([]);
  prismaMock.driver.findMany.mockResolvedValue([]);
  prismaMock.rentalAgreement.findMany.mockResolvedValue([]);
  prismaMock.payment.findMany.mockResolvedValue([]);
  prismaMock.expense.findMany.mockResolvedValue([]);
  prismaMock.fine.findMany.mockResolvedValue([]);
  prismaMock.shift.findMany.mockResolvedValue([]);
  prismaMock.document.findMany.mockResolvedValue([]);
  prismaMock.carDocument.findMany.mockResolvedValue([]);
  prismaMock.maintenanceRule.findMany.mockResolvedValue([]);
  prismaMock.maintenanceRecord.findMany.mockResolvedValue([]);
  prismaMock.mileageLog.findMany.mockResolvedValue([]);
  prismaMock.ownerReminderSettings.findUnique.mockResolvedValue(null);
  prismaMock.fleetMember.findMany.mockResolvedValue([]);
  prismaMock.carPurchasePart.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  resetPrismaDefaults();
  notifyMock.sendTelegramDocument.mockResolvedValue(undefined);
  notifyMock.sendTelegramMessage.mockResolvedValue(undefined);
});

describe("monthly backup calendar", () => {
  it("uses the Kyiv date", () => {
    // 2026-09-30 22:30 UTC is 2026-10-01 01:30 in Kyiv.
    const now = new Date("2026-09-30T22:30:00.000Z");
    expect(kyivCalendarDate(now)).toEqual({ year: "2026", month: "10", day: "01" });
    expect(isFirstDayOfMonth(now)).toBe(true);
    expect(backupFilename(now)).toBe("taxi-backup-2026-10-01.json");
  });

  it("is not the first on other Kyiv days", () => {
    expect(isFirstDayOfMonth(new Date("2026-10-01T21:30:00.000Z"))).toBe(false);
  });
});

describe("buildOwnerBackup", () => {
  it("scopes exported records to the owner and serializes bigint values", async () => {
    prismaMock.owner.findUnique.mockResolvedValue({
      id: "owner-1",
      telegramUserId: 123456789012345678n,
    });
    prismaMock.car.findMany.mockResolvedValue([{ id: "car-1", ownerId: "owner-1", odometer: 98765n }]);
    prismaMock.payment.findMany.mockResolvedValue([{ id: "payment-1", ownerId: "owner-1", amount: 2500n }]);
    prismaMock.carPurchasePart.findMany.mockResolvedValue([{ id: "part-1", amount: 1000n }]);

    const snapshot = await buildOwnerBackup("owner-1");

    expect(snapshot.owner).toEqual({
      id: "owner-1",
      telegramUserId: "123456789012345678",
    });
    expect(snapshot.cars).toEqual([{ id: "car-1", ownerId: "owner-1", odometer: "98765" }]);
    expect(snapshot.payments).toEqual([{ id: "payment-1", ownerId: "owner-1", amount: "2500" }]);
    expect(snapshot.purchaseParts).toEqual([{ id: "part-1", amount: "1000" }]);
    expect(prismaMock.car.findMany).toHaveBeenCalledWith({ where: { ownerId: "owner-1" } });
    expect(prismaMock.driver.findMany).toHaveBeenCalledWith({ where: { ownerId: "owner-1" } });
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith({ where: { ownerId: "owner-1" } });
    expect(prismaMock.fleetMember.findMany).toHaveBeenCalledWith({
      where: { fleetOwnerId: "owner-1" },
    });
    expect(prismaMock.carPurchasePart.findMany).toHaveBeenCalledWith({
      where: { car: { ownerId: "owner-1" } },
    });
  });

  it("keeps exporting if optional purchase parts are unavailable", async () => {
    prismaMock.carPurchasePart.findMany.mockRejectedValueOnce(new Error("table missing"));

    const snapshot = await buildOwnerBackup("owner-1");

    expect(snapshot.purchaseParts).toEqual([]);
    expect(snapshot.owner).toEqual({ id: "owner-1", telegramUserId: "42" });
  });
});

describe("deliverOwnerBackup", () => {
  it("uploads a Kyiv-dated JSON document with a localized caption", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T22:30:00.000Z"));

    await deliverOwnerBackup({ id: "owner-1", telegramUserId: 123n, locale: "en" });

    expect(notifyMock.sendTelegramDocument).toHaveBeenCalledTimes(1);
    const [chatId, filename, content, caption] = notifyMock.sendTelegramDocument.mock.calls[0];
    expect(chatId).toBe(123n);
    expect(filename).toBe("taxi-backup-2026-10-01.json");
    expect(caption).toContain("Fleet database backup (taxi-backup-2026-10-01.json)");
    expect(JSON.parse(Buffer.from(content).toString("utf8"))).toMatchObject({
      owner: { id: "owner-1", telegramUserId: "42" },
      cars: [],
    });
    expect(notifyMock.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("sends a warning instead of uploading when the backup exceeds Telegram limits", async () => {
    prismaMock.owner.findUnique.mockResolvedValue({ id: "owner-1", payload: "x".repeat(45 * 1024 * 1024) });

    await deliverOwnerBackup({ id: "owner-1", telegramUserId: 123n, locale: "uk" });

    expect(notifyMock.sendTelegramDocument).not.toHaveBeenCalled();
    expect(notifyMock.sendTelegramMessage).toHaveBeenCalledWith(
      123n,
      "Резервна копія завелика для Telegram.",
    );
  });
});

describe("runMonthlyBackupJob", () => {
  it("does not query owners when it is not the first Kyiv day of the month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T21:30:00.000Z"));

    await runMonthlyBackupJob();

    expect(prismaMock.owner.findMany).not.toHaveBeenCalled();
    expect(notifyMock.sendTelegramDocument).not.toHaveBeenCalled();
  });

  it("sends active owners and continues after one owner fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T22:30:00.000Z"));
    prismaMock.owner.findMany.mockResolvedValue([
      { id: "owner-1", telegramUserId: 111n, locale: "en" },
      { id: "owner-2", telegramUserId: 222n, locale: "ru" },
    ]);
    notifyMock.sendTelegramDocument.mockRejectedValueOnce(new Error("telegram down"));
    const log = vi.fn();

    await runMonthlyBackupJob(log);

    expect(prismaMock.owner.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      select: { id: true, telegramUserId: true, locale: true },
    });
    expect(notifyMock.sendTelegramDocument).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("Monthly backup failed for owner owner-1", expect.any(Error));
    expect(log).toHaveBeenCalledWith("Sent monthly backup to owner owner-2");
  });
});
