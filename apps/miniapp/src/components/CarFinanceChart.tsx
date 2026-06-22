import { useMemo } from "react";
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
 * bucket by calendar month for the last N months (default 12).
 *
 * Income = payments of type RENT or FINE only — matching the dashboard's
 * ROI definition so the two views agree on what "income" means.
 *
 * Expenses = everything except TAX — also matching the dashboard, because
 * tax has its own tab in Finance and shouldn't double-count as an operating
 * cost in the per-car monthly view.
 */

const MONTHS_BACK = 12;

type MonthRow = {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
  count: number;
};

function buildMonthList(now: Date): { key: string; date: Date }[] {
  const list: { key: string; date: Date }[] = [];
  for (let offset = MONTHS_BACK - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    list.push({ key, date: d });
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

  // Build the canonical list of last N months (oldest → newest) so empty
  // months still appear as zero rows. This is friendlier than only showing
  // months with activity — the user can see the car had a slow period.
  const months = useMemo<MonthRow[]>(() => {
    const now = new Date();
    const monthList = buildMonthList(now);
    const byKey = new Map<string, { income: number; expenses: number; count: number }>();

    const carPayments = (payments.data ?? []).filter(
      (p) => p.carId === props.carId && (p.type === PaymentType.RENT || p.type === PaymentType.FINE),
    );
    for (const p of carPayments) {
      const k = getFinanceMonthKey(p.date);
      const slot = byKey.get(k) ?? { income: 0, expenses: 0, count: 0 };
      slot.income += p.amount;
      slot.count += 1;
      byKey.set(k, slot);
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
    }

    return monthList.map(({ key, date }) => {
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
  }, [payments.data, expenses.data, props.carId, i18n.language]);

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
