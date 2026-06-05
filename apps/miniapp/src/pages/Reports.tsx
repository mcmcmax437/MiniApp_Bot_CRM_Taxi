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

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [applied, setApplied] = useState({ from: firstOfMonth(), to: today() });
  const report = useReport(applied.from, applied.to);

  const income = report.data ? formatMoney(report.data.income) : formatMoney(0);
  const expenses = report.data ? formatMoney(report.data.expenses) : formatMoney(0);
  const profit = report.data ? formatMoney(report.data.profit) : formatMoney(0);

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
    </div>
  );
}
