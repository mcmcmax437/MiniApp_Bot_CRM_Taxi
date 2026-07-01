import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DriverIncomeReport } from "@taxi/shared";
import { useDriverIncomeReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import { buildDriverIncomeCsv, downloadTextFile } from "./driverIncomeExport";

function driverDisplayName(
  name: string,
  driverId: string,
  unassignedLabel: string,
): string {
  if (!driverId) return unassignedLabel;
  return name || "—";
}

export function DriverIncomeReportCard(props: { from: string; to: string }) {
  const { t, i18n } = useTranslation();
  const report = useDriverIncomeReport(props.from, props.to);
  const data = report.data;

  const monthLabel = (monthKey: string) =>
    formatFinanceMonthLabel(monthKey, i18n.language);

  const csvLabels = useMemo(
    () => ({
      month: t("reports.accountantMonth"),
      driver: t("reports.accountantDriver"),
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
    if (!data || data.months.length === 0) return null;
    return buildDriverIncomeCsv(data, csvLabels);
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
    const from = props.from.slice(0, 7);
    const to = props.to.slice(0, 7);
    downloadTextFile(`driver-income_${from}_${to}.csv`, csv);
  }

  return (
    <section className="crm-report-glass crm-report-section crm-driver-income-report">
      <div className="crm-report-section__head">
        <div className="crm-report-section__avatar crm-report-section__avatar--accountant">
          <Icon name="clipboard" size={28} color="#26A69A" />
        </div>
        <div className="crm-report-section__titles">
          <h3 className="crm-report-section__title">{t("reports.accountantTitle")}</h3>
          <p className="crm-report-section__subtitle">{t("reports.accountantSubtitle")}</p>
        </div>
      </div>

      <div className="crm-driver-income-report__actions">
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={() => void copyCsv()}
          disabled={!data || data.months.length === 0 || report.isFetching}
        >
          <Icon name="clipboard" size={16} color="#ffc107" />
          <span>{t("reports.accountantCopy")}</span>
        </button>
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={downloadCsv}
          disabled={!data || data.months.length === 0 || report.isFetching}
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
        ) : (
          <div className="crm-driver-income-report__months">
            {data.months.map((section) => (
              <MonthBlock
                key={section.month}
                section={section}
                monthLabel={monthLabel(section.month)}
                unassignedLabel={t("reports.unassignedDriver")}
              />
            ))}
            <GrandTotalRow totals={data.grandTotals} label={t("reports.accountantGrandTotal")} />
          </div>
        )}
      </div>
    </section>
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
              <th>{t("finance.CASH")}</th>
              <th>{t("finance.BANK")}</th>
              <th>{t("reports.accountantTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {props.section.drivers.map((row, idx) => (
              <tr key={`${props.section.month}-${row.driverId || `row-${idx}`}`}>
                <td>{driverDisplayName(row.driverName, row.driverId, props.unassignedLabel)}</td>
                <td>{formatMoney(row.cash)}</td>
                <td>{formatMoney(row.bank)}</td>
                <td className="crm-driver-income-report__total-cell">{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t("reports.accountantMonthTotal")}</td>
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
