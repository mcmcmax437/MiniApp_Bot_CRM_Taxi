import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReport } from "../hooks";
import { formatMoney } from "../components/ui";
import { AppHeader } from "../components/crm";
import {
  ReportFiltersCard,
  ReportSummaryCard,
  ReportSectionCard,
} from "../components/reports/ReportSections";
import { DriverIncomeReportCard } from "../components/reports/DriverIncomeReportCard";

function firstOfMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(firstOfMonthsAgo(5));
  const [to, setTo] = useState(today());
  const [applied, setApplied] = useState({ from: firstOfMonthsAgo(5), to: today() });
  const report = useReport(applied.from, applied.to);

  const income = report.data ? formatMoney(report.data.income) : formatMoney(0);
  const expenses = report.data ? formatMoney(report.data.expenses) : formatMoney(0);
  const profit = report.data ? formatMoney(report.data.profit) : formatMoney(0);

  function applyRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setApplied({ from: nextFrom, to: nextTo });
  }

  return (
    <div className="crm-page crm-page--reports">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <ReportFiltersCard
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => setApplied({ from, to })}
        applying={report.isFetching}
        onPreset={(months) => applyRange(firstOfMonthsAgo(months), today())}
      />

      <ReportSummaryCard income={income} expenses={expenses} profit={profit} loading={report.isLoading} />

      <ReportSectionCard
        title={t("reports.byCar")}
        subtitle={t("reports.byCarSubtitle")}
        tone="car"
        carRows={report.data?.byCar}
        loading={report.isLoading}
      />

      <ReportSectionCard
        title={t("reports.byDriver")}
        subtitle={t("reports.byDriverSubtitle")}
        tone="driver"
        driverRows={report.data?.byDriver}
        loading={report.isLoading}
      />

      <DriverIncomeReportCard />
    </div>
  );
}
