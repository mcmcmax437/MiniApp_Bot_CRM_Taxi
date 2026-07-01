import { prisma } from "../prisma.js";
import type { DriverIncomeReport, ReportSummary } from "@taxi/shared";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calendar month key (YYYY-MM) in UTC — payment dates are stored at noon UTC. */
function monthKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const UNASSIGNED_DRIVER_ID = "";

interface DriverIncomePaymentRow {
  driverId: string | null;
  amount: number;
  method: string;
  date: Date;
}

interface DriverIncomeDriverRow {
  id: string;
  fullName: string;
}

export function buildDriverIncomeReportFromRows(
  payments: DriverIncomePaymentRow[],
  drivers: DriverIncomeDriverRow[],
  from: Date,
  to: Date,
): DriverIncomeReport {
  const driverNames = new Map(drivers.map((d) => [d.id, d.fullName] as const));

  type Cell = { cash: number; bank: number };
  const grid = new Map<string, Map<string, Cell>>();

  function cell(month: string, driverId: string): Cell {
    let byDriver = grid.get(month);
    if (!byDriver) {
      byDriver = new Map();
      grid.set(month, byDriver);
    }
    let c = byDriver.get(driverId);
    if (!c) {
      c = { cash: 0, bank: 0 };
      byDriver.set(driverId, c);
    }
    return c;
  }

  for (const p of payments) {
    const month = monthKeyFromDate(p.date);
    const driverId = p.driverId ?? UNASSIGNED_DRIVER_ID;
    const c = cell(month, driverId);
    if (p.method === "CASH") {
      c.cash += p.amount;
    } else {
      c.bank += p.amount;
    }
  }

  const months = [...grid.keys()].sort((a, b) => b.localeCompare(a));
  let grandCash = 0;
  let grandBank = 0;

  const sections = months.map((month) => {
    const byDriver = grid.get(month)!;
    const driverRows = [...byDriver.entries()]
      .map(([driverId, c]) => {
        const cash = round2(c.cash);
        const bank = round2(c.bank);
        return {
          driverId,
          driverName:
            driverId === UNASSIGNED_DRIVER_ID
              ? ""
              : (driverNames.get(driverId) ?? ""),
          cash,
          bank,
          total: round2(cash + bank),
        };
      })
      .sort((a, b) => b.total - a.total || a.driverName.localeCompare(b.driverName));

    const totals = driverRows.reduce(
      (acc, row) => ({
        cash: round2(acc.cash + row.cash),
        bank: round2(acc.bank + row.bank),
        total: round2(acc.total + row.total),
      }),
      { cash: 0, bank: 0, total: 0 },
    );

    grandCash = round2(grandCash + totals.cash);
    grandBank = round2(grandBank + totals.bank);

    return { month, drivers: driverRows, totals };
  });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    months: sections,
    grandTotals: {
      cash: grandCash,
      bank: grandBank,
      total: round2(grandCash + grandBank),
    },
  };
}

/**
 * Rent + fine income per driver per calendar month, split cash vs bank.
 * Intended for accountant exports on the Reports page.
 */
export async function buildDriverIncomeReport(
  ownerId: string,
  from: Date,
  to: Date,
): Promise<DriverIncomeReport> {
  const [payments, drivers] = await Promise.all([
    prisma.payment.findMany({
      where: {
        ownerId,
        date: { gte: from, lte: to },
        type: { in: ["RENT", "FINE"] },
      },
      select: {
        driverId: true,
        amount: true,
        method: true,
        date: true,
      },
    }),
    prisma.driver.findMany({
      where: { ownerId },
      select: { id: true, fullName: true },
    }),
  ]);

  return buildDriverIncomeReportFromRows(payments, drivers, from, to);
}

export async function buildReportSummary(
  ownerId: string,
  from: Date,
  to: Date,
): Promise<ReportSummary> {
  const [payments, expenses, cars, drivers, unsettledPayments, unsettledExpenses] = await Promise.all([
    prisma.payment.findMany({
      where: { ownerId, date: { gte: from, lte: to }, type: { in: ["RENT", "FINE"] } },
    }),
    prisma.expense.findMany({ where: { ownerId, date: { gte: from, lte: to } } }),
    prisma.car.findMany({ where: { ownerId } }),
    prisma.driver.findMany({ where: { ownerId } }),
    prisma.payment.findMany({
      where: { ownerId, receivedByPartner: true, partnerSettled: false },
      select: { amount: true },
    }),
    prisma.expense.findMany({
      where: { ownerId, paidByPartner: true, partnerSettled: false },
      select: { amount: true },
    }),
  ]);

  const carLabel = new Map<string, string>();
  for (const c of cars) {
    carLabel.set(c.id, [c.plate, [c.make, c.model].filter(Boolean).join(" ")].filter(Boolean).join(" - "));
  }
  const driverLabel = new Map(drivers.map((d) => [d.id, d.fullName] as const));

  const incomeByCar = new Map<string, number>();
  const incomeByDriver = new Map<string, number>();
  let income = 0;
  for (const p of payments) {
    income += p.amount;
    if (p.carId) incomeByCar.set(p.carId, (incomeByCar.get(p.carId) ?? 0) + p.amount);
    if (p.driverId) {
      incomeByDriver.set(p.driverId, (incomeByDriver.get(p.driverId) ?? 0) + p.amount);
    }
  }

  const expenseByCar = new Map<string, number>();
  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += e.amount;
    if (e.carId) expenseByCar.set(e.carId, (expenseByCar.get(e.carId) ?? 0) + e.amount);
  }

  const carIds = new Set<string>([...incomeByCar.keys(), ...expenseByCar.keys()]);
  const byCar = [...carIds].map((carId) => {
    const inc = round2(incomeByCar.get(carId) ?? 0);
    const exp = round2(expenseByCar.get(carId) ?? 0);
    return {
      carId,
      label: carLabel.get(carId) ?? "—",
      income: inc,
      expenses: exp,
      profit: round2(inc - exp),
    };
  });
  byCar.sort((a, b) => b.profit - a.profit);

  const byDriver = [...incomeByDriver.entries()].map(([driverId, inc]) => ({
    driverId,
    label: driverLabel.get(driverId) ?? "—",
    income: round2(inc),
  }));
  byDriver.sort((a, b) => b.income - a.income);

  const profit = round2(income - expenseTotal);
  let totalInvestment = 0;
  for (const c of cars) {
    if (c.purchasePrice != null && c.purchasePrice > 0) {
      totalInvestment += c.purchasePrice;
    }
  }
  totalInvestment = round2(totalInvestment);
  const roiPercent =
    totalInvestment > 0 ? round2((profit / totalInvestment) * 100) : null;

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    income: round2(income),
    expenses: round2(expenseTotal),
    profit,
    totalInvestment,
    roiPercent,
    byCar,
    byDriver,
    partnerUnsettled: {
      paymentsUnsettled: round2(unsettledPayments.reduce((s, p) => s + p.amount, 0)),
      paymentsUnsettledCount: unsettledPayments.length,
      expensesUnsettled: round2(unsettledExpenses.reduce((s, e) => s + e.amount, 0)),
      expensesUnsettledCount: unsettledExpenses.length,
    },
  };
}
