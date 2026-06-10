import type { RentPeriod } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { DriverBalance } from "@taxi/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function periodsElapsed(start: Date, asOf: Date, period: RentPeriod): number {
  const from = startOfDay(start);
  const to = startOfDay(asOf);
  if (to.getTime() < from.getTime()) return 0;

  const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS);
  switch (period) {
    case "DAILY":
      return days + 1;
    case "WEEKLY":
      return Math.floor(days / 7) + 1;
    case "MONTHLY": {
      const months =
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      return Math.max(0, months) + 1;
    }
    case "YEARLY": {
      const years = to.getFullYear() - from.getFullYear();
      return Math.max(0, years) + 1;
    }
    default:
      return 0;
  }
}

/**
 * balance = accrued rent - rent paid + unpaid fines  (positive => driver owes you)
 * depositHeld = sum of deposits on active rental agreements
 */
export async function computeDriverBalances(ownerId: string): Promise<DriverBalance[]> {
  const now = new Date();

  const [drivers, agreements, payments, fines] = await Promise.all([
    prisma.driver.findMany({ where: { ownerId }, orderBy: { fullName: "asc" } }),
    prisma.rentalAgreement.findMany({ where: { ownerId, status: "ACTIVE" } }),
    prisma.payment.findMany({ where: { ownerId } }),
    prisma.fine.findMany({ where: { ownerId, status: "UNPAID" } }),
  ]);

  const rentDueByDriver = new Map<string, number>();
  const depositByDriver = new Map<string, number>();
  for (const a of agreements) {
    const cap = a.endDate && a.endDate.getTime() < now.getTime() ? a.endDate : now;
    const units = periodsElapsed(a.startDate, cap, a.period);
    const due = units * a.rentAmount;
    rentDueByDriver.set(a.driverId, (rentDueByDriver.get(a.driverId) ?? 0) + due);
    depositByDriver.set(a.driverId, (depositByDriver.get(a.driverId) ?? 0) + a.depositAmount);
  }

  const rentPaidByDriver = new Map<string, number>();
  for (const p of payments) {
    if (p.type === "RENT" && p.driverId) {
      rentPaidByDriver.set(p.driverId, (rentPaidByDriver.get(p.driverId) ?? 0) + p.amount);
    }
  }

  const finesByDriver = new Map<string, number>();
  for (const f of fines) {
    if (f.driverId) {
      finesByDriver.set(f.driverId, (finesByDriver.get(f.driverId) ?? 0) + f.amount);
    }
  }

  return drivers.map((d) => {
    const rentDue = round2(rentDueByDriver.get(d.id) ?? 0);
    const rentPaid = round2(rentPaidByDriver.get(d.id) ?? 0);
    const unpaidFines = round2(finesByDriver.get(d.id) ?? 0);
    return {
      driverId: d.id,
      driverName: d.fullName,
      rentDue,
      rentPaid,
      unpaidFines,
      balance: round2(rentDue - rentPaid + unpaidFines),
      depositHeld: round2(depositByDriver.get(d.id) ?? 0),
    };
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
