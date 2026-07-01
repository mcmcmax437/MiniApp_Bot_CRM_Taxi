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

export function buildDriverIncomeCsv(
  report: DriverIncomeReport,
  labels: {
    month: string;
    driver: string;
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
    [labels.month, labels.driver, labels.cash, labels.bank, labels.total]
      .map(csvEscape)
      .join(sep),
  );

  for (const section of report.months) {
    for (const row of section.drivers) {
      lines.push(
        [
          labels.monthLabel(section.month),
          labels.driverLabel(row.driverName, row.driverId),
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
