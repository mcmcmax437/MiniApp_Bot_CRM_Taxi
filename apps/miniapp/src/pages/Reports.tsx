import { useState } from "react";
import { List, Section, Cell, Button, Spinner } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useReport } from "../hooks";
import { Field, DateInput, formatMoney } from "../components/ui";

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

  return (
    <List>
      <Section header={`${t("reports.from")} / ${t("reports.to")}`}>
        <div style={{ padding: "0 16px" }}>
          <Field label={t("reports.from")}>
            <DateInput value={from} onChange={setFrom} />
          </Field>
          <Field label={t("reports.to")}>
            <DateInput value={to} onChange={setTo} />
          </Field>
          <Button stretched onClick={() => setApplied({ from, to })} style={{ marginTop: 8 }}>
            {t("reports.apply")}
          </Button>
        </div>
      </Section>

      {report.isLoading && (
        <Section>
          <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>
        </Section>
      )}

      {report.data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="value amount-neg">{formatMoney(report.data.income)}</div>
              <div className="label">{t("reports.income")}</div>
            </div>
            <div className="stat-card">
              <div className="value amount-pos">{formatMoney(report.data.expenses)}</div>
              <div className="label">{t("reports.expenses")}</div>
            </div>
            <div className="stat-card">
              <div className="value">{formatMoney(report.data.profit)}</div>
              <div className="label">{t("reports.profit")}</div>
            </div>
          </div>

          <Section header={t("reports.byCar")}>
            {report.data.byCar.length === 0 && <Cell>{t("common.empty")}</Cell>}
            {report.data.byCar.map((c) => (
              <Cell
                key={c.carId}
                subtitle={`${t("reports.income")}: ${formatMoney(c.income)} • ${t("reports.expenses")}: ${formatMoney(c.expenses)}`}
                after={<strong>{formatMoney(c.profit)}</strong>}
              >
                {c.label}
              </Cell>
            ))}
          </Section>

          <Section header={t("reports.byDriver")}>
            {report.data.byDriver.length === 0 && <Cell>{t("common.empty")}</Cell>}
            {report.data.byDriver.map((d) => (
              <Cell key={d.driverId} after={<strong>{formatMoney(d.income)}</strong>}>
                {d.label}
              </Cell>
            ))}
          </Section>
        </>
      )}
    </List>
  );
}
