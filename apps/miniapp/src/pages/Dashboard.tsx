import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ExpenseCategory } from "@taxi/shared";
import {
  useBalances,
  useCars,
  useExpenses,
  useMe,
  useReminders,
  useReport,
  useSetCurrency,
  useSetLocale,
} from "../hooks";
import { CURRENCY_OPTIONS } from "../currency";
import type { Currency } from "@taxi/shared";
import { formatMoney } from "../components/ui";
import { ImportSection } from "../components/ImportSection";
import { ReminderSettingsCard } from "../components/ReminderSettingsCard";
import { useReadOnly } from "../readOnly";
import { ReminderList } from "../components/ReminderList";
import { RecentActivitySection } from "../components/RecentActivitySection";
import { financeInPeriod } from "../components/finance/FinanceUi";
import {
  AppHeader,
  Icon,
  SectionCard,
  StatCard,
  StatPeriodToggle,
  type DashboardStatsPeriod,
} from "../components/crm";
import i18n from "../i18n";
import { LOCALE_OPTIONS, normalizeLocale, type AppLocale } from "../locales";
import { closeTelegramApp } from "../telegram";

const STATS_PERIOD_KEY = "dashboard-stats-period";
const STATS_CAR_KEY = "dashboard-stats-car";

function formatRoi(percent: number | null | undefined): string {
  if (percent == null) return "—";
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function reportDateRange(period: DashboardStatsPeriod): { from: string; to: string } {
  const to = todayIso();
  if (period === "month") {
    const d = new Date();
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to };
  }
  return { from: "2000-01-01", to };
}

function loadStatsPeriod(): DashboardStatsPeriod {
  const stored = localStorage.getItem(STATS_PERIOD_KEY);
  return stored === "month" ? "month" : "all";
}

function loadStatsCarId(): string {
  return localStorage.getItem(STATS_CAR_KEY) ?? "";
}

function carLabel(plate: string, make?: string | null, model?: string | null): string {
  const name = [make, model].filter(Boolean).join(" ");
  return [plate, name].filter(Boolean).join(" · ");
}

export function Dashboard() {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const [statsPeriod, setStatsPeriod] = useState<DashboardStatsPeriod>(loadStatsPeriod);
  const [statsCarId, setStatsCarId] = useState(loadStatsCarId);
  const reportRange = useMemo(() => reportDateRange(statsPeriod), [statsPeriod]);
  const report = useReport(reportRange.from, reportRange.to);
  const cars = useCars();
  // Pull all expenses so we can compute the monthly expenses stat locally
  // and match the Finance page's "This month" card exactly (which excludes
  // TAX and uses the entire calendar month, not 1st-to-today).
  const expensesQuery = useExpenses();
  const reminders = useReminders();
  const balances = useBalances();
  const me = useMe();
  const setLocale = useSetLocale();
  const setCurrency = useSetCurrency();

  const stats = useMemo(() => {
    if (!report.data) {
      return {
        income: 0,
        expenses: 0,
        profit: 0,
        roiPercent: null as number | null,
        totalInvestment: 0,
      };
    }

    // For the "month" view, recompute expenses locally so the number
    // matches the Finance page's Expenses tab:
    //   - Excludes TAX (which has its own tab there)
    //   - Covers the whole calendar month, not just 1st-to-today
    //   - Filters by selected car when one is picked
    let localExpenses: number | null = null;
    if (statsPeriod === "month") {
      const list = (expensesQuery.data ?? []).filter(
        (e) =>
          e.category !== ExpenseCategory.TAX &&
          financeInPeriod(e.date, "month") &&
          (!statsCarId || e.carId === statsCarId),
      );
      localExpenses = round2(list.reduce((s, e) => s + e.amount, 0));
    }

    if (!statsCarId) {
      const expensesValue =
        localExpenses != null ? localExpenses : report.data.expenses;
      const profitValue = round2(report.data.income - expensesValue);
      return {
        income: report.data.income,
        expenses: expensesValue,
        profit: profitValue,
        roiPercent:
          report.data.totalInvestment > 0
            ? round2((profitValue / report.data.totalInvestment) * 100)
            : null,
        totalInvestment: report.data.totalInvestment,
      };
    }

    const carRow = report.data.byCar.find((row) => row.carId === statsCarId);
    const car = cars.data?.find((c) => c.id === statsCarId);
    const income = carRow?.income ?? 0;
    // When a car is selected, prefer the locally-computed monthly number
    // (excludes TAX) over the server-side per-car total.
    const expenses =
      localExpenses != null ? localExpenses : (carRow?.expenses ?? 0);
    const profit = round2(income - expenses);
    const totalInvestment =
      car?.purchasePrice != null && car.purchasePrice > 0 ? round2(car.purchasePrice) : 0;
    const roiPercent = totalInvestment > 0 ? round2((profit / totalInvestment) * 100) : null;

    return { income, expenses, profit, roiPercent, totalInvestment };
  }, [report.data, statsCarId, cars.data, expensesQuery.data, statsPeriod]);

  const owing = (balances.data ?? []).filter((b) => b.balance > 0.005);
  const income = formatMoney(stats.income);
  const expenses = formatMoney(stats.expenses);
  const profit = formatMoney(stats.profit);
  const roi = formatRoi(stats.roiPercent);
  const periodSuffix =
    statsPeriod === "month" ? t("dashboard.monthSuffix") : t("dashboard.allTimeSuffix");
  const roiHint =
    stats.totalInvestment > 0
      ? t(statsPeriod === "month" ? "dashboard.roiHint" : "dashboard.roiHintAllTime", {
          investment: formatMoney(stats.totalInvestment),
        })
      : t("dashboard.roiNoInvestment");

  function onStatsPeriodChange(period: DashboardStatsPeriod) {
    setStatsPeriod(period);
    localStorage.setItem(STATS_PERIOD_KEY, period);
  }

  function onStatsCarChange(carId: string) {
    setStatsCarId(carId);
    if (carId) localStorage.setItem(STATS_CAR_KEY, carId);
    else localStorage.removeItem(STATS_CAR_KEY);
  }

  const currentLocale =
    LOCALE_OPTIONS.find((o) => o.value === normalizeLocale(i18n.language))?.label ?? "English";
  const activeCurrency = me.data?.currency ?? "UAH";
  const currentCurrency =
    CURRENCY_OPTIONS.find((o) => o.value === activeCurrency)?.symbol ?? activeCurrency;

  return (
    <div className="crm-page">
      <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />

      <div className="crm-stat-filters">
        <label className="crm-stat-car-filter">
          <span className="crm-stat-car-filter__label">{t("dashboard.filterCar")}</span>
          <select
            className="crm-stat-car-filter__select"
            value={statsCarId}
            onChange={(e) => onStatsCarChange(e.target.value)}
          >
            <option value="">{t("dashboard.allCars")}</option>
            {(cars.data ?? []).map((car) => (
              <option key={car.id} value={car.id}>
                {carLabel(car.plate, car.make, car.model)}
              </option>
            ))}
          </select>
        </label>
        <StatPeriodToggle
          value={statsPeriod}
          onChange={onStatsPeriodChange}
          allLabel={t("dashboard.periodAll")}
          monthLabel={t("dashboard.periodMonth")}
        />
      </div>

      <div className="crm-stat-grid crm-stat-grid--home">
        <StatCard
          label={t("dashboard.income")}
          value={income}
          suffix={periodSuffix}
          tone="income"
          icon={<Icon name="credit-card" size={24} color="var(--taxi-income)" />}
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={expenses}
          suffix={periodSuffix}
          tone="expense"
          icon={<Icon name="chart-decrease" size={24} color="var(--taxi-expense)" />}
        />
        <StatCard
          label={t("dashboard.profit")}
          value={profit}
          suffix={periodSuffix}
          tone="profit"
          icon={<Icon name="chart-line-data-01" size={24} color="var(--taxi-profit)" />}
        />
        <StatCard
          label={t("dashboard.roi")}
          value={roi}
          suffix={periodSuffix}
          tone="roi"
          icon={<Icon name="chart-increase" size={24} color="var(--taxi-accent)" />}
        />
      </div>
      {report.data ? <p className="crm-stat-grid-hint">{roiHint}</p> : null}

      {report.data &&
      (report.data.partnerUnsettled.paymentsUnsettled > 0 ||
        report.data.partnerUnsettled.expensesUnsettled > 0) ? (
        <div
          className="crm-partner-banner glass-card"
          onClick={() => navigate("/finance")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/finance");
            }
          }}
        >
          <Icon name="wallet-01" size={24} color="var(--taxi-warning, #ffb300)" />
          <div>
            <div className="crm-partner-banner__title">{t("dashboard.partnerStatus")}</div>
            <div className="crm-partner-banner__subtitle">
              {report.data.partnerUnsettled.paymentsUnsettled > 0
                ? t("dashboard.partnerOwesYou", {
                    amount: formatMoney(report.data.partnerUnsettled.paymentsUnsettled),
                    count: report.data.partnerUnsettled.paymentsUnsettledCount,
                  })
                : t("dashboard.partnerReimburse", {
                    amount: formatMoney(report.data.partnerUnsettled.expensesUnsettled),
                    count: report.data.partnerUnsettled.expensesUnsettledCount,
                  })}
            </div>
          </div>
        </div>
      ) : null}

      <RecentActivitySection />

      <SectionCard
        storageKey="reminders"
        defaultOpen
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
        storageKey="who-owes"
        defaultOpen
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

      {!readOnly ? <ReminderSettingsCard /> : null}

      {!readOnly ? <ImportSection /> : null}

      <SectionCard
        storageKey="language"
        defaultOpen={false}
        title={t("settings.language")}
        icon={<Icon name="globe" size={24} color="var(--taxi-text-muted)" />}
      >
        <label className="crm-language">
          <select
            className="crm-language__select"
            value={normalizeLocale(i18n.language)}
            onChange={(e) => {
              const v = e.target.value as AppLocale;
              void i18n.changeLanguage(v);
              localStorage.setItem("locale", v);
              setLocale.mutate(v);
            }}
          >
            {LOCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="crm-language__label">{currentLocale}</span>
          <Icon name="arrow-down-01" size={20} color="var(--taxi-text-muted)" />
        </label>
      </SectionCard>

      {!readOnly && !me.data?.isSuperAdmin ? (
        <>
          <SectionCard
            storageKey="currency"
            defaultOpen={false}
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
              <span
                className="crm-language__label crm-currency-picker__value"
                aria-label={t(
                  CURRENCY_OPTIONS.find((o) => o.value === activeCurrency)?.nameKey ?? "currency.UAH",
                )}
              >
                {currentCurrency}
              </span>
              <Icon name="arrow-down-01" size={20} color="var(--taxi-text-muted)" />
            </label>
          </SectionCard>

          <SectionCard
            storageKey="logout"
            defaultOpen={false}
            title={t("settings.account")}
            icon={<Icon name="user" size={24} color="var(--taxi-text-muted)" />}
          >
            <p className="crm-form-hint">{t("settings.logoutHint")}</p>
            <button
              type="button"
              className="crm-btn-outline crm-logout-btn"
              onClick={() => closeTelegramApp()}
            >
              {t("settings.logout")}
            </button>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
