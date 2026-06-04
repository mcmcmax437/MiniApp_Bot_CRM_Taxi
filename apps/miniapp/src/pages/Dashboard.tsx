import { useTranslation } from "react-i18next";
import { useBalances, useReminders, useReport, useSetLocale } from "../hooks";
import { formatMoney, formatDate } from "../components/ui";
import { ImportSection } from "../components/ImportSection";
import { ReminderSettingsCard } from "../components/ReminderSettingsCard";
import { AppHeader, Icon, SectionCard, StatCard } from "../components/crm";
import i18n from "../i18n";

export function Dashboard() {
  const { t } = useTranslation();
  const report = useReport();
  const reminders = useReminders();
  const balances = useBalances();
  const setLocale = useSetLocale();

  const owing = (balances.data ?? []).filter((b) => b.balance > 0.005);
  const income = report.data ? formatMoney(report.data.income) : "0";
  const expenses = report.data ? formatMoney(report.data.expenses) : "0";
  const profit = report.data ? formatMoney(report.data.profit) : "0";

  const localeOptions = [
    { value: "uk" as const, label: "Українська" },
    { value: "ru" as const, label: "Русский" },
    { value: "en" as const, label: "English" },
  ];
  const currentLocale = localeOptions.find((o) => o.value === i18n.language)?.label ?? "English";

  return (
    <div className="crm-page">
      <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />

      <div className="crm-stat-grid">
        <StatCard
          label={t("dashboard.income")}
          value={income}
          suffix={t("dashboard.monthSuffix")}
          tone="income"
          icon={
            <Icon stroke="var(--taxi-income)" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="2" strokeWidth="1.8" />
              <path d="M3 10h18" strokeWidth="1.8" />
            </Icon>
          }
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={expenses}
          suffix={t("dashboard.monthSuffix")}
          tone="expense"
          icon={
            <Icon stroke="var(--taxi-expense)" fill="none">
              <path d="M6 8l6 8 6-8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
        />
        <StatCard
          label={t("dashboard.profit")}
          value={profit}
          suffix={t("dashboard.monthSuffix")}
          tone="profit"
          icon={
            <Icon stroke="var(--taxi-profit)" fill="none">
              <path d="M12 4v16M6 10a6 6 0 1 0 12 0" strokeWidth="1.8" strokeLinecap="round" />
            </Icon>
          }
        />
      </div>

      <SectionCard
        title={t("dashboard.reminders")}
        icon={
          <Icon stroke="var(--taxi-text-muted)" fill="none">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" strokeWidth="1.8" strokeLinecap="round" />
          </Icon>
        }
        action={
          reminders.data && reminders.data.length > 0 ? (
            <button type="button" className="crm-link-btn">
              {t("dashboard.viewAll")}
            </button>
          ) : null
        }
      >
        {reminders.isLoading ? (
          <div className="crm-empty-box">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : reminders.data && reminders.data.length === 0 ? (
          <div className="crm-empty-box">
            <Icon stroke="var(--taxi-text-muted)" fill="none" width="42" height="42">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
            <p className="crm-empty-box__title">{t("dashboard.noReminders")}</p>
            <p className="crm-empty-box__subtitle">{t("dashboard.caughtUp")}</p>
          </div>
        ) : (
          <div className="crm-list">
            {reminders.data?.slice(0, 20).map((r, idx) => (
              <div key={`${r.kind}-${r.refId}-${idx}`} className="crm-list-item glass-card">
                <span className="crm-list-item__icon">{iconFor(r.kind)}</span>
                <div>
                  <div className="crm-list-item__title">
                    {t(`reminder.${r.kind}`)}: {r.label}
                  </div>
                  <div className="crm-list-item__subtitle">
                    {r.daysUntil != null
                      ? t("reminder.daysUntil", { count: r.daysUntil })
                      : null}
                    {r.daysUntil != null && (r.dueDate || r.detail) ? " · " : null}
                    {r.dueDate ? formatDate(r.dueDate) : r.detail ?? (r.amount != null ? formatMoney(r.amount) : "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("dashboard.whoOwes")}
        icon={
          <Icon stroke="var(--taxi-text-muted)" fill="none">
            <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" />
            <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.8" strokeLinecap="round" />
          </Icon>
        }
      >
        {balances.isLoading ? (
          <div className="crm-empty-box">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : owing.length === 0 ? (
          <div className="crm-settled-card">
            <Icon stroke="var(--taxi-income)" fill="none">
              <path d="M8 12a4 4 0 1 0 8 0M6 20h12" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
            </Icon>
            <div>
              <div className="crm-settled-card__title">{t("dashboard.allSettled")}</div>
              <div className="crm-settled-card__subtitle">{t("dashboard.settledSubtitle")}</div>
            </div>
            <div className="crm-settled-card__check">
              <Icon stroke="#fff" fill="none" width="18" height="18">
                <path d="M5 12l4 4 8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </Icon>
            </div>
          </div>
        ) : (
          <div className="crm-list">
            {owing.map((b) => (
              <div key={b.driverId} className="crm-list-item glass-card">
                <div>
                  <div className="crm-list-item__title">{b.driverName}</div>
                  <div className="crm-list-item__subtitle">
                    {t("dashboard.deposit")}: {formatMoney(b.depositHeld)}
                  </div>
                </div>
                <div className="crm-amount crm-amount--expense">{formatMoney(b.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ReminderSettingsCard />

      <ImportSection />

      <SectionCard
        title={t("settings.language")}
        icon={
          <Icon stroke="var(--taxi-text-muted)" fill="none">
            <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" strokeWidth="1.8" />
          </Icon>
        }
      >
        <label className="crm-language">
          <select
            className="crm-language__select"
            value={i18n.language}
            onChange={(e) => {
              const v = e.target.value as "uk" | "ru" | "en";
              void i18n.changeLanguage(v);
              localStorage.setItem("locale", v);
              setLocale.mutate(v);
            }}
          >
            {localeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="crm-language__label">{currentLocale}</span>
          <Icon stroke="var(--taxi-text-muted)" fill="none" width="20" height="20">
            <path d="M8 10l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
        </label>
      </SectionCard>
    </div>
  );
}

function iconFor(kind: string): string {
  if (kind === "INSURANCE") return "🛡️";
  if (kind === "INSPECTION") return "🔧";
  if (kind === "DOCUMENT") return "📄";
  if (kind === "MAINTENANCE") return "🛠️";
  if (kind === "MILEAGE_REPORT") return "📊";
  return "💸";
}
