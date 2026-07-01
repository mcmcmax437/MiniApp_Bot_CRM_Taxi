import type { PartnerSettlementReport } from "@taxi/shared";

function fmtAmount(n: number): string {
  return n.toFixed(2);
}

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function filterPartnerSettlementByMonths(
  report: PartnerSettlementReport,
  selectedMonths: Set<string>,
): PartnerSettlementReport | null {
  if (selectedMonths.size === 0) return null;
  const months = report.months.filter((m) => selectedMonths.has(m.month));
  if (months.length === 0) return null;

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  let partnerOwesYou = 0;
  let youOwePartner = 0;
  let partnerOwesYouUnsettled = 0;
  let youOwePartnerUnsettled = 0;
  for (const m of months) {
    partnerOwesYou += m.partnerOwesYou;
    youOwePartner += m.youOwePartner;
    partnerOwesYouUnsettled += m.partnerOwesYouUnsettled;
    youOwePartnerUnsettled += m.youOwePartnerUnsettled;
  }

  return {
    ...report,
    months,
    totals: {
      partnerOwesYou: round2(partnerOwesYou),
      youOwePartner: round2(youOwePartner),
      netBalance: round2(partnerOwesYou - youOwePartner),
      partnerOwesYouUnsettled: round2(partnerOwesYouUnsettled),
      youOwePartnerUnsettled: round2(youOwePartnerUnsettled),
    },
  };
}

export function buildPartnerSettlementCsv(
  report: PartnerSettlementReport,
  labels: {
    month: string;
    type: string;
    date: string;
    description: string;
    amount: string;
    settled: string;
    partnerOwesYou: string;
    youOwePartner: string;
    netBalance: string;
    payment: string;
    expense: string;
    yes: string;
    no: string;
    grandTotal: string;
    monthLabel: (monthKey: string) => string;
    formatDate: (iso: string) => string;
  },
): string {
  const sep = ";";
  const lines: string[] = [];

  lines.push(
  [labels.month, labels.partnerOwesYou, labels.youOwePartner, labels.netBalance]
    .map(csvEscape)
    .join(sep),
  );

  for (const section of report.months) {
    lines.push(
      [
        labels.monthLabel(section.month),
        fmtAmount(section.partnerOwesYou),
        fmtAmount(section.youOwePartner),
        fmtAmount(section.netBalance),
      ]
        .map(csvEscape)
        .join(sep),
    );
    for (const p of section.payments) {
      lines.push(
        [
          "",
          labels.payment,
          labels.formatDate(p.date),
          p.description,
          fmtAmount(p.amount),
          p.settled ? labels.yes : labels.no,
        ]
          .map(csvEscape)
          .join(sep),
      );
    }
    for (const e of section.expenses) {
      lines.push(
        [
          "",
          labels.expense,
          labels.formatDate(e.date),
          e.description,
          fmtAmount(e.amount),
          e.settled ? labels.yes : labels.no,
        ]
          .map(csvEscape)
          .join(sep),
      );
    }
    lines.push("");
  }

  lines.push(
    [
      labels.grandTotal,
      fmtAmount(report.totals.partnerOwesYou),
      fmtAmount(report.totals.youOwePartner),
      fmtAmount(report.totals.netBalance),
    ]
      .map(csvEscape)
      .join(sep),
  );

  return lines.join("\r\n");
}
