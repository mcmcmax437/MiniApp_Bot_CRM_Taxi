import { prisma } from "../prisma.js";
import type {
  DriverIncomeMonthDriverRow,
  DriverIncomeReport,
  PartnerSettlementLine,
  PartnerSettlementMonth,
  PartnerSettlementReport,
  ReportSummary,
} from "@taxi/shared";

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

function formatDriverAddress(d: {
  addressCity: string | null;
  addressPostalCode: string | null;
  addressStreet: string | null;
  addressHouse: string | null;
  addressFlat: string | null;
}): string {
  return [d.addressCity, d.addressPostalCode, d.addressStreet, d.addressHouse, d.addressFlat]
    .filter((part) => part && part.trim())
    .join(", ");
}

function driverIdDocument(d: {
  pesel: string | null;
  passportNumber: string | null;
}): string {
  const pesel = d.pesel?.trim();
  if (pesel) return pesel;
  return d.passportNumber?.trim() ?? "";
}

type DriverProfile = {
  id: string;
  fullName: string;
  pesel: string | null;
  passportNumber: string | null;
  addressCity: string | null;
  addressPostalCode: string | null;
  addressStreet: string | null;
  addressHouse: string | null;
  addressFlat: string | null;
};

function driverRowMeta(
  driverId: string,
  profiles: Map<string, DriverProfile>,
): Pick<DriverIncomeMonthDriverRow, "driverName" | "pesel" | "passportNumber" | "idDocument" | "address"> {
  if (driverId === UNASSIGNED_DRIVER_ID) {
    return {
      driverName: "",
      pesel: null,
      passportNumber: null,
      idDocument: "",
      address: "",
    };
  }
  const d = profiles.get(driverId);
  if (!d) {
    return {
      driverName: "",
      pesel: null,
      passportNumber: null,
      idDocument: "",
      address: "",
    };
  }
  return {
    driverName: d.fullName,
    pesel: d.pesel,
    passportNumber: d.passportNumber,
    idDocument: driverIdDocument(d),
    address: formatDriverAddress(d),
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
      select: {
        id: true,
        fullName: true,
        pesel: true,
        passportNumber: true,
        addressCity: true,
        addressPostalCode: true,
        addressStreet: true,
        addressHouse: true,
        addressFlat: true,
      },
    }),
  ]);

  const driverProfiles = new Map(drivers.map((d) => [d.id, d] as const));

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
        const meta = driverRowMeta(driverId, driverProfiles);
        return {
          driverId,
          ...meta,
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

function expenseDescription(e: {
  category: string;
  tag: string | null;
  note: string | null;
  carId: string | null;
}, carLabel: Map<string, string>): string {
  const parts = [
    e.tag?.trim(),
    e.note?.trim(),
    e.carId ? carLabel.get(e.carId) : null,
    e.category,
  ].filter((p) => p && String(p).trim());
  return parts.join(" · ") || "—";
}

/**
 * Partner settlement by calendar month: payments the partner collected and
 * expenses they paid on the owner's behalf, with net balance per month.
 */
export async function buildPartnerSettlementReport(
  ownerId: string,
  from: Date,
  to: Date,
): Promise<PartnerSettlementReport> {
  const [payments, expenses, drivers, cars] = await Promise.all([
    prisma.payment.findMany({
      where: {
        ownerId,
        date: { gte: from, lte: to },
        receivedByPartner: true,
      },
      select: {
        id: true,
        amount: true,
        date: true,
        partnerSettled: true,
        driverId: true,
        type: true,
        note: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        ownerId,
        date: { gte: from, lte: to },
        paidByPartner: true,
      },
      select: {
        id: true,
        amount: true,
        date: true,
        partnerSettled: true,
        category: true,
        tag: true,
        note: true,
        carId: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.driver.findMany({ where: { ownerId }, select: { id: true, fullName: true } }),
    prisma.car.findMany({
      where: { ownerId },
      select: { id: true, plate: true, make: true, model: true },
    }),
  ]);

  const driverLabel = new Map(drivers.map((d) => [d.id, d.fullName] as const));
  const carLabel = new Map<string, string>();
  for (const c of cars) {
    carLabel.set(c.id, [c.plate, [c.make, c.model].filter(Boolean).join(" ")].filter(Boolean).join(" - "));
  }

  type MonthAcc = {
    payments: PartnerSettlementLine[];
    expenses: PartnerSettlementLine[];
  };
  const byMonth = new Map<string, MonthAcc>();

  function monthBucket(key: string): MonthAcc {
    let b = byMonth.get(key);
    if (!b) {
      b = { payments: [], expenses: [] };
      byMonth.set(key, b);
    }
    return b;
  }

  for (const p of payments) {
    const key = monthKeyFromDate(p.date);
    const driver = p.driverId ? driverLabel.get(p.driverId) : null;
    const desc = [driver, p.note?.trim()].filter(Boolean).join(" — ") || p.type;
    monthBucket(key).payments.push({
      id: p.id,
      date: p.date.toISOString(),
      amount: round2(p.amount),
      description: desc,
      settled: p.partnerSettled,
    });
  }

  for (const e of expenses) {
    const key = monthKeyFromDate(e.date);
    monthBucket(key).expenses.push({
      id: e.id,
      date: e.date.toISOString(),
      amount: round2(e.amount),
      description: expenseDescription(e, carLabel),
      settled: e.partnerSettled,
    });
  }

  const months: PartnerSettlementMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => {
      const partnerCollectedTotal = round2(bucket.payments.reduce((s, l) => s + l.amount, 0));
      const partnerExpensesTotal = round2(bucket.expenses.reduce((s, l) => s + l.amount, 0));
      const partnerOwesYou = round2(
        bucket.payments.filter((l) => !l.settled).reduce((s, l) => s + l.amount, 0),
      );
      const youOwePartner = round2(
        bucket.expenses.filter((l) => !l.settled).reduce((s, l) => s + l.amount, 0),
      );
      return {
        month,
        partnerOwesYou,
        youOwePartner,
        netBalance: round2(partnerOwesYou - youOwePartner),
        partnerCollectedTotal,
        partnerExpensesTotal,
        payments: bucket.payments,
        expenses: bucket.expenses,
      };
    });

  let tPartnerOwes = 0;
  let tYouOwe = 0;
  let tCollected = 0;
  let tExpenses = 0;
  for (const m of months) {
    tPartnerOwes += m.partnerOwesYou;
    tYouOwe += m.youOwePartner;
    tCollected += m.partnerCollectedTotal;
    tExpenses += m.partnerExpensesTotal;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    months,
    totals: {
      partnerOwesYou: round2(tPartnerOwes),
      youOwePartner: round2(tYouOwe),
      netBalance: round2(tPartnerOwes - tYouOwe),
      partnerCollectedTotal: round2(tCollected),
      partnerExpensesTotal: round2(tExpenses),
    },
  };
}
