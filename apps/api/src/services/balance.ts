import type { RentPeriod } from "@prisma/client";
import { prisma } from "../prisma.js";
import type {
  DriverBalance,
  DriverBalanceAccrual,
  DriverBalanceBreakdown,
  DriverBalanceFineLine,
  DriverBalancePaymentLine,
} from "@taxi/shared";

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
    if (!a.driverId) continue;
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

/**
 * Computes the per-driver breakdown for a single driver. Same data as
 * `computeDriverBalances` (single source of truth) but with the full
 * accrual/payment/fine lines that the Driver Balance Breakdown modal
 * renders, plus the individual `rentDue`, `rentPaid`, `discounts`, and
 * `unpaidFines` totals so the modal can show the formula in plain text.
 *
 * Returns `null` if the driver does not belong to this owner.
 */
export async function computeDriverBalanceBreakdown(
  ownerId: string,
  driverId: string,
  asOf: Date = new Date(),
): Promise<DriverBalanceBreakdown | null> {
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, ownerId },
  });
  if (!driver) return null;

  // We need every agreement that contributes to the balance. Active
  // agreements still accrue rent; ended agreements don't. Deposit held
  // in the breakdown should mirror `/balances`, so we only include
  // deposits from ACTIVE agreements here as well.
  const [agreements, payments, fines] = await Promise.all([
    prisma.rentalAgreement.findMany({
      where: { ownerId, driverId },
      include: { car: { select: { id: true, plate: true } } },
      orderBy: { startDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { ownerId, driverId },
      include: { car: { select: { id: true, plate: true } } },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }],
    }),
    prisma.fine.findMany({
      where: { ownerId, driverId, status: "UNPAID" },
      orderBy: { date: "desc" },
    }),
  ]);

  const activeAccruals: DriverBalanceAccrual[] = [];
  let rentDue = 0;
  let depositHeld = 0;
  for (const a of agreements) {
    // Only ACTIVE agreements accrue rent. ENDED agreements stop
    // accruing past their endDate (which the server stored already),
    // so we mirror the /balances math exactly.
    if (a.status === "ACTIVE") {
      const start = a.startDate;
      const explicitEnd = a.endDate;
      const cap =
        explicitEnd && explicitEnd.getTime() < asOf.getTime() ? explicitEnd : asOf;
      const periods = periodsElapsed(start, cap, a.period);
      const accrued = periods * a.rentAmount;
      rentDue += accrued;

      const daysElapsed = Math.max(
        0,
        Math.floor((startOfDay(cap).getTime() - startOfDay(start).getTime()) / DAY_MS) + 1,
      );
      const plate = a.car?.plate ?? "—";
      activeAccruals.push({
        agreementId: a.id,
        carPlate: plate,
        carLabel: plate,
        period: a.period,
        rentAmount: a.rentAmount,
        startDate: start.toISOString(),
        endDate: explicitEnd ? explicitEnd.toISOString() : null,
        daysElapsed,
        periods,
        accrued,
      });
    }
    if (a.status === "ACTIVE") {
      depositHeld += a.depositAmount;
    }
  }
  activeAccruals.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const rentPayments: DriverBalancePaymentLine[] = [];
  const discountPayments: DriverBalancePaymentLine[] = [];
  const depositPayments: DriverBalancePaymentLine[] = [];
  const refundPayments: DriverBalancePaymentLine[] = [];
  let rentPaid = 0;
  let discounts = 0;
  for (const p of payments) {
    // Strip out payments for other drivers — even though we filtered
    // by driverId above, defensive in case the schema changes.
    if (p.driverId !== driverId) continue;
    const line: DriverBalancePaymentLine = {
      id: p.id,
      date: p.date instanceof Date ? p.date.toISOString() : String(p.date),
      type: String(p.type),
      amount: p.amount,
      note: p.note ?? null,
      carPlate: p.car?.plate ?? null,
      method: p.method ?? null,
    };
    if (p.type === "RENT") {
      rentPayments.push(line);
      rentPaid += p.amount;
      // Inline discount on the same rent payment row (preferred flow).
      if (p.discountAmount && p.discountAmount > 0) {
        discountPayments.push({ ...line, amount: p.discountAmount });
        discounts += p.discountAmount;
      }
    } else if (p.type === "DISCOUNT") {
      // Legacy DISCOUNT-type rows are still rendered for backwards
      // compatibility — older payments predate the inline field.
      discountPayments.push(line);
      discounts += p.amount;
    } else if (p.type === "DEPOSIT") {
      depositPayments.push(line);
    } else if (p.type === "REFUND") {
      refundPayments.push(line);
    }
  }

  const unpaidFines: DriverBalanceFineLine[] = [];
  let unpaidFinesTotal = 0;
  for (const f of fines) {
    if (f.driverId !== driverId) continue;
    unpaidFines.push({
      id: f.id,
      date: f.date instanceof Date ? f.date.toISOString() : String(f.date),
      amount: f.amount,
      description: f.description ?? null,
    });
    unpaidFinesTotal += f.amount;
  }

  const balance = rentDue - rentPaid - discounts + unpaidFinesTotal;

  return {
    driverId,
    driverName: driver.fullName,
    asOf: asOf.toISOString(),
    activeAccruals,
    rentDue: round2(rentDue),
    rentPayments,
    discountPayments,
    depositPayments,
    refundPayments,
    rentPaid: round2(rentPaid),
    discounts: round2(discounts),
    unpaidFines,
    unpaidFinesTotal: round2(unpaidFinesTotal),
    depositHeld: round2(depositHeld),
    balance: round2(balance),
  };
}
