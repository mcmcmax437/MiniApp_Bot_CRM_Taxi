import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DriverIncomeReport } from "@taxi/shared";
import { useDriverIncomeReport } from "../../hooks";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import {
  amountForChannel,
  buildAccountantEmailText,
  buildDriverIncomeCsv,
  downloadTextFile,
  filterDriverIncomeByMonths,
  type AccountantMoneyChannel,
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

const CHANNELS: AccountantMoneyChannel[] = ["both", "cash", "bank"];

export function DriverIncomeReportCard() {
  const { t, i18n } = useTranslation();
  const [channel, setChannel] = useState<AccountantMoneyChannel>("both");
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
    [data?.from, data?.to],
  );

  useEffect(() => {
    if (!data) return;
    syncAvailableMonths(monthKeys);
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

  const hasRows = Boolean(visibleReport && visibleReport.months.length > 0);
  const actionsDisabled = !hasRows || report.isFetching;

  function buildCsv(): string | null {
    if (!visibleReport || visibleReport.months.length === 0) return null;
    return buildDriverIncomeCsv(visibleReport, csvLabels, channel);
  }

  function buildEmail(): string | null {
    if (!visibleReport || visibleReport.months.length === 0) return null;
    return buildAccountantEmailText(visibleReport, {
      channel,
      monthLabel,
      driverLabel: (name, id) => driverDisplayName(name, id, t("reports.unassignedDriver")),
      formatAmount: formatMoney,
      template: {
        greeting: t("reports.accountantEmailGreeting"),
        intro: t("reports.accountantEmailIntro"),
        driversHeading: t("reports.accountantEmailDriversHeading"),
        thanks: t("reports.accountantEmailThanks"),
        signature: t("reports.accountantEmailSignature"),
      },
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

  async function copyEmail() {
    const text = buildEmail();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showAlert(t("reports.accountantEmailCopied"));
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

      <div className="crm-driver-income-report__channel">
        <span className="crm-driver-income-report__channel-label">
          {t("reports.accountantShowMoney")}
        </span>
        <div className="crm-period-toggle crm-period-toggle--triple" role="group">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              className={`crm-period-toggle__btn${channel === c ? " crm-period-toggle__btn--active" : ""}`}
              onClick={() => setChannel(c)}
            >
              {t(`reports.accountantChannel_${c}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="crm-driver-income-report__actions">
        <button
          type="button"
          className="crm-btn-primary crm-driver-income-report__btn"
          onClick={() => void copyEmail()}
          disabled={actionsDisabled}
        >
          <Icon name="clipboard" size={16} color="#fff" />
          <span>{t("reports.accountantCopyEmail")}</span>
        </button>
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={() => void copyCsv()}
          disabled={actionsDisabled}
        >
          <Icon name="clipboard" size={16} color="#ffc107" />
          <span>{t("reports.accountantCopy")}</span>
        </button>
        <button
          type="button"
          className="crm-btn-outline crm-driver-income-report__btn"
          onClick={downloadCsv}
          disabled={actionsDisabled}
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
                channel={channel}
              />
            ))}
            <GrandTotalRow
              totals={visibleReport.grandTotals}
              label={t("reports.accountantGrandTotal")}
              channel={channel}
            />
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
  channel: AccountantMoneyChannel;
}) {
  const { t } = useTranslation();
  const showCash = props.channel === "both" || props.channel === "cash";
  const showBank = props.channel === "both" || props.channel === "bank";
  const showTotal = props.channel === "both";

  return (
    <div className="crm-driver-income-report__month">
      <div className="crm-driver-income-report__month-title">{props.monthLabel}</div>
      <div className="crm-driver-income-report__table-wrap">
        <table className="crm-driver-income-report__table">
          <thead>
            <tr>
              <th>{t("reports.accountantDriver")}</th>
              <th>{t("drivers.pesel")}</th>
              {showCash ? <th>{t("finance.CASH")}</th> : null}
              {showBank ? <th>{t("finance.BANK")}</th> : null}
              {showTotal ? <th>{t("reports.accountantTotal")}</th> : null}
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
                  {showCash ? <td>{formatMoney(row.cash)}</td> : null}
                  {showBank ? <td>{formatMoney(row.bank)}</td> : null}
                  {showTotal ? (
                    <td className="crm-driver-income-report__total-cell">{formatMoney(row.total)}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{t("reports.accountantMonthTotal")}</td>
              {showCash ? (
                <td className={!showTotal ? "crm-driver-income-report__total-cell" : undefined}>
                  {formatMoney(props.section.totals.cash)}
                </td>
              ) : null}
              {showBank ? (
                <td className={!showTotal ? "crm-driver-income-report__total-cell" : undefined}>
                  {formatMoney(props.section.totals.bank)}
                </td>
              ) : null}
              {showTotal ? (
                <td className="crm-driver-income-report__total-cell">
                  {formatMoney(props.section.totals.total)}
                </td>
              ) : null}
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
  channel: AccountantMoneyChannel;
}) {
  const { t } = useTranslation();
  const showCash = props.channel === "both" || props.channel === "cash";
  const showBank = props.channel === "both" || props.channel === "bank";

  return (
    <div className="crm-driver-income-report__grand">
      <div className="crm-driver-income-report__grand-label">{props.label}</div>
      <div className="crm-driver-income-report__grand-values">
        {showCash ? (
          <span>
            {t("finance.CASH")}: <strong>{formatMoney(props.totals.cash)}</strong>
          </span>
        ) : null}
        {showBank ? (
          <span>
            {t("finance.BANK")}: <strong>{formatMoney(props.totals.bank)}</strong>
          </span>
        ) : null}
        <span className="crm-driver-income-report__grand-total">
          {t("reports.accountantTotal")}:{" "}
          <strong>{formatMoney(amountForChannel(props.totals, props.channel))}</strong>
        </span>
      </div>
    </div>
  );
}
