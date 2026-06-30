import type { RentPeriod } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { DriverBalance } from "@taxi/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodLengthDays(period: RentPeriod): number {
  switch (period) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    case "MONTHLY":
      return 30;
    case "YEARLY":
      return 365;
    default:
      return 1;
  }
}

/**
 * Counts billable periods between `start` and `asOf`, prorating the first
 * partial period so a mid-period start only charges for the days actually used.
 *
 * Examples (rent = 700, period = WEEKLY):
 *   start Mon, asOf Sun         -> 1  (full 7 days)
 *   start Wed, asOf Sun         -> 1  (5 days, prorated to 5/7 of a week)
 *   start Wed, asOf next Wed    -> 2  (5 + 7)
 *   start Wed, asOf 2 weeks out -> 3  (5 + 7 + 7)
 *
 * The return value is the number of "periods" billed (the first period can be
 * fractional, e.g. 0.71 for 5/7 of a week).
 */
export function periodsElapsed(start: Date, asOf: Date, period: RentPeriod): number {
  const from = startOfDay(start);
  const to = startOfDay(asOf);
  if (to.getTime() < from.getTime()) return 0;

  const totalDays = Math.floor((to.getTime() - from.getTime()) / DAY_MS);
  const periodDays = periodLengthDays(period);
  const firstPeriodDays = Math.min(totalDays + 1, periodDays);

  if (totalDays + 1 <= periodDays) {
    return firstPeriodDays / periodDays;
  }

  const remainingDays = totalDays + 1 - periodDays;
  return 1 + remainingDays / periodDays;
}

/**
 * balance = accrued rent - rent paid - discounts + unpaid fines  (positive => driver owes you)
 * depositHeld = sum of deposits on active rental agreements
 */
export async function computeDriverBalances(ownerId: string): Promise<DriverBalance[]> {
  const now = new Date();

  const [drivers, agreements, payments, fines] = await Promise.all([
    prisma.driver.findMany({ where: { ownerId }, orderBy: { fullName: "asc" } }),
    // Pull the car id + plate alongside each active agreement so we can
    // build the driver's "active car" list for the balance response. The
    // frontend uses this to render "Driver — Plate" labels in the
    // drivers list, finance tab, and overdue-payment reminder.
    prisma.rentalAgreement.findMany({
      where: { ownerId, status: "ACTIVE" },
      include: { car: { select: { id: true, plate: true } } },
    }),
    prisma.payment.findMany({ where: { ownerId } }),
    prisma.fine.findMany({ where: { ownerId, status: "UNPAID" } }),
  ]);

  const rentDueByDriver = new Map<string, number>();
  const depositByDriver = new Map<string, number>();
  const activeCarsByDriver = new Map<string, { id: string; plate: string }[]>();
  for (const a of agreements) {
    const cap = a.endDate && a.endDate.getTime() < now.getTime() ? a.endDate : now;
    const units = periodsElapsed(a.startDate, cap, a.period);
    const due = units * a.rentAmount;
    rentDueByDriver.set(a.driverId, (rentDueByDriver.get(a.driverId) ?? 0) + due);
    depositByDriver.set(a.driverId, (depositByDriver.get(a.driverId) ?? 0) + a.depositAmount);
    if (a.car) {
      const list = activeCarsByDriver.get(a.driverId) ?? [];
      // Deduplicate by car id so a driver with two agreements for the
      // same car (rare, but possible while one is being renewed) only
      // shows the plate once.
      if (!list.some((c) => c.id === a.car!.id)) {
        list.push({ id: a.car.id, plate: a.car.plate });
      }
      activeCarsByDriver.set(a.driverId, list);
    }
  }

  const rentPaidByDriver = new Map<string, number>();
  const discountByDriver = new Map<string, number>();
  for (const p of payments) {
    if (!p.driverId) continue;
    if (p.type === "RENT") {
      rentPaidByDriver.set(p.driverId, (rentPaidByDriver.get(p.driverId) ?? 0) + p.amount);
      // Discounts recorded inline on the rent payment row (e.g. the
      // driver paid 400 of a 700 rent because the car was inactive for
      // two days — discountAmount = 300). Counts as a credit toward
      // the driver's balance, same as a separate DISCOUNT-type row.
      if (p.discountAmount && p.discountAmount > 0) {
        discountByDriver.set(
          p.driverId,
          (discountByDriver.get(p.driverId) ?? 0) + p.discountAmount,
        );
      }
    } else if (p.type === "DISCOUNT") {
      // Legacy DISCOUNT-type rows are still honoured for backwards
      // compatibility — old entries predate the inline discount field.
      discountByDriver.set(p.driverId, (discountByDriver.get(p.driverId) ?? 0) + p.amount);
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
    const discounts = round2(discountByDriver.get(d.id) ?? 0);
    const unpaidFines = round2(finesByDriver.get(d.id) ?? 0);
    return {
      driverId: d.id,
      driverName: d.fullName,
      rentDue,
      rentPaid,
      unpaidFines,
      balance: round2(rentDue - rentPaid - discounts + unpaidFines),
      depositHeld: round2(depositByDriver.get(d.id) ?? 0),
      activeCars: activeCarsByDriver.get(d.id) ?? [],
    };
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
