import { prisma } from "../prisma.js";
import type { ReportSummary } from "@taxi/shared";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
