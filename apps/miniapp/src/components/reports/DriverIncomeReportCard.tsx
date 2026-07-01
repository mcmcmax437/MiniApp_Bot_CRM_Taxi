import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DriverIncomeReport } from "@taxi/shared";
import { useDriverIncomeReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import {
  buildDriverIncomeCsv,
  currentMonthKey,
  downloadTextFile,
  filterDriverIncomeByMonths,
  monthKeyMonthsAgo,
  monthKeyToFromDate,
  monthKeyToToDate,
} from "./driverIncomeExport";

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
  const [fromMonth, setFromMonth] = useState(() => monthKeyMonthsAgo(5));
  const [toMonth, setToMonth] = useState(() => currentMonthKey());
  const [applied, setApplied] = useState(() => ({
    from: monthKeyToFromDate(monthKeyMonthsAgo(5)),
    to: monthKeyToToDate(currentMonthKey()),
  }));
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const report = useDriverIncomeReport(applied.from, applied.to);
  const data = report.data;

  // When a new range is loaded, select every month that has data.
  useEffect(() => {
    if (!data) return;
    setSelectedMonths(new Set(data.months.map((m) => m.month)));
  }, [data?.from, data?.to]);

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
    const from = months[0] ?? fromMonth;
    const to = months[months.length - 1] ?? toMonth;
    downloadTextFile(`driver-income_${from}_${to}.csv`, csv);
  }

  const availableMonths = data?.months ?? [];

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
          <button type="button" className="crm-report-preset" onClick={() => applyPreset(11)}>
            {t("reports.preset12Months")}
          </button>
        </div>
        <button
          type="button"
          className="crm-report-apply crm-driver-income-report__apply"
          onClick={applyRange}
          disabled={report.isFetching}
        >
          <Icon name="chart-bar-line" size={20} color="#fff" />
          <span>{t("reports.accountantLoadMonths")}</span>
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
