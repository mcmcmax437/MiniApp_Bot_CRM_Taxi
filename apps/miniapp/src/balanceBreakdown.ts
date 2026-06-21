import { AgreementStatus, type RentPeriod } from "@taxi/shared";
import type { Agreement, Fine, Payment } from "./types";

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
 * Mirrors the formula in apps/api/src/services/balance.ts.
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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface AgreementAccrual {
  agreementId: string;
  carPlate: string;
  carLabel: string;
  period: RentPeriod;
  rentAmount: number;
  startDate: Date;
  endDate: Date | null;
  daysElapsed: number;
  periods: number;
  accrued: number;
}

export interface PaymentLine {
  id: string;
  date: Date;
  type: "RENT" | "DISCOUNT" | "DEPOSIT" | "REFUND" | "FINE" | string;
  amount: number;
  note: string | null;
  carPlate: string | null;
  method: string | null;
}

export interface FineLine {
  id: string;
  date: Date;
  amount: number;
  description: string | null;
}

export interface DriverBalanceBreakdown {
  driverId: string;
  driverName: string;
  asOf: Date;
  activeAccruals: AgreementAccrual[];
  rentDue: number;
  rentPayments: PaymentLine[];
  discountPayments: PaymentLine[];
  depositPayments: PaymentLine[];
  refundPayments: PaymentLine[];
  rentPaid: number;
  discounts: number;
  unpaidFines: FineLine[];
  unpaidFinesTotal: number;
  depositHeld: number;
  balance: number;
}

export function buildDriverBalanceBreakdown(args: {
  driverId: string;
  driverName: string;
  agreements: Agreement[];
  payments: Payment[];
  fines: Fine[];
  asOf?: Date;
}): DriverBalanceBreakdown {
  const asOf = args.asOf ?? new Date();
  const myAgreements = args.agreements.filter((a) => a.driverId === args.driverId);

  const activeAccruals: AgreementAccrual[] = [];
  let rentDue = 0;
  let depositHeld = 0;
  for (const a of myAgreements) {
    if (a.status !== AgreementStatus.ACTIVE) continue;
    const start = new Date(a.startDate);
    const explicitEnd = a.endDate ? new Date(a.endDate) : null;
    const cap = explicitEnd && explicitEnd.getTime() < asOf.getTime() ? explicitEnd : asOf;
    const periods = periodsElapsed(start, cap, a.period);
    const accrued = periods * a.rentAmount;
    rentDue += accrued;
    depositHeld += a.depositAmount;
    const daysElapsed = Math.max(
      0,
      Math.floor((startOfDay(cap).getTime() - startOfDay(start).getTime()) / DAY_MS) + 1,
    );
    activeAccruals.push({
      agreementId: a.id,
      carPlate: a.car?.plate ?? "—",
      carLabel: a.car?.plate ?? "—",
      period: a.period,
      rentAmount: a.rentAmount,
      startDate: start,
      endDate: explicitEnd,
      daysElapsed,
      periods,
      accrued,
    });
  }

  const myPayments = args.payments.filter((p) => p.driverId === args.driverId);
  const rentPayments: PaymentLine[] = [];
  const discountPayments: PaymentLine[] = [];
  const depositPayments: PaymentLine[] = [];
  const refundPayments: PaymentLine[] = [];
  let rentPaid = 0;
  let discounts = 0;
  for (const p of myPayments) {
    const line: PaymentLine = {
      id: p.id,
      date: new Date(p.date),
      type: p.type,
      amount: p.amount,
      note: p.note ?? null,
      carPlate: p.car?.plate ?? null,
      method: p.method ?? null,
    };
    if (p.type === "RENT") {
      rentPayments.push(line);
      rentPaid += p.amount;
      // Inline discount on a RENT payment (preferred flow). Each rent
      // payment can carry its own `discountAmount` so the owner only
      // enters one record per cash event — the discounted amount they
      // actually received and the credit they applied to the driver.
      if (p.discountAmount && p.discountAmount > 0) {
        discountPayments.push({
          ...line,
          // The amount shown in the discounts list is the discount,
          // not the rent paid.
          amount: p.discountAmount,
        });
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
  rentPayments.sort((a, b) => b.date.getTime() - a.date.getTime());
  discountPayments.sort((a, b) => b.date.getTime() - a.date.getTime());

  const unpaidFines: FineLine[] = [];
  let unpaidFinesTotal = 0;
  for (const f of args.fines) {
    if (f.driverId !== args.driverId) continue;
    if (f.status !== "UNPAID") continue;
    unpaidFines.push({
      id: f.id,
      date: new Date(f.date),
      amount: f.amount,
      description: f.description ?? null,
    });
    unpaidFinesTotal += f.amount;
  }
  unpaidFines.sort((a, b) => b.date.getTime() - a.date.getTime());

  const balance = rentDue - rentPaid - discounts + unpaidFinesTotal;

  return {
    driverId: args.driverId,
    driverName: args.driverName,
    asOf,
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
