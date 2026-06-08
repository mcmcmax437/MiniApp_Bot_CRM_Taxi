import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useBalances, useMe, useReminders, useReport, useSetCurrency, useSetLocale } from "../hooks";
import { CURRENCY_OPTIONS } from "../currency";
import type { Currency } from "@taxi/shared";
import { formatMoney } from "../components/ui";
import { ImportSection } from "../components/ImportSection";
import { ReminderSettingsCard } from "../components/ReminderSettingsCard";
import { ReminderList } from "../components/ReminderList";
import { AppHeader, Icon, SectionCard, StatCard } from "../components/crm";
import i18n from "../i18n";

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const report = useReport();
  const reminders = useReminders();
  const balances = useBalances();
  const me = useMe();
  const setLocale = useSetLocale();
  const setCurrency = useSetCurrency();

  const owing = (balances.data ?? []).filter((b) => b.balance > 0.005);
  const income = formatMoney(report.data?.income ?? 0);
  const expenses = formatMoney(report.data?.expenses ?? 0);
  const profit = formatMoney(report.data?.profit ?? 0);

  const localeOptions = [
    { value: "uk" as const, label: "Українська" },
    { value: "ru" as const, label: "Русский" },
    { value: "en" as const, label: "English" },
  ];
  const currentLocale = localeOptions.find((o) => o.value === i18n.language)?.label ?? "English";
  const activeCurrency = me.data?.currency ?? "UAH";
  const currentCurrency =
    CURRENCY_OPTIONS.find((o) => o.value === activeCurrency)?.symbol ?? activeCurrency;

  return (
    <div className="crm-page">
      <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />

      <div className="crm-stat-grid">
        <StatCard
          label={t("dashboard.income")}
          value={income}
          suffix={t("dashboard.monthSuffix")}
          tone="income"
          icon={<Icon name="credit-card" size={24} color="var(--taxi-income)" />}
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={expenses}
          suffix={t("dashboard.monthSuffix")}
          tone="expense"
          icon={<Icon name="chart-decrease" size={24} color="var(--taxi-expense)" />}
        />
        <StatCard
          label={t("dashboard.profit")}
          value={profit}
          suffix={t("dashboard.monthSuffix")}
          tone="profit"
          icon={<Icon name="chart-line-data-01" size={24} color="var(--taxi-profit)" />}
        />
      </div>

      <SectionCard
        title={t("dashboard.reminders")}
        icon={<Icon name="notification-01" size={24} color="var(--taxi-text-muted)" />}
        action={
          reminders.data && reminders.data.length > 0 ? (
            <button type="button" className="crm-link-btn" onClick={() => navigate("/reminders")}>
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
            <Icon name="calendar-01" size={42} color="var(--taxi-text-muted)" />
            <p className="crm-empty-box__title">{t("dashboard.noReminders")}</p>
            <p className="crm-empty-box__subtitle">{t("dashboard.caughtUp")}</p>
          </div>
        ) : (
          <ReminderList items={reminders.data ?? []} limit={20} />
        )}
      </SectionCard>

      <SectionCard
        title={t("dashboard.whoOwes")}
        icon={<Icon name="user" size={24} color="var(--taxi-text-muted)" />}
      >
        {balances.isLoading ? (
          <div className="crm-empty-box">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : owing.length === 0 ? (
          <div className="crm-settled-card">
            <Icon name="wallet-01" size={24} color="var(--taxi-income)" />
            <div>
              <div className="crm-settled-card__title">{t("dashboard.allSettled")}</div>
              <div className="crm-settled-card__subtitle">{t("dashboard.settledSubtitle")}</div>
            </div>
            <div className="crm-settled-card__check">
              <Icon name="checkmark-circle-01" size={18} color="#fff" />
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
        title={t("settings.currency")}
        icon={<Icon name="dollar-01" size={24} color="var(--taxi-text-muted)" />}
      >
        <label className="crm-language">
          <select
            className="crm-language__select"
            value={activeCurrency}
            onChange={(e) => {
              const v = e.target.value as Currency;
              setCurrency.mutate(v);
            }}
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.nameKey)} ({o.symbol})
              </option>
            ))}
          </select>
          <span className="crm-language__label crm-currency-picker__value" aria-label={t(CURRENCY_OPTIONS.find((o) => o.value === activeCurrency)?.nameKey ?? "currency.UAH")}>
            {currentCurrency}
          </span>
          <Icon name="arrow-down-01" size={20} color="var(--taxi-text-muted)" />
        </label>
      </SectionCard>

      <SectionCard
        title={t("settings.language")}
        icon={<Icon name="globe" size={24} color="var(--taxi-text-muted)" />}
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
          <Icon name="arrow-down-01" size={20} color="var(--taxi-text-muted)" />
        </label>
      </SectionCard>
    </div>
  );
}

