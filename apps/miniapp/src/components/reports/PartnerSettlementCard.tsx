import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PartnerSettlementMonth } from "@taxi/shared";
import { usePartnerSettlementReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import { formatDate } from "../../dates";
import { downloadTextFile } from "./driverIncomeExport";
import { PartnerMonthActivity } from "./PartnerMonthActivity";
import {
  buildPartnerSettlementCsv,
  filterPartnerSettlementByMonths,
} from "./partnerSettlementExport";
import { ReportYearMonthPicker } from "./ReportYearMonthPicker";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import { useReportYearMonths } from "./useReportYearMonths";

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
  t,
}: {
  section: PartnerSettlementMonth;
  monthLabel: string;
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
                      {formatDate(line.date)}
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
              {section.partnerCollectedTotal > section.partnerOwesYou ? (
                <p className="crm-form-hint crm-partner-settlement__unsettled">
                  {t("reports.partnerSettledPaymentsNote", {
                    total: formatMoney(section.partnerCollectedTotal),
                    settled: formatMoney(section.partnerCollectedTotal - section.partnerOwesYou),
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
                      {formatDate(line.date)}
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
              {section.partnerExpensesTotal > section.youOwePartner ? (
                <p className="crm-form-hint crm-partner-settlement__unsettled">
                  {t("reports.partnerSettledExpensesNote", {
                    total: formatMoney(section.partnerExpensesTotal),
                    settled: formatMoney(section.partnerExpensesTotal - section.youOwePartner),
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

type PartnerViewTab = "settlement" | "activity";

export function PartnerSettlementCard() {
  const { t, i18n } = useTranslation();
  const [viewTab, setViewTab] = useState<PartnerViewTab>("settlement");
  const {
    year,
    changeYear,
    applied,
    selectedMonths,
    syncAvailableMonths,
    toggleMonth,
    selectAllMonths,
  } = useReportYearMonths();

  const report = usePartnerSettlementReport(applied.from, applied.to);
  const data = report.data;
  const monthKeys = useMemo(
    () => data?.months.map((m) => m.month) ?? [],
    [data?.from, data?.to],
  );

  useEffect(() => {
    if (!data) return;
    syncAvailableMonths(monthKeys);
  }, [data?.from, data?.to]);

  const visibleReport = useMemo(
    () => (data ? filterPartnerSettlementByMonths(data, selectedMonths) : null),
    [data, selectedMonths],
  );

  const monthLabel = (monthKey: string) =>
    formatFinanceMonthLabel(monthKey, i18n.language);

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
      formatDate,
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
    const from = months[0] ?? `${year}-01`;
    const to = months[months.length - 1] ?? `${year}-12`;
    downloadTextFile(`partner-settlement_${from}_${to}.csv`, csv);
  }

  return (
    <CollapsibleReportBlock
      storageKey="reports-partner-settlement"
      className="crm-partner-settlement"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--partner"
          icon={<Icon name="wallet-01" size={28} color="#ffb300" />}
          title={t("reports.partnerTitle")}
          subtitle={t("reports.partnerSubtitle")}
        />
      }
    >
      <ReportYearMonthPicker
        year={year}
        onYearChange={changeYear}
        monthKeys={monthKeys}
        selectedMonths={selectedMonths}
        onToggleMonth={toggleMonth}
        onSelectAllMonths={() => selectAllMonths(monthKeys)}
        monthLabel={monthLabel}
        loading={report.isFetching}
      />

      <div className="crm-partner-settlement__tabs crm-period-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === "settlement"}
          className={`crm-period-toggle__btn${viewTab === "settlement" ? " crm-period-toggle__btn--active" : ""}`}
          onClick={() => setViewTab("settlement")}
        >
          {t("reports.partnerTabSettlement")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === "activity"}
          className={`crm-period-toggle__btn${viewTab === "activity" ? " crm-period-toggle__btn--active" : ""}`}
          onClick={() => setViewTab("activity")}
        >
          {t("reports.partnerTabActivity")}
        </button>
      </div>

      {viewTab === "settlement" ? (
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
      ) : null}

      <div className="crm-report-section__body crm-partner-settlement__body">
        {viewTab === "activity" ? (
          selectedMonths.size === 0 ? (
            <div className="crm-report-section__empty">
              <p className="crm-form-hint">{t("reports.accountantNoMonthsSelected")}</p>
            </div>
          ) : (
            <PartnerMonthActivity
              selectedMonths={selectedMonths}
              monthLabel={monthLabel}
              t={t}
            />
          )
        ) : report.isLoading ? (
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
              {(visibleReport.totals.partnerCollectedTotal > visibleReport.totals.partnerOwesYou ||
                visibleReport.totals.partnerExpensesTotal > visibleReport.totals.youOwePartner) && (
                <p className="crm-form-hint crm-partner-settlement__grand-hint">
                  {t("reports.partnerPeriodTotals", {
                    collected: formatMoney(visibleReport.totals.partnerCollectedTotal),
                    expenses: formatMoney(visibleReport.totals.partnerExpensesTotal),
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
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </CollapsibleReportBlock>
  );
}
