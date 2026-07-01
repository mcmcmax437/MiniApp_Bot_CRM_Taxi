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
import { dateInputValue, isoDateOnly } from "../dates";
import { ReminderSettingsCard } from "../components/ReminderSettingsCard";
import { useReadOnly } from "../readOnly";
import { ReminderList } from "../components/ReminderList";
import { WeeklyMileageSkipBanner } from "../components/WeeklyMileageSkipBanner";
import { RecentActivitySection } from "../components/RecentActivitySection";
import { StatsChart } from "../components/dashboard/StatsChart";
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

/**
 * Formats a raw ROI ratio (income/expenses × 100) into a user-facing return
 * percentage. The raw value uses 100% as the break-even line:
 *
 *   - 100%   → the business broke even (income == expenses)
 *   - > 100% → profit; anything above 100% is a positive return
 *   - < 100% → loss; anything below 100% is a negative return
 *
 * Because the raw ratio is unintuitive at a glance ("50% return? that
 * sounds great!"), we display the **delta from break-even** with a sign,
 * so the user immediately sees profit vs. loss without doing the math.
 *   -  50  → "-50.0%"  (income covered 50% of expenses — half a loss)
 *   - 100  →  "0.0%"   (broke even)
 *   - 150  → "+50.0%"  (50% above break-even — a real profit)
 *   - 200  → "+100.0%" (doubled the expenses as income)
 *
 * Returns "—" when the input is null/undefined (no expenses yet).
 */
function formatRoi(percent: number | null | undefined): string {
  if (percent == null) return "—";
  // Round the delta first so the displayed number doesn't wobble across the
  // 100% boundary (e.g. 99.96 → "-0.0%" looks wrong).
  const delta = round2(percent - 100);
  const rounded = Math.round((delta + Number.EPSILON) * 10) / 10;
  // Use the rounded value for the sign too — if it's exactly 0 we drop the
  // sign entirely ("break even" reads better than "+0.0%").
  let body: string;
  if (rounded > 0) body = `+${rounded.toFixed(1)}%`;
  else if (rounded < 0) body = `${rounded.toFixed(1)}%`;
  else body = `0.0%`;
  return body;
}

/**
 * ROI = (Income / Expenses) × 100%
 *
 * Definition: how many zł of real income was earned for every 1 zł spent
 * on operating expenses (over the selected period). When ROI > 100%, the
 * fleet brought in more than it cost to run; below 100% it ran at a loss.
 *
 * "Income" here means money actually received from drivers — i.e. payments
 * of type RENT or FINE only. Deposits and refunds that drivers leave when
 * they take a car are NOT income (they're money held on the owner's behalf
 * and returned), and DISCOUNT entries reduce what we owe back to drivers,
 * not money we received.
 *
 * "Expenses" excludes TAX, matching the Finance page's Expenses tab and
 * the existing monthly-expenses logic below.
 *
 * Returns null when expenses are zero so we can render "—" instead of a
 * misleading "Infinity%".
 */
function calcRoi(income: number, expenses: number): number | null {
  if (!(expenses > 0)) return null;
  return round2((income / expenses) * 100);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function monthKey(date: Date): string {
  return dateInputValue(date).slice(0, 7);
}

function reportDateRange(period: DashboardStatsPeriod): { from: string; to: string } {
  const now = new Date();
  if (period === "month") {
    const from = dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
    return { from, to: dateInputValue(now) };
  }
  if (period === "previous") {
    const from = dateInputValue(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = dateInputValue(new Date(now.getFullYear(), now.getMonth(), 0));
    return { from, to };
  }
  return { from: "2000-01-01", to: dateInputValue(now) };
}

function expenseInStatsPeriod(dateStr: string, period: "month" | "previous"): boolean {
  const expenseMonth = isoDateOnly(dateStr).slice(0, 7);
  if (!expenseMonth) return false;
  const now = new Date();
  if (period === "month") {
    return expenseMonth === monthKey(now);
  }
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return expenseMonth === monthKey(prevMonth);
}

function loadStatsPeriod(): DashboardStatsPeriod {
  const stored = localStorage.getItem(STATS_PERIOD_KEY);
  if (stored === "month" || stored === "previous" || stored === "all") return stored;
  return "all";
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
      };
    }

    // For the "month" view, recompute expenses locally so the number
    // matches the Finance page's Expenses tab:
    //   - Excludes TAX (which has its own tab there)
    //   - Covers the whole calendar month, not just 1st-to-today
    //   - Filters by selected car when one is picked
    let localExpenses: number | null = null;
    if (statsPeriod === "month" || statsPeriod === "previous") {
      const list = (expensesQuery.data ?? []).filter(
        (e) =>
          e.category !== ExpenseCategory.TAX &&
          expenseInStatsPeriod(e.date, statsPeriod) &&
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
        roiPercent: calcRoi(report.data.income, expensesValue),
      };
    }

    const carRow = report.data.byCar.find((row) => row.carId === statsCarId);
    const income = carRow?.income ?? 0;
    // When a car is selected, prefer the locally-computed monthly number
    // (excludes TAX) over the server-side per-car total.
    const expenses =
      localExpenses != null ? localExpenses : (carRow?.expenses ?? 0);
    const profit = round2(income - expenses);

    return {
      income,
      expenses,
      profit,
      roiPercent: calcRoi(income, expenses),
    };
  }, [report.data, statsCarId, expensesQuery.data, statsPeriod]);

  const owing = (balances.data ?? []).filter((b) => b.balance > 0.005);
  const income = formatMoney(stats.income);
  const expenses = formatMoney(stats.expenses);
  const profit = formatMoney(stats.profit);
  const roi = formatRoi(stats.roiPercent);
  // Pick the ROI card tone by sign so the colour matches the message:
  // positive ROI → green (profit), 0% → neutral accent, negative → red (loss).
  const roiTone: "income" | "expense" | "roi" =
    stats.roiPercent == null
      ? "roi"
      : stats.roiPercent > 100
        ? "income"
        : stats.roiPercent < 100
          ? "expense"
          : "roi";
  const periodSuffix =
    statsPeriod === "month"
      ? t("dashboard.monthSuffix")
      : statsPeriod === "previous"
        ? t("dashboard.previousMonthSuffix")
        : t("dashboard.allTimeSuffix");
  // ROI hint describes what the percentage means and shows the absolute
  // numbers used in the calculation so the user can verify the figure.
  //   - When there are no expenses yet, we show a "no expenses" message.
  //   - Otherwise we show income, expenses, and the same delta-from-break-even
  //     percentage that appears on the card, so the two stay in sync.
  const roiHint =
    stats.expenses > 0
      ? t("dashboard.roiHint", {
          income: formatMoney(stats.income),
          expenses: formatMoney(stats.expenses),
          return: formatRoi(stats.roiPercent),
        })
      : t("dashboard.roiNoExpenses");

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
          previousLabel={t("dashboard.periodPrevious")}
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
          tone={roiTone}
          icon={<Icon name="chart-increase" size={24} color="var(--taxi-accent)" />}
        />
      </div>
      {report.data ? <p className="crm-stat-grid-hint">{roiHint}</p> : null}

      <SectionCard
        storageKey="dashboard-stats-chart"
        defaultOpen
        title={t("dashboard.chartTitle")}
        subtitle={t("dashboard.chartSubtitle")}
        icon={<Icon name="chart-increase" size={24} color="var(--taxi-accent)" />}
      >
        {report.isLoading ? (
          <div className="crm-empty-box">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          // Pass `byCar` regardless of the active car filter — the chart is
          // meant to compare cars, so showing only the selected car would be
          // a single bar and pointless. When `statsCarId` is set we keep
          // the totals (the stat grid above) but chart the whole fleet.
          <StatsChart rows={report.data?.byCar ?? []} />
        )}
      </SectionCard>

      {report.data &&
      (report.data.partnerUnsettled.paymentsUnsettled > 0 ||
        report.data.partnerUnsettled.expensesUnsettled > 0) ? (
        <div
          className="crm-partner-banner glass-card"
          onClick={() => navigate("/reports")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/reports");
            }
          }}
        >
          <Icon name="wallet-01" size={24} color="var(--taxi-warning, #ffb300)" />
          <div>
            <div className="crm-partner-banner__title">{t("dashboard.partnerStatus")}</div>
            <div className="crm-partner-banner__subtitle">
              {(() => {
                const owesYou = report.data.partnerUnsettled.paymentsUnsettled;
                const youOwe = report.data.partnerUnsettled.expensesUnsettled;
                const net = owesYou - youOwe;
                if (net > 0) {
                  return t("dashboard.partnerNetOwesYou", { amount: formatMoney(net) });
                }
                if (net < 0) {
                  return t("dashboard.partnerNetYouOwe", { amount: formatMoney(Math.abs(net)) });
                }
                if (owesYou > 0) {
                  return t("dashboard.partnerOwesYou", {
                    amount: formatMoney(owesYou),
                    count: report.data.partnerUnsettled.paymentsUnsettledCount,
                  });
                }
                return t("dashboard.partnerReimburse", {
                  amount: formatMoney(youOwe),
                  count: report.data.partnerUnsettled.expensesUnsettledCount,
                });
              })()}
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
          <>
            <WeeklyMileageSkipBanner compact mileageReminderCount={0} />
            <div className="crm-empty-box">
              <Icon name="calendar-01" size={42} color="var(--taxi-text-muted)" />
              <p className="crm-empty-box__title">{t("dashboard.noReminders")}</p>
              <p className="crm-empty-box__subtitle">{t("dashboard.caughtUp")}</p>
            </div>
          </>
        ) : (
          <>
            <WeeklyMileageSkipBanner
              compact
              mileageReminderCount={
                reminders.data?.filter((r) => r.kind === "MILEAGE_REPORT").length ?? 0
              }
            />
            <ReminderList items={reminders.data ?? []} limit={20} />
          </>
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
