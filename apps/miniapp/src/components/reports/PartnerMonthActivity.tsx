import { useMemo, useState } from "react";
import { useExpenses, usePayments } from "../../hooks";
import { Icon } from "../crm";
import { PartnerAlertMark } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import {
  buildPartnerActivitySummary,
  expenseHasPartnerMarker,
  paymentHasPartnerMarker,
  round2,
  type ActivityMonth,
} from "./partnerMonthActivityModel";
import {
  partnerExpenseDescription,
  partnerPaymentDescription,
} from "./partnerSettlementFormat";

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
            <strong className="crm-partner-settlement__amount--in">+{formatMoney(section.incomeTotal)}</strong>
          </span>
          <span className="crm-partner-settlement__col crm-partner-settlement__col--out">
            <span className="crm-partner-settlement__col-label">{t("reports.partnerActivityExpenses")}</span>
            <strong className="crm-partner-settlement__amount--out">−{formatMoney(section.expenseTotal)}</strong>
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
                      <span className="crm-partner-settlement__line-desc-text">
                        {partnerPaymentDescription(line)}
                      </span>
                      {paymentHasPartnerMarker(line) ? (
                        <PartnerAlertMark label={t("finance.receivedByPartner")} />
                      ) : null}
                    </span>
                    <span className="crm-partner-settlement__line-amount crm-partner-settlement__line-amount--income">
                      +{formatMoney(line.amount)}
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
                      <span className="crm-partner-settlement__line-desc-text">
                        {partnerExpenseDescription(line)}
                      </span>
                      {expenseHasPartnerMarker(line) ? (
                        <PartnerAlertMark label={t("finance.paidByPartner")} />
                      ) : null}
                    </span>
                    <span className="crm-partner-settlement__line-amount crm-partner-settlement__line-amount--expense">
                      −{formatMoney(line.amount)}
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

  const { months, grandIncome, grandExpenses, hasPartnerMarkers } = useMemo(
    () =>
      buildPartnerActivitySummary({
        selectedMonths,
        payments: payments.data,
        expenses: expenses.data,
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
          <strong className="crm-partner-settlement__amount--in">+{formatMoney(grandIncome)}</strong>
        </div>
        <div className="crm-partner-settlement__grand-row">
          <span>{t("reports.partnerActivityGrandExpenses")}</span>
          <strong className="crm-partner-settlement__amount--out">−{formatMoney(grandExpenses)}</strong>
        </div>
        <div className="crm-partner-settlement__grand-row crm-partner-settlement__grand-row--net">
          <span>{t("dashboard.profit")}</span>
          <strong>{formatMoney(round2(grandIncome - grandExpenses))}</strong>
        </div>
      </div>

      {hasPartnerMarkers ? (
        <div className="crm-partner-activity-legend">
          <span className="crm-partner-activity-legend__item">
            <PartnerAlertMark label={t("finance.receivedByPartner")} />
            <span>{t("finance.receivedByPartner")}</span>
          </span>
          <span className="crm-partner-activity-legend__item">
            <PartnerAlertMark label={t("finance.paidByPartner")} />
            <span>{t("finance.paidByPartner")}</span>
          </span>
        </div>
      ) : null}

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
