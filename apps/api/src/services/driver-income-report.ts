import type { DriverIncomeReport } from "@taxi/shared";

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
