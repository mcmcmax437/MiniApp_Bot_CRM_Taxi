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

function signedNet(amount: number): { text: string; tone: "plus" | "minus" | "zero" } {
  const abs = formatMoney(Math.abs(amount));
  if (amount > 0.005) return { text: `+${abs}`, tone: "plus" };
  if (amount < -0.005) return { text: `-${abs}`, tone: "minus" };
  return { text: abs, tone: "zero" };
}

function MonthSheetTable(props: { sheet: MonthSheet; title: string }) {
  const { t } = useTranslation();
  const s = props.sheet;
  const net = signedNet(s.net);
  return (
    <div className="crm-month-sheet">
      <div className="crm-month-sheet__title">{props.title}</div>
      <div className="crm-month-sheet__grid">
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head" />
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head crm-month-sheet__head--in">
          {t("reports.monthSheetIncome")}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head" />
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head crm-month-sheet__head--out">
          {t("reports.monthSheetExpenses")}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head crm-month-sheet__head--partner">
          {t("reports.monthSheetPartner")}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__cell--head crm-month-sheet__head--net">
          {t("reports.monthSheetNet")}
        </div>

        <div className="crm-month-sheet__cell crm-month-sheet__cell--label">{t("reports.monthSheetCashMine")}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--in">{formatMoney(s.cashMine)}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__who">{t("reports.monthSheetWhoPartner")}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--out crm-month-sheet__span-exp">
          {formatMoney(s.expensePartner)}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--partner crm-month-sheet__span-partner">
          {formatMoney(s.partnerNet)}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__net-label crm-month-sheet__span-label">
          {t("reports.monthSheetNet")}
        </div>

        <div className="crm-month-sheet__cell crm-month-sheet__cell--label">{t("reports.monthSheetCashPartner")}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--in">{formatMoney(s.cashPartner)}</div>
        <div className="crm-month-sheet__cell" />

        <div className="crm-month-sheet__cell crm-month-sheet__cell--label">{t("reports.monthSheetBank")}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--in">{formatMoney(s.bankIncome)}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__who">{t("reports.monthSheetWhoMine")}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__money--out">{formatMoney(s.expenseMine)}</div>
        <div className={`crm-month-sheet__cell crm-month-sheet__money--${net.tone} crm-month-sheet__span-net`}>
          {net.text}
        </div>

        <div className="crm-month-sheet__cell crm-month-sheet__cell--label crm-month-sheet__sum">
          {t("reports.monthSheetSum")}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__sum">{formatMoney(s.incomeSum)}</div>
        <div className="crm-month-sheet__cell crm-month-sheet__who crm-month-sheet__sum">
          {t("reports.monthSheetSum")}
        </div>
        <div className="crm-month-sheet__cell crm-month-sheet__sum">{formatMoney(s.expenseSum)}</div>
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
