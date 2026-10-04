import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useExpenses, usePayments } from "../../hooks";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import { monthSheetKeys, sumMonthSheet, type MonthSheet } from "./monthSheet";
import { ReportYearMonthPicker } from "./ReportYearMonthPicker";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import { useReportYearMonths } from "./useReportYearMonths";

function moneyCell(amount: number, tone: "in" | "out" | "partner" | "net" | "sum") {
  return <td className={`crm-month-sheet__money crm-month-sheet__money--${tone}`}>{formatMoney(amount)}</td>;
}

function signedNetCell(amount: number, rowSpan?: number) {
  const abs = formatMoney(Math.abs(amount));
  const positive = amount > 0.005;
  const negative = amount < -0.005;
  const text = positive ? `+${abs}` : negative ? `-${abs}` : abs;
  const tone = positive ? "plus" : negative ? "minus" : "zero";
  return (
    <td className={`crm-month-sheet__money crm-month-sheet__money--${tone}`} rowSpan={rowSpan}>
      {text}
    </td>
  );
}

function MonthSheetTable(props: { sheet: MonthSheet; title: string }) {
  const { t } = useTranslation();
  const s = props.sheet;
  return (
    <div className="crm-month-sheet">
      <div className="crm-month-sheet__title">{props.title}</div>
      <div className="crm-driver-income-report__table-wrap">
        <table className="crm-month-sheet__table">
          <thead>
            <tr>
              <th />
              <th className="crm-month-sheet__head--in">{t("reports.monthSheetIncome")}</th>
              <th />
              <th className="crm-month-sheet__head--out">{t("reports.monthSheetExpenses")}</th>
              <th className="crm-month-sheet__head--partner">{t("reports.monthSheetPartner")}</th>
              <th className="crm-month-sheet__head--net">{t("reports.monthSheetNet")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t("reports.monthSheetCashMine")}</th>
              {moneyCell(s.cashMine, "in")}
              <td className="crm-month-sheet__who">{t("reports.monthSheetWhoPartner")}</td>
              <td className="crm-month-sheet__money crm-month-sheet__money--out" rowSpan={2}>
                {formatMoney(s.expensePartner)}
              </td>
              <td className="crm-month-sheet__span crm-month-sheet__money--partner" rowSpan={4}>
                {formatMoney(s.partnerNet)}
              </td>
              <td className="crm-month-sheet__span crm-month-sheet__net-label" rowSpan={2}>
                {t("reports.monthSheetNet")}
              </td>
            </tr>
            <tr>
              <th scope="row">{t("reports.monthSheetCashPartner")}</th>
              {moneyCell(s.cashPartner, "in")}
              <td />
            </tr>
            <tr>
              <th scope="row">{t("reports.monthSheetBank")}</th>
              {moneyCell(s.bankIncome, "in")}
              <td className="crm-month-sheet__who">{t("reports.monthSheetWhoMine")}</td>
              {moneyCell(s.expenseMine, "out")}
              {signedNetCell(s.net, 2)}
            </tr>
            <tr className="crm-month-sheet__sum">
              <th scope="row">{t("reports.monthSheetSum")}</th>
              {moneyCell(s.incomeSum, "sum")}
              <td className="crm-month-sheet__who">{t("reports.monthSheetSum")}</td>
              {moneyCell(s.expenseSum, "sum")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Monthly income / expense sheet: your cash, partner cash, bank, and the net left. */
export function MonthSheetCard() {
  const { t, i18n } = useTranslation();
  const payments = usePayments();
  const expenses = useExpenses();
  const [includeCarPurchases, setIncludeCarPurchases] = useState(false);
  const {
    year,
    changeYear,
    applied,
    selectedMonths,
    syncAvailableMonths,
    toggleMonth,
    selectAllMonths,
  } = useReportYearMonths();

  const paymentList = payments.data ?? [];
  const expenseList = expenses.data ?? [];
  const loading = payments.isLoading || expenses.isLoading;

  const monthKeys = useMemo(
    () => monthSheetKeys(paymentList, expenseList, applied.from, applied.to, includeCarPurchases),
    [paymentList, expenseList, applied.from, applied.to, includeCarPurchases],
  );

  useEffect(() => {
    syncAvailableMonths(monthKeys);
  }, [applied.from, applied.to, monthKeys.join("|")]);

  const sheets = useMemo(() => {
    return [...selectedMonths]
      .filter((key) => monthKeys.includes(key))
      .sort()
      .reverse()
      .map((key) => sumMonthSheet(paymentList, expenseList, key, includeCarPurchases));
  }, [paymentList, expenseList, selectedMonths, monthKeys, includeCarPurchases]);

  const monthLabel = (monthKey: string) => formatFinanceMonthLabel(monthKey, i18n.language);

  return (
    <CollapsibleReportBlock
      storageKey="reports-month-sheet"
      className="crm-month-sheet-card"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--month"
          icon={<Icon name="clipboard" size={28} color="#69f0ae" />}
          title={t("reports.monthSheetTitle")}
          subtitle={t("reports.monthSheetSubtitle")}
        />
      }
    >
      <div className="crm-month-sheet-card__body">
        <ReportYearMonthPicker
          year={year}
          onYearChange={changeYear}
          monthKeys={monthKeys}
          selectedMonths={selectedMonths}
          onToggleMonth={toggleMonth}
          onSelectAllMonths={() => selectAllMonths(monthKeys)}
          monthLabel={monthLabel}
          loading={loading}
        />

        <button
          type="button"
          className={`crm-month-sheet__purchase${includeCarPurchases ? " crm-month-sheet__purchase--on" : ""}`}
          aria-pressed={includeCarPurchases}
          onClick={() => setIncludeCarPurchases((on) => !on)}
        >
          <Icon name="car-01" size={18} color="currentColor" />
          <span>
            {includeCarPurchases
              ? t("reports.monthSheetExcludePurchase")
              : t("reports.monthSheetIncludePurchase")}
          </span>
        </button>

        {loading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : monthKeys.length === 0 ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsInYear", { year })}</p>
          </div>
        ) : selectedMonths.size === 0 ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsSelected")}</p>
          </div>
        ) : (
          sheets.map((sheet) => (
            <MonthSheetTable key={sheet.monthKey} sheet={sheet} title={monthLabel(sheet.monthKey)} />
          ))
        )}
      </div>
    </CollapsibleReportBlock>
  );
}
