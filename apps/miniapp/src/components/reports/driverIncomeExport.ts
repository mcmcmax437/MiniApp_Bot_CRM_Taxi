import type { DriverIncomeReport } from "@taxi/shared";

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function filterDriverIncomeByMonths(
  report: DriverIncomeReport,
  selectedMonths: Set<string>,
): DriverIncomeReport | null {
  if (selectedMonths.size === 0) return null;
  const months = report.months.filter((m) => selectedMonths.has(m.month));
  if (months.length === 0) return null;

  let grandCash = 0;
  let grandBank = 0;
  for (const m of months) {
    grandCash += m.totals.cash;
    grandBank += m.totals.bank;
  }
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  return {
    ...report,
    months,
    grandTotals: {
      cash: round2(grandCash),
      bank: round2(grandBank),
      total: round2(grandCash + grandBank),
    },
  };
}

export function buildDriverIncomeCsv(
  report: DriverIncomeReport,
  labels: {
    month: string;
    driver: string;
    pesel: string;
    passport: string;
    address: string;
    cash: string;
    bank: string;
    total: string;
    monthTotal: string;
    grandTotal: string;
    unassignedDriver: string;
    driverLabel: (name: string, id: string) => string;
    monthLabel: (monthKey: string) => string;
  },
): string {
  const lines: string[] = [];
  const sep = ";";

  lines.push(
    [
      labels.month,
      labels.driver,
      labels.pesel,
      labels.passport,
      labels.address,
      labels.cash,
      labels.bank,
      labels.total,
    ]
      .map(csvEscape)
      .join(sep),
  );

  for (const section of report.months) {
    for (const row of section.drivers) {
      const pesel = row.pesel?.trim() ?? "";
      const passport = row.pesel?.trim() ? "" : (row.passportNumber?.trim() ?? "");
      lines.push(
        [
          labels.monthLabel(section.month),
          labels.driverLabel(row.driverName, row.driverId),
          pesel,
          passport,
          row.address,
          fmtAmount(row.cash),
          fmtAmount(row.bank),
          fmtAmount(row.total),
        ]
          .map(csvEscape)
          .join(sep),
      );
    }
    lines.push(
      [
        labels.monthLabel(section.month),
        labels.monthTotal,
        "",
        "",
        "",
        fmtAmount(section.totals.cash),
        fmtAmount(section.totals.bank),
        fmtAmount(section.totals.total),
      ]
        .map(csvEscape)
        .join(sep),
    );
    lines.push("");
  }

  lines.push(
    [
      labels.grandTotal,
      "",
      "",
      "",
      "",
      fmtAmount(report.grandTotals.cash),
      fmtAmount(report.grandTotals.bank),
      fmtAmount(report.grandTotals.total),
    ]
      .map(csvEscape)
      .join(sep),
  );

  return lines.join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** YYYY-MM for `months` ago from today (0 = current month). */
export function monthKeyMonthsAgo(months: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function localDateKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function monthKeyToFromDate(monthKey: string): string {
  return `${monthKey}-01`;
}

export function monthKeyToToDate(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  const today = new Date();
  if (monthKey >= currentMonthKey()) return localDateKey(today);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(lastDay).padStart(2, "0")}`;
}
