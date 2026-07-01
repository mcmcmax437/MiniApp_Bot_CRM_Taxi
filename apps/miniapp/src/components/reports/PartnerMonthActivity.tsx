import { useMemo, useState } from "react";
import { useExpenses, usePayments } from "../../hooks";
import type { Expense, Payment } from "../../types";
import { Icon } from "../crm";
import { formatMoney } from "../ui";
import {
  isIncomePayment,
  monthKeyFromIso,
  partnerExpenseDescription,
  partnerPaymentDescription,
} from "./partnerSettlementFormat";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

type ActivityMonth = {
  monthKey: string;
  incomeTotal: number;
  expenseTotal: number;
  payments: Payment[];
  expenses: Expense[];
};

function ActivityMonthBlock({
  section,
  monthLabel,
  locale,
  t,
}: {
  section: ActivityMonth;
  monthLabel: string;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const hasLines = section.payments.length > 0 || section.expenses.length > 0;

  return (
    <div className="crm-partner-settlement__month">
      <button
        type="button"
        className="crm-partner-settlement__month-head"
        onClick={() => hasLines && setOpen((v) => !v)}
        disabled={!hasLines}
      >
        <span className="crm-partner-settlement__month-title">{monthLabel}</span>
        <div className="crm-partner-settlement__month-summary">
          <span className="crm-partner-settlement__col crm-partner-settlement__col--in">
            <span className="crm-partner-settlement__col-label">{t("reports.partnerActivityIncome")}</span>
            <strong>{formatMoney(section.incomeTotal)}</strong>
          </span>
          <span className="crm-partner-settlement__col crm-partner-settlement__col--out">
            <span className="crm-partner-settlement__col-label">{t("reports.partnerActivityExpenses")}</span>
            <strong>{formatMoney(section.expenseTotal)}</strong>
          </span>
        </div>
        {hasLines ? (
          <Icon
            name="arrow-down-01"
            size={18}
            color="var(--taxi-text-muted)"
            className={open ? "crm-partner-settlement__chevron--open" : undefined}
          />
        ) : null}
      </button>

      {open ? (
        <div className="crm-partner-settlement__details">
          {section.payments.length > 0 ? (
            <div className="crm-partner-settlement__group">
              <div className="crm-partner-settlement__group-title">{t("reports.partnerActivityIncomeTitle")}</div>
              <ul className="crm-partner-settlement__lines">
                {section.payments.map((line) => (
                  <li key={line.id} className="crm-partner-settlement__line">
                    <span className="crm-partner-settlement__line-date">
                      {formatShortDate(line.date, locale)}
                    </span>
                    <span className="crm-partner-settlement__line-desc">
                      {partnerPaymentDescription(line)}
                    </span>
                    <span className="crm-partner-settlement__line-amount">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {section.expenses.length > 0 ? (
            <div className="crm-partner-settlement__group">
              <div className="crm-partner-settlement__group-title">{t("reports.partnerActivityExpensesTitle")}</div>
              <ul className="crm-partner-settlement__lines">
                {section.expenses.map((line) => (
                  <li key={line.id} className="crm-partner-settlement__line">
                    <span className="crm-partner-settlement__line-date">
                      {formatShortDate(line.date, locale)}
                    </span>
                    <span className="crm-partner-settlement__line-desc">
                      {partnerExpenseDescription(line)}
                    </span>
                    <span className="crm-partner-settlement__line-amount">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PartnerMonthActivity({
  selectedMonths,
  monthLabel,
  locale,
  t,
}: {
  selectedMonths: Set<string>;
  monthLabel: (monthKey: string) => string;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const payments = usePayments();
  const expenses = useExpenses();

  const { months, grandIncome, grandExpenses } = useMemo(() => {
    const sorted = [...selectedMonths].sort();
    let grandIncome = 0;
    let grandExpenses = 0;
    const months = sorted.map((monthKey) => {
      const monthPayments = (payments.data ?? [])
        .filter((p) => isIncomePayment(p.type) && monthKeyFromIso(p.date) === monthKey)
        .sort((a, b) => b.date.localeCompare(a.date));
      const monthExpenses = (expenses.data ?? [])
        .filter((e) => monthKeyFromIso(e.date) === monthKey)
        .sort((a, b) => b.date.localeCompare(a.date));
      const incomeTotal = round2(monthPayments.reduce((s, p) => s + p.amount, 0));
      const expenseTotal = round2(monthExpenses.reduce((s, e) => s + e.amount, 0));
      grandIncome += incomeTotal;
      grandExpenses += expenseTotal;
      return { monthKey, incomeTotal, expenseTotal, payments: monthPayments, expenses: monthExpenses };
    });
    return {
      months,
      grandIncome: round2(grandIncome),
      grandExpenses: round2(grandExpenses),
    };
  }, [payments.data, expenses.data, selectedMonths]);

  const loading = payments.isLoading || expenses.isLoading;
  const hasData = months.some((m) => m.payments.length > 0 || m.expenses.length > 0);

  if (loading) {
    return (
      <div className="crm-report-section__empty">
        <span className="crm-spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="crm-report-section__empty">
        <div className="crm-report-section__empty-icon">
          <Icon name="chart-line-data-01" size={28} color="rgba(255,255,255,0.7)" />
        </div>
        <div>
          <div className="crm-report-section__empty-title">{t("reports.partnerActivityEmptyTitle")}</div>
          <div className="crm-report-section__empty-subtitle">{t("reports.partnerActivityEmpty")}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="crm-partner-settlement__grand glass-card">
        <div className="crm-partner-settlement__grand-row">
          <span>{t("reports.partnerActivityGrandIncome")}</span>
          <strong className="crm-partner-settlement__amount--in">{formatMoney(grandIncome)}</strong>
        </div>
        <div className="crm-partner-settlement__grand-row">
          <span>{t("reports.partnerActivityGrandExpenses")}</span>
          <strong className="crm-partner-settlement__amount--out">{formatMoney(grandExpenses)}</strong>
        </div>
        <div className="crm-partner-settlement__grand-row crm-partner-settlement__grand-row--net">
          <span>{t("dashboard.profit")}</span>
          <strong>{formatMoney(round2(grandIncome - grandExpenses))}</strong>
        </div>
      </div>

      <div className="crm-partner-settlement__months">
        {months.map((section) => (
          <ActivityMonthBlock
            key={section.monthKey}
            section={section}
            monthLabel={monthLabel(section.monthKey)}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    </>
  );
}
