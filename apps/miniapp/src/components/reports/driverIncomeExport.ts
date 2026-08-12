import type { DriverIncomeReport } from "@taxi/shared";

export type AccountantMoneyChannel = "both" | "cash" | "bank";

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function amountForChannel(
  row: { cash: number; bank: number; total: number },
  channel: AccountantMoneyChannel,
): number {
  if (channel === "cash") return row.cash;
  if (channel === "bank") return row.bank;
  return row.total;
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
  channel: AccountantMoneyChannel = "both",
): string {
  const lines: string[] = [];
  const sep = ";";
  const showCash = channel === "both" || channel === "cash";
  const showBank = channel === "both" || channel === "bank";
  const showTotal = channel === "both";

  const header = [
    labels.month,
    labels.driver,
    labels.pesel,
    labels.passport,
    labels.address,
    ...(showCash ? [labels.cash] : []),
    ...(showBank ? [labels.bank] : []),
    ...(showTotal ? [labels.total] : []),
  ];
  lines.push(header.map(csvEscape).join(sep));

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
          ...(showCash ? [fmtAmount(row.cash)] : []),
          ...(showBank ? [fmtAmount(row.bank)] : []),
          ...(showTotal ? [fmtAmount(row.total)] : []),
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
        ...(showCash ? [fmtAmount(section.totals.cash)] : []),
        ...(showBank ? [fmtAmount(section.totals.bank)] : []),
        ...(showTotal ? [fmtAmount(section.totals.total)] : []),
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
      ...(showCash ? [fmtAmount(report.grandTotals.cash)] : []),
      ...(showBank ? [fmtAmount(report.grandTotals.bank)] : []),
      ...(showTotal ? [fmtAmount(report.grandTotals.total)] : []),
    ]
      .map(csvEscape)
      .join(sep),
  );

  return lines.join("\r\n");
}

/**
 * Plain-text email body for the accountant: greeting, month close, driver
 * lines (name / PESEL or passport / address = amount), signature.
 */
export function buildAccountantEmailText(
  report: DriverIncomeReport,
  opts: {
    channel: AccountantMoneyChannel;
    monthLabel: (monthKey: string) => string;
    driverLabel: (name: string, id: string) => string;
    formatAmount: (n: number) => string;
    template: {
      greeting: string;
      intro: string; // contains {{month}}
      driversHeading: string;
      thanks: string;
      signature: string;
    };
  },
): string {
  const months = report.months.map((m) => opts.monthLabel(m.month));
  const monthText = months.join(", ");
  const driverLines: string[] = [];

  for (const section of report.months) {
    for (const row of section.drivers) {
      const amount = amountForChannel(row, opts.channel);
      if (amount === 0) continue;
      const name = opts.driverLabel(row.driverName, row.driverId);
      const idDoc = row.pesel?.trim() || row.passportNumber?.trim() || "—";
      const address = row.address?.trim() || "—";
      const prefix = report.months.length > 1 ? `[${opts.monthLabel(section.month)}] ` : "";
      driverLines.push(
        `${prefix}---- ${name} ${idDoc} ${address} ---- = ${opts.formatAmount(amount)}`,
      );
    }
  }

  const intro = opts.template.intro.replace("{{month}}", monthText);
  return [
    opts.template.greeting,
    intro,
    opts.template.driversHeading,
    ...(driverLines.length > 0 ? driverLines : ["—"]),
    "",
    opts.template.thanks,
    opts.template.signature,
  ].join("\n");
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

export function monthKeyToFromDate(monthKey: string): string {
  return `${monthKey}-01`;
}

export function monthKeyToToDate(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const last = new Date(y, m, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const cap = last.getTime() > today.getTime() ? today : last;
  return cap.toISOString().slice(0, 10);
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function yearToFromDate(year: number): string {
  return `${year}-01-01`;
}

export function yearToToDate(year: number): string {
  const now = new Date();
  if (year < now.getFullYear()) return `${year}-12-31`;
  if (year > now.getFullYear()) return `${year}-01-01`;
  return monthKeyToToDate(currentMonthKey());
}

/** Years from `firstYear` through the current year, newest first. */
export function selectableYears(firstYear = 2020): number[] {
  const end = currentYear();
  const years: number[] = [];
  for (let y = end; y >= firstYear; y--) years.push(y);
  return years;
}
