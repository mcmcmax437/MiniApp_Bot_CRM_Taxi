import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExpenseCategory, PaymentType } from "@taxi/shared";
import { useExpenses, usePayments } from "../hooks";
import { formatMoney } from "../currency";
import { Icon } from "./crm";
import { formatFinanceMonthLabel, getFinanceMonthKey } from "./finance/FinanceUi";

/**
 * Per-car, per-month finance chart shown on the car detail page.
 *
 * The dashboard's "Fleet at a glance" chart gives a fleet-wide, single-period
 * summary per car; this is the drill-down view the dashboard chart opens into
 * when the user taps a row. We pull the same `usePayments` / `useExpenses`
 * caches the rest of the app already uses, filter them to this car, then
 * bucket by calendar month.
 *
 * Income = payments of type RENT or FINE only — matching the dashboard's
 * ROI definition so the two views agree on what "income" means.
 *
 * Expenses = everything except TAX — also matching the dashboard, because
 * tax has its own tab in Finance and shouldn't double-count as an operating
 * cost in the per-car monthly view.
 *
 * The user can pick between "All time" (default — the user asked for full
 * history) and "Last 12 months" (a shorter window for quick comparison).
 * Selection is persisted in localStorage so it survives navigation.
 */

const MONTHS_BACK_LIMIT = 12;
const PERIOD_STORAGE_KEY = "car-finance-chart-period";

type Period = "all" | "12m";

type MonthRow = {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
  count: number;
};

function loadPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (v === "12m") return "12m";
  } catch {
    /* ignore */
  }
  return "all";
}

/**
 * Build a continuous list of month keys from `start` to `end` (inclusive),
 * oldest first. Each entry also carries the JS Date for that month so we
 * can format the label later.
 */
function buildMonthRange(start: Date, end: Date): { key: string; date: Date }[] {
  const list: { key: string; date: Date }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor.getTime() <= last.getTime()) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    list.push({ key, date: new Date(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return list;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function CarFinanceChart(props: { carId: string }) {
  const { t, i18n } = useTranslation();
  const payments = usePayments();
  const expenses = useExpenses();
  const [period, setPeriod] = useState<Period>(loadPeriod);

  // Persist the user's choice so they don't have to re-pick it every time
  // they revisit a car page. We keep the in-memory state and localStorage
  // in sync; this effect is cheap (a single setItem on change).
  useEffect(() => {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, period);
    } catch {
      /* ignore */
    }
  }, [period]);

  const months = useMemo<MonthRow[]>(() => {
    // We always bucket the data into "all time" first because that's the
    // superset. The active period then picks a window out of it. This way
    // the user can flip between views without re-aggregating the raw data.
    const byKey = new Map<string, { income: number; expenses: number; count: number }>();
    let earliest: Date | null = null;

    const consider = (date: Date) => {
      if (!earliest || date.getTime() < earliest.getTime()) earliest = date;
    };

    const carPayments = (payments.data ?? []).filter(
      (p) => p.carId === props.carId && (p.type === PaymentType.RENT || p.type === PaymentType.FINE),
    );
    for (const p of carPayments) {
      const k = getFinanceMonthKey(p.date);
      const slot = byKey.get(k) ?? { income: 0, expenses: 0, count: 0 };
      slot.income += p.amount;
      slot.count += 1;
      byKey.set(k, slot);
      consider(new Date(p.date));
    }

    const carExpenses = (expenses.data ?? []).filter(
      (e) => e.carId === props.carId && e.category !== ExpenseCategory.TAX,
    );
    for (const e of carExpenses) {
      const k = getFinanceMonthKey(e.date);
      const slot = byKey.get(k) ?? { income: 0, expenses: 0, count: 0 };
      slot.expenses += e.amount;
      slot.count += 1;
      byKey.set(k, slot);
      consider(new Date(e.date));
    }

    // Decide the month list to render. If we have no data at all, we still
    // show a one-month slice (the current month) so the empty state has a
    // consistent shape — but with zero amounts. In "12m" mode the slice is
    // anchored at the current month and walks back N months.
    const now = new Date();
    const monthList =
      earliest == null
        ? buildMonthRange(now, now)
        : period === "12m"
          ? buildMonthRange(
              new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK_LIMIT - 1), 1),
              now,
            )
          : buildMonthRange(earliest, now);

    // The user wants newest-first: the current month at the top, the
    // earliest month at the bottom. `buildMonthRange` walks oldest → newest,
    // so we reverse the list before mapping to MonthRow.
    const reversed = monthList.slice().reverse();
    return reversed.map(({ key, date }) => {
      const slot = byKey.get(key) ?? { income: 0, expenses: 0, count: 0 };
      const income = round2(slot.income);
      const expenses = round2(slot.expenses);
      return {
        monthKey: key,
        // `formatFinanceMonthLabel` returns the localised month name + year,
        // e.g. "January 2026" / "січень 2026" / "январь 2026".
        label: formatFinanceMonthLabel(key, i18n.language),
        income,
        expenses,
        profit: round2(income - expenses),
        count: slot.count,
      };
      // `date` is only used to build the key + label, both already done.
      void date;
    });
  }, [payments.data, expenses.data, props.carId, i18n.language, period]);

  const totals = useMemo(() => {
    const income = months.reduce((s, m) => s + m.income, 0);
    const expenses = months.reduce((s, m) => s + m.expenses, 0);
    return {
      income: round2(income),
      expenses: round2(expenses),
      profit: round2(income - expenses),
    };
  }, [months]);

  const max = Math.max(
    1,
    ...months.map((m) => Math.max(m.income, m.expenses)),
  );

  const isLoading = payments.isLoading || expenses.isLoading;
  const hasAny = totals.income > 0 || totals.expenses > 0;

  return (
    <div className="crm-car-finance-chart">
      <div className="crm-car-finance-chart__period" role="group" aria-label={t("dashboard.carChartPeriodLabel")}>
        <button
          type="button"
          className={`crm-car-finance-chart__period-btn${period === "12m" ? " crm-car-finance-chart__period-btn--active" : ""}`}
          onClick={() => setPeriod("12m")}
        >
          {t("dashboard.carChartPeriod12m")}
        </button>
        <button
          type="button"
          className={`crm-car-finance-chart__period-btn${period === "all" ? " crm-car-finance-chart__period-btn--active" : ""}`}
          onClick={() => setPeriod("all")}
        >
          {t("dashboard.carChartPeriodAll")}
        </button>
      </div>

      {isLoading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : !hasAny ? (
        <div className="crm-stats-chart__empty">
          <Icon name="chart-increase" size={28} color="var(--taxi-text-muted)" />
          <p className="crm-form-hint">{t("dashboard.carChartEmpty")}</p>
        </div>
      ) : (
        <>
          <div className="crm-car-finance-chart__totals">
            <div className="crm-car-finance-chart__total crm-car-finance-chart__total--income">
              <span className="crm-car-finance-chart__total-label">{t("dashboard.income")}</span>
              <span className="crm-car-finance-chart__total-value">{formatMoney(totals.income)}</span>
            </div>
            <div className="crm-car-finance-chart__total crm-car-finance-chart__total--expense">
              <span className="crm-car-finance-chart__total-label">{t("dashboard.expenses")}</span>
              <span className="crm-car-finance-chart__total-value">{formatMoney(totals.expenses)}</span>
            </div>
            <div className={`crm-car-finance-chart__total crm-car-finance-chart__total--${totals.profit >= 0 ? "profit" : "loss"}`}>
              <span className="crm-car-finance-chart__total-label">{t("dashboard.profit")}</span>
              <span className="crm-car-finance-chart__total-value">{formatMoney(totals.profit)}</span>
            </div>
          </div>

          <ul className="crm-stats-chart crm-car-finance-chart__months">
            {months.map((m) => {
              const incomeWidth = (m.income / max) * 100;
              const expenseWidth = (m.expenses / max) * 100;
              const tone =
                m.profit > 0 ? "profit" : m.profit < 0 ? "loss" : "neutral";
              return (
                <li
                  key={m.monthKey}
                  className={`crm-stats-chart__row crm-stats-chart__row--${tone} crm-car-finance-chart__month`}
                >
                  <div className="crm-stats-chart__label crm-car-finance-chart__month-label">
                    <span>{m.label}</span>
                    <span className="crm-car-finance-chart__month-count">
                      {m.count > 0 ? t("dashboard.entries", { count: m.count }) : ""}
                    </span>
                  </div>
                  <div className="crm-stats-chart__bars">
                    <div className="crm-stats-chart__line">
                      <span className="crm-stats-chart__caption">{t("dashboard.income")}</span>
                      <div className="crm-stats-chart__bar crm-stats-chart__bar--income">
                        <div
                          className="crm-stats-chart__bar-fill"
                          style={{ width: `${incomeWidth}%` }}
                        />
                      </div>
                      <span className="crm-stats-chart__value">{formatMoney(m.income)}</span>
                    </div>
                    <div className="crm-stats-chart__line">
                      <span className="crm-stats-chart__caption">{t("dashboard.expenses")}</span>
                      <div className="crm-stats-chart__bar crm-stats-chart__bar--expense">
                        <div
                          className="crm-stats-chart__bar-fill"
                          style={{ width: `${expenseWidth}%` }}
                        />
                      </div>
                      <span className="crm-stats-chart__value">{formatMoney(m.expenses)}</span>
                    </div>
                    <div className="crm-stats-chart__profit">
                      {t("dashboard.profit")}:{" "}
                      <strong
                        className={`crm-stats-chart__profit-value crm-stats-chart__profit-value--${tone}`}
                      >
                        {formatMoney(m.profit)}
                      </strong>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
