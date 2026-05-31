import { List, Section, Cell, Spinner, Banner } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useBalances, useReminders, useReport, useSetLocale } from "../hooks";
import { formatMoney, formatDate, SelectInput } from "../components/ui";
import { ImportSection } from "../components/ImportSection";
import i18n from "../i18n";

export function Dashboard() {
  const { t } = useTranslation();
  const report = useReport();
  const reminders = useReminders();
  const balances = useBalances();
  const setLocale = useSetLocale();

  const owing = (balances.data ?? []).filter((b) => b.balance > 0.005);

  return (
    <List>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="value amount-neg">{report.data ? formatMoney(report.data.income) : "—"}</div>
          <div className="label">{t("dashboard.monthIncome")}</div>
        </div>
        <div className="stat-card">
          <div className="value amount-pos">{report.data ? formatMoney(report.data.expenses) : "—"}</div>
          <div className="label">{t("dashboard.monthExpenses")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{report.data ? formatMoney(report.data.profit) : "—"}</div>
          <div className="label">{t("dashboard.monthProfit")}</div>
        </div>
      </div>

      <Section header={t("dashboard.reminders")}>
        {reminders.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {reminders.data && reminders.data.length === 0 && (
          <Cell>{t("dashboard.noReminders")}</Cell>
        )}
        {reminders.data?.slice(0, 20).map((r, idx) => (
          <Cell
            key={`${r.kind}-${r.refId}-${idx}`}
            subtitle={r.dueDate ? formatDate(r.dueDate) : r.amount != null ? formatMoney(r.amount) : ""}
            before={<span style={{ fontSize: 20 }}>{iconFor(r.kind)}</span>}
          >
            {t(`reminder.${r.kind}`)}: {r.label}
          </Cell>
        ))}
      </Section>

      <Section header={t("dashboard.whoOwes")}>
        {balances.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {owing.length === 0 && !balances.isLoading && (
          <Banner type="section" header={t("dashboard.allSettled")} />
        )}
        {owing.map((b) => (
          <Cell key={b.driverId} subtitle={`${t("dashboard.deposit")}: ${formatMoney(b.depositHeld)}`} after={
            <span className="amount-pos">{formatMoney(b.balance)}</span>
          }>
            {b.driverName}
          </Cell>
        ))}
      </Section>

      <ImportSection />

      <Section header={t("settings.language")}>
        <div style={{ padding: "8px 16px" }}>
          <SelectInput
            value={i18n.language as "uk" | "ru" | "en"}
            onChange={(v) => {
              void i18n.changeLanguage(v);
              localStorage.setItem("locale", v);
              setLocale.mutate(v);
            }}
            options={[
              { value: "uk", label: "Українська" },
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </Section>
    </List>
  );
}

function iconFor(kind: string): string {
  if (kind === "INSURANCE") return "🛡️";
  if (kind === "INSPECTION") return "🔧";
  return "💸";
}
