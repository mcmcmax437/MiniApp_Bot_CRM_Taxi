import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DriverIncomeReport } from "@taxi/shared";
import { useDriverIncomeReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import {
  buildDriverIncomeCsv,
  downloadTextFile,
  filterDriverIncomeByMonths,
} from "./driverIncomeExport";
import { ReportYearMonthPicker } from "./ReportYearMonthPicker";
import { useReportYearMonths } from "./useReportYearMonths";

function driverDisplayName(
  name: string,
  driverId: string,
  unassignedLabel: string,
): string {
  if (!driverId) return unassignedLabel;
  return name || "—";
}

export function DriverIncomeReportCard() {
  const { t, i18n } = useTranslation();
  const {
    year,
    changeYear,
    applied,
    selectedMonths,
    syncAvailableMonths,
    toggleMonth,
    selectAllMonths,
  } = useReportYearMonths();

  const report = useDriverIncomeReport(applied.from, applied.to);
  const data = report.data;
  const monthKeys = useMemo(
    () => data?.months.map((m) => m.month) ?? [],
    [data?.months],
  );

  useEffect(() => {
    if (!data) return;
    syncAvailableMonths(monthKeys);
  }, [data, monthKeys, syncAvailableMonths]);

  const visibleReport = useMemo(
    () => (data ? filterDriverIncomeByMonths(data, selectedMonths) : null),
    [data, selectedMonths],
  );

  const monthLabel = (monthKey: string) =>
    formatFinanceMonthLabel(monthKey, i18n.language);

  const csvLabels = useMemo(
    () => ({
      month: t("reports.accountantMonth"),
      driver: t("reports.accountantDriver"),
      pesel: t("drivers.pesel"),
      passport: t("drivers.passportNumber"),
      address: t("reports.accountantAddress"),
      cash: t("finance.CASH"),
      bank: t("finance.BANK"),
      total: t("reports.accountantTotal"),
      monthTotal: t("reports.accountantMonthTotal"),
      grandTotal: t("reports.accountantGrandTotal"),
      unassignedDriver: t("reports.unassignedDriver"),
      driverLabel: (name: string, id: string) =>
        driverDisplayName(name, id, t("reports.unassignedDriver")),
      monthLabel,
    }),
    [t, i18n.language],
  );

  function buildCsv(): string | null {
    if (!visibleReport || visibleReport.months.length === 0) return null;
    return buildDriverIncomeCsv(visibleReport, csvLabels);
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
    downloadTextFile(`driver-income_${from}_${to}.csv`, csv);
  }

  return (
    <CollapsibleReportBlock
      storageKey="reports-driver-income"
      className="crm-driver-income-report"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--accountant"
          icon={<Icon name="clipboard" size={28} color="#26A69A" />}
          title={t("reports.accountantTitle")}
          subtitle={t("reports.accountantSubtitle")}
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

      <div className="crm-report-section__body crm-driver-income-report__body">
        {report.isLoading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : !data || data.months.length === 0 ? (
          <div className="crm-report-section__empty">
            <div className="crm-report-section__empty-icon">
              <Icon name="archive-01" size={28} color="rgba(255,255,255,0.7)" />
            </div>
            <div>
              <div className="crm-report-section__empty-title">{t("reports.emptyTitle")}</div>
              <div className="crm-report-section__empty-subtitle">
                {t("reports.accountantEmpty")}
              </div>
            </div>
          </div>
        ) : !visibleReport || visibleReport.months.length === 0 ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsSelected")}</p>
          </div>
        ) : (
          <div className="crm-driver-income-report__months">
            {visibleReport.months.map((section) => (
              <MonthBlock
                key={section.month}
                section={section}
                monthLabel={monthLabel(section.month)}
                unassignedLabel={t("reports.unassignedDriver")}
              />
            ))}
            <GrandTotalRow totals={visibleReport.grandTotals} label={t("reports.accountantGrandTotal")} />
          </div>
        )}
      </div>
    </CollapsibleReportBlock>
  );
}

function MonthBlock(props: {
  section: DriverIncomeReport["months"][number];
  monthLabel: string;
  unassignedLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="crm-driver-income-report__month">
      <div className="crm-driver-income-report__month-title">{props.monthLabel}</div>
      <div className="crm-driver-income-report__table-wrap">
        <table className="crm-driver-income-report__table">
          <thead>
            <tr>
              <th>{t("reports.accountantDriver")}</th>
              <th>{t("drivers.pesel")}</th>
              <th>{t("finance.CASH")}</th>
              <th>{t("finance.BANK")}</th>
              <th>{t("reports.accountantTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {props.section.drivers.map((row, idx) => {
              const name = driverDisplayName(row.driverName, row.driverId, props.unassignedLabel);
              const idDoc = row.pesel?.trim() || row.passportNumber?.trim() || "—";
              const idLabel = row.pesel?.trim()
                ? t("drivers.pesel")
                : row.passportNumber?.trim()
                  ? t("drivers.passportNumber")
                  : "";
              return (
                <tr key={`${props.section.month}-${row.driverId || `row-${idx}`}`}>
                  <td>
                    <div className="crm-driver-income-report__driver-cell">
                      <span className="crm-driver-income-report__driver-name">{name}</span>
                      {row.address ? (
                        <span className="crm-driver-income-report__driver-meta">{row.address}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="crm-driver-income-report__id-cell">
                      {idLabel ? (
                        <span className="crm-driver-income-report__id-kind">{idLabel}</span>
                      ) : null}
                      <span>{idDoc}</span>
                    </div>
                  </td>
                  <td>{formatMoney(row.cash)}</td>
                  <td>{formatMoney(row.bank)}</td>
                  <td className="crm-driver-income-report__total-cell">{formatMoney(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{t("reports.accountantMonthTotal")}</td>
              <td>{formatMoney(props.section.totals.cash)}</td>
              <td>{formatMoney(props.section.totals.bank)}</td>
              <td className="crm-driver-income-report__total-cell">
                {formatMoney(props.section.totals.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GrandTotalRow(props: {
  totals: DriverIncomeReport["grandTotals"];
  label: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="crm-driver-income-report__grand">
      <div className="crm-driver-income-report__grand-label">{props.label}</div>
      <div className="crm-driver-income-report__grand-values">
        <span>
          {t("finance.CASH")}: <strong>{formatMoney(props.totals.cash)}</strong>
        </span>
        <span>
          {t("finance.BANK")}: <strong>{formatMoney(props.totals.bank)}</strong>
        </span>
        <span className="crm-driver-income-report__grand-total">
          {t("reports.accountantTotal")}: <strong>{formatMoney(props.totals.total)}</strong>
        </span>
      </div>
    </div>
  );
}
