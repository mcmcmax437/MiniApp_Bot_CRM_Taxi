import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartnerSettlementMonth } from "@taxi/shared";
import { usePartnerSettlementReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import {
  currentMonthKey,
  downloadTextFile,
  monthKeyMonthsAgo,
  monthKeyToFromDate,
  monthKeyToToDate,
} from "./driverIncomeExport";
import {
  buildPartnerSettlementCsv,
  filterPartnerSettlementByMonths,
} from "./partnerSettlementExport";

function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function NetBalanceLabel({
  amount,
  partnerPaysYouLabel,
  youPayPartnerLabel,
  balancedLabel,
}: {
  amount: number;
  partnerPaysYouLabel: (v: string) => string;
  youPayPartnerLabel: (v: string) => string;
  balancedLabel: string;
}) {
  if (amount > 0) {
    return <span className="crm-partner-settlement__net--positive">{partnerPaysYouLabel(formatMoney(amount))}</span>;
  }
  if (amount < 0) {
    return (
      <span className="crm-partner-settlement__net--negative">
        {youPayPartnerLabel(formatMoney(Math.abs(amount)))}
      </span>
    );
  }
  return <span className="crm-partner-settlement__net--zero">{balancedLabel}</span>;
}

function MonthBlock({
  section,
  monthLabel,
  locale,
  t,
}: {
  section: PartnerSettlementMonth;
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
            <span className="crm-partner-settlement__col-label">{t("reports.partnerOwesYou")}</span>
            <strong>{formatMoney(section.partnerOwesYou)}</strong>
          </span>
          <span className="crm-partner-settlement__col crm-partner-settlement__col--out">
            <span className="crm-partner-settlement__col-label">{t("reports.youOwePartner")}</span>
            <strong>{formatMoney(section.youOwePartner)}</strong>
          </span>
          <span className="crm-partner-settlement__col crm-partner-settlement__col--net">
            <span className="crm-partner-settlement__col-label">{t("reports.partnerNet")}</span>
            <NetBalanceLabel
              amount={section.netBalance}
              partnerPaysYouLabel={(v) => t("reports.partnerPaysYou", { amount: v })}
              youPayPartnerLabel={(v) => t("reports.youPayPartner", { amount: v })}
              balancedLabel={t("reports.partnerBalanced")}
            />
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
              <div className="crm-partner-settlement__group-title">{t("reports.partnerPaymentsTitle")}</div>
              <ul className="crm-partner-settlement__lines">
                {section.payments.map((line) => (
                  <li key={line.id} className="crm-partner-settlement__line">
                    <span className="crm-partner-settlement__line-date">
                      {formatShortDate(line.date, locale)}
                    </span>
                    <span className="crm-partner-settlement__line-desc">{line.description}</span>
                    <span className="crm-partner-settlement__line-amount">{formatMoney(line.amount)}</span>
                    <span
                      className={`crm-partner-settlement__line-status${line.settled ? " crm-partner-settlement__line-status--settled" : ""}`}
                    >
                      {line.settled ? t("finance.partnerSettled") : t("reports.partnerOpen")}
                    </span>
                  </li>
                ))}
              </ul>
              {section.partnerOwesYouUnsettled > 0 ? (
                <p className="crm-form-hint crm-partner-settlement__unsettled">
                  {t("reports.partnerUnsettledPayments", {
                    amount: formatMoney(section.partnerOwesYouUnsettled),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {section.expenses.length > 0 ? (
            <div className="crm-partner-settlement__group">
              <div className="crm-partner-settlement__group-title">{t("reports.partnerExpensesTitle")}</div>
              <ul className="crm-partner-settlement__lines">
                {section.expenses.map((line) => (
                  <li key={line.id} className="crm-partner-settlement__line">
                    <span className="crm-partner-settlement__line-date">
                      {formatShortDate(line.date, locale)}
                    </span>
                    <span className="crm-partner-settlement__line-desc">{line.description}</span>
                    <span className="crm-partner-settlement__line-amount">{formatMoney(line.amount)}</span>
                    <span
                      className={`crm-partner-settlement__line-status${line.settled ? " crm-partner-settlement__line-status--settled" : ""}`}
                    >
                      {line.settled ? t("finance.partnerSettled") : t("reports.partnerOpen")}
                    </span>
                  </li>
                ))}
              </ul>
              {section.youOwePartnerUnsettled > 0 ? (
                <p className="crm-form-hint crm-partner-settlement__unsettled">
                  {t("reports.partnerUnsettledExpenses", {
                    amount: formatMoney(section.youOwePartnerUnsettled),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PartnerSettlementCard() {
  const { t, i18n } = useTranslation();
  const [fromMonth, setFromMonth] = useState(() => monthKeyMonthsAgo(2));
  const [toMonth, setToMonth] = useState(() => currentMonthKey());
  const [applied, setApplied] = useState(() => ({
    from: monthKeyToFromDate(monthKeyMonthsAgo(2)),
    to: monthKeyToToDate(currentMonthKey()),
  }));
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const report = usePartnerSettlementReport(applied.from, applied.to);
  const data = report.data;

  useEffect(() => {
    if (!data) return;
    setSelectedMonths(new Set(data.months.map((m) => m.month)));
  }, [data?.from, data?.to]);

  const visibleReport = useMemo(
    () => (data ? filterPartnerSettlementByMonths(data, selectedMonths) : null),
    [data, selectedMonths],
  );

  const monthLabel = (monthKey: string) =>
    formatFinanceMonthLabel(monthKey, i18n.language);

  function applyRange() {
    if (fromMonth > toMonth) {
      showAlert(t("reports.accountantInvalidRange"));
      return;
    }
    setApplied({
      from: monthKeyToFromDate(fromMonth),
      to: monthKeyToToDate(toMonth),
    });
  }

  function applyPreset(monthsBack: number) {
    const from = monthKeyMonthsAgo(monthsBack);
    const to = currentMonthKey();
    setFromMonth(from);
    setToMonth(to);
    setApplied({ from: monthKeyToFromDate(from), to: monthKeyToToDate(to) });
  }

  function toggleMonth(month: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function selectAllMonths() {
    if (!data) return;
    setSelectedMonths(new Set(data.months.map((m) => m.month)));
  }

  function buildCsv(): string | null {
    if (!visibleReport || visibleReport.months.length === 0) return null;
    return buildPartnerSettlementCsv(visibleReport, {
      month: t("reports.accountantMonth"),
      type: t("reports.partnerCsvType"),
      date: t("reports.partnerCsvDate"),
      description: t("reports.partnerCsvDescription"),
      amount: t("reports.accountantTotal"),
      settled: t("finance.partnerSettled"),
      partnerOwesYou: t("reports.partnerOwesYou"),
      youOwePartner: t("reports.youOwePartner"),
      netBalance: t("reports.partnerNet"),
      payment: t("reports.partnerPaymentsTitle"),
      expense: t("reports.partnerExpensesTitle"),
      yes: t("common.yes"),
      no: t("common.no"),
      grandTotal: t("reports.accountantGrandTotal"),
      monthLabel,
      formatDate: (iso) => formatShortDate(iso, i18n.language),
    });
  }

  async function copyCsv() {
    const csv = buildCsv();
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      showAlert(t("reports.accountantCopied"));
    } catch {
      showAlert(t("common.error"));
    }
  }

  function downloadCsv() {
    const csv = buildCsv();
    if (!csv) return;
    const months = [...selectedMonths].sort();
    const from = months[0] ?? fromMonth;
    const to = months[months.length - 1] ?? toMonth;
    downloadTextFile(`partner-settlement_${from}_${to}.csv`, csv);
  }

  const availableMonths = data?.months ?? [];

  return (
    <section className="crm-report-glass crm-report-section crm-partner-settlement">
      <div className="crm-report-section__head">
        <div className="crm-report-section__avatar crm-report-section__avatar--partner">
          <Icon name="wallet-01" size={28} color="#ffb300" />
        </div>
        <div className="crm-report-section__titles">
          <h3 className="crm-report-section__title">{t("reports.partnerTitle")}</h3>
          <p className="crm-report-section__subtitle">{t("reports.partnerSubtitle")}</p>
        </div>
      </div>

      <div className="crm-driver-income-report__range">
        <div className="crm-driver-income-report__range-fields">
          <label className="crm-month-field">
            <span className="crm-month-field__label">{t("reports.accountantFromMonth")}</span>
            <input
              type="month"
              className="crm-month-field__input"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
            />
          </label>
          <label className="crm-month-field">
            <span className="crm-month-field__label">{t("reports.accountantToMonth")}</span>
            <input
              type="month"
              className="crm-month-field__input"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
            />
          </label>
        </div>
        <div className="crm-report-filters__presets crm-driver-income-report__presets">
          <button type="button" className="crm-report-preset" onClick={() => applyPreset(0)}>
            {t("reports.presetThisMonth")}
          </button>
          <button type="button" className="crm-report-preset" onClick={() => applyPreset(2)}>
            {t("reports.preset3Months")}
          </button>
          <button type="button" className="crm-report-preset" onClick={() => applyPreset(5)}>
            {t("reports.preset6Months")}
          </button>
        </div>
        <button
          type="button"
          className="crm-report-apply crm-driver-income-report__apply"
          onClick={applyRange}
          disabled={report.isFetching}
        >
          <Icon name="chart-bar-line" size={20} color="#fff" />
          <span>{t("reports.partnerCalculate")}</span>
        </button>
      </div>

      {availableMonths.length > 0 ? (
        <div className="crm-driver-income-report__month-pick">
          <div className="crm-driver-income-report__month-pick-head">
            <span className="crm-driver-income-report__month-pick-label">
              {t("reports.accountantPickMonths")}
            </span>
            <button type="button" className="crm-driver-income-report__select-all" onClick={selectAllMonths}>
              {t("reports.accountantSelectAllMonths")}
            </button>
          </div>
          <div className="crm-driver-income-report__month-chips">
            {availableMonths.map((section) => {
              const active = selectedMonths.has(section.month);
              return (
                <button
                  key={section.month}
                  type="button"
                  className={`crm-driver-income-report__month-chip${active ? " crm-driver-income-report__month-chip--active" : ""}`}
                  onClick={() => toggleMonth(section.month)}
                >
                  {monthLabel(section.month)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="crm-driver-income-report__actions">
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={() => void copyCsv()}
          disabled={!visibleReport || visibleReport.months.length === 0 || report.isFetching}
        >
          <Icon name="clipboard" size={16} color="#ffc107" />
          <span>{t("reports.accountantCopy")}</span>
        </button>
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={downloadCsv}
          disabled={!visibleReport || visibleReport.months.length === 0 || report.isFetching}
        >
          <Icon name="download-01" size={16} color="#82b1ff" />
          <span>{t("reports.accountantDownload")}</span>
        </button>
      </div>

      <div className="crm-report-section__body crm-partner-settlement__body">
        {report.isLoading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : !data || data.months.length === 0 ? (
          <div className="crm-report-section__empty">
            <div className="crm-report-section__empty-icon">
              <Icon name="wallet-01" size={28} color="rgba(255,255,255,0.7)" />
            </div>
            <div>
              <div className="crm-report-section__empty-title">{t("reports.partnerEmptyTitle")}</div>
              <div className="crm-report-section__empty-subtitle">{t("reports.partnerEmpty")}</div>
            </div>
          </div>
        ) : !visibleReport || visibleReport.months.length === 0 ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsSelected")}</p>
          </div>
        ) : (
          <>
            <div className="crm-partner-settlement__grand glass-card">
              <div className="crm-partner-settlement__grand-row">
                <span>{t("reports.partnerOwesYou")}</span>
                <strong>{formatMoney(visibleReport.totals.partnerOwesYou)}</strong>
              </div>
              <div className="crm-partner-settlement__grand-row">
                <span>{t("reports.youOwePartner")}</span>
                <strong>{formatMoney(visibleReport.totals.youOwePartner)}</strong>
              </div>
              <div className="crm-partner-settlement__grand-row crm-partner-settlement__grand-row--net">
                <span>{t("reports.partnerNet")}</span>
                <NetBalanceLabel
                  amount={visibleReport.totals.netBalance}
                  partnerPaysYouLabel={(v) => t("reports.partnerPaysYou", { amount: v })}
                  youPayPartnerLabel={(v) => t("reports.youPayPartner", { amount: v })}
                  balancedLabel={t("reports.partnerBalanced")}
                />
              </div>
              {(visibleReport.totals.partnerOwesYouUnsettled > 0 ||
                visibleReport.totals.youOwePartnerUnsettled > 0) && (
                <p className="crm-form-hint crm-partner-settlement__grand-hint">
                  {t("reports.partnerStillOpen", {
                    partnerOwes: formatMoney(visibleReport.totals.partnerOwesYouUnsettled),
                    youOwe: formatMoney(visibleReport.totals.youOwePartnerUnsettled),
                  })}
                </p>
              )}
            </div>

            <div className="crm-partner-settlement__months">
              {visibleReport.months.map((section) => (
                <MonthBlock
                  key={section.month}
                  section={section}
                  monthLabel={monthLabel(section.month)}
                  locale={i18n.language}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
