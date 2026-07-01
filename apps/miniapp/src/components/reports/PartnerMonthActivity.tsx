import { useMemo, useState } from "react";
import { useExpenses, usePayments } from "../../hooks";
import { Icon } from "../crm";
import { formatMoney } from "../ui";
import {
  partnerExpenseDescription,
  partnerPaymentDescription,
} from "./partnerSettlementFormat";
import {
  buildPartnerActivityModel,
  formatActivityExpenseAmount,
  formatActivityIncomeAmount,
  roundActivityAmount,
  type ActivityMonth,
} from "./partnerMonthActivityModel";

function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

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
            <strong className="crm-partner-settlement__amount--in">
              {formatActivityIncomeAmount(section.incomeTotal, formatMoney)}
            </strong>
          </span>
          <span className="crm-partner-settlement__col crm-partner-settlement__col--out">
            <span className="crm-partner-settlement__col-label">{t("reports.partnerActivityExpenses")}</span>
            <strong className="crm-partner-settlement__amount--out">
              {formatActivityExpenseAmount(section.expenseTotal, formatMoney)}
            </strong>
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
                    <span className="crm-partner-settlement__line-amount crm-partner-settlement__line-amount--income">
                      {formatActivityIncomeAmount(line.amount, formatMoney)}
                    </span>
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
                    <span className="crm-partner-settlement__line-amount crm-partner-settlement__line-amount--expense">
                      {formatActivityExpenseAmount(line.amount, formatMoney)}
                    </span>
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

  const { months, grandIncome, grandExpenses } = useMemo(
    () =>
      buildPartnerActivityModel({
        selectedMonths,
        payments: payments.data ?? [],
        expenses: expenses.data ?? [],
      }),
    [payments.data, expenses.data, selectedMonths],
  );

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
          <strong className="crm-partner-settlement__amount--in">
            {formatActivityIncomeAmount(grandIncome, formatMoney)}
          </strong>
        </div>
        <div className="crm-partner-settlement__grand-row">
          <span>{t("reports.partnerActivityGrandExpenses")}</span>
          <strong className="crm-partner-settlement__amount--out">
            {formatActivityExpenseAmount(grandExpenses, formatMoney)}
          </strong>
        </div>
        <div className="crm-partner-settlement__grand-row crm-partner-settlement__grand-row--net">
          <span>{t("dashboard.profit")}</span>
          <strong>{formatMoney(roundActivityAmount(grandIncome - grandExpenses))}</strong>
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
