import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCars, useExpenses, usePayments } from "../../hooks";
import { Icon } from "../crm";
import { formatFinanceMonthLabel } from "../finance/FinanceUi";
import { formatMoney } from "../ui";
import {
  fatherMonthKeysInRange,
  sumFatherInMonths,
  toggleFatherCar,
  type FatherTotals,
} from "./fatherReport";
import { ReportYearMonthPicker } from "./ReportYearMonthPicker";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import { useReportYearMonths } from "./useReportYearMonths";

function SimpleTotalsTable(props: {
  title: string;
  colA: string;
  colB: string;
  colSum: string;
  values: FatherTotals;
  pick: (row: FatherTotals) => { a: number; b: number; sum: number };
}) {
  const v = props.pick(props.values);
  return (
    <div className="crm-father-report__table-block">
      <div className="crm-father-report__table-title">{props.title}</div>
      <div className="crm-driver-income-report__table-wrap">
        <table className="crm-driver-income-report__table crm-father-report__table">
          <thead>
            <tr>
              <th>{props.colA}</th>
              <th>{props.colB}</th>
              <th>{props.colSum}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="crm-father-report__row--total">
              <td>{formatMoney(v.a)}</td>
              <td>{formatMoney(v.b)}</td>
              <td className="crm-driver-income-report__total-cell">{formatMoney(v.sum)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One amount only — Max+Oleh income / expenses (no Cash·Bank or Partner·My split). */
function SingleTotalBlock(props: { title: string; amount: number }) {
  return (
    <div className="crm-father-report__table-block">
      <div className="crm-father-report__table-title">{props.title}</div>
      <div className="crm-father-report__single-total">{formatMoney(props.amount)}</div>
    </div>
  );
}

/**
 * “For Father”: year/months → all-cars income/expenses → Max+Oleh car pick →
 * selected-cars income/expenses.
 */
export function FatherReportCard() {
  const { t, i18n } = useTranslation();
  const cars = useCars();
  const payments = usePayments();
  const expenses = useExpenses();
  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const {
    year,
    changeYear,
    applied,
    selectedMonths,
    syncAvailableMonths,
    toggleMonth,
    selectAllMonths,
  } = useReportYearMonths();

  const carList = cars.data ?? [];
  const paymentList = payments.data ?? [];
  const expenseList = expenses.data ?? [];
  const loading = cars.isLoading || payments.isLoading || expenses.isLoading;

  const monthKeys = useMemo(
    () => fatherMonthKeysInRange(paymentList, expenseList, applied.from, applied.to),
    [paymentList, expenseList, applied.from, applied.to],
  );

  useEffect(() => {
    syncAvailableMonths(monthKeys);
  }, [applied.from, applied.to, monthKeys.join("|")]);

  const allCarsTotals = useMemo(
    () => sumFatherInMonths(paymentList, expenseList, selectedMonths, null),
    [paymentList, expenseList, selectedMonths],
  );

  const selectedTotals = useMemo(
    () =>
      sumFatherInMonths(
        paymentList,
        expenseList,
        selectedMonths,
        new Set(selectedCars),
      ),
    [paymentList, expenseList, selectedCars, selectedMonths],
  );

  const hasAssignment = selectedCars.length > 0;
  const hasMonths = selectedMonths.size > 0;
  const monthLabel = (monthKey: string) =>
    formatFinanceMonthLabel(monthKey, i18n.language);

  return (
    <CollapsibleReportBlock
      storageKey="reports-father"
      className="crm-father-report"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--father"
          icon={<Icon name="user" size={28} color="#ffb74d" />}
          title={t("reports.fatherTitle")}
          subtitle={t("reports.fatherSubtitle")}
        />
      }
    >
      <div className="crm-father-report__body">
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

        {loading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : monthKeys.length === 0 ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsInYear", { year })}</p>
          </div>
        ) : !hasMonths ? (
          <div className="crm-report-section__empty">
            <p className="crm-form-hint">{t("reports.accountantNoMonthsSelected")}</p>
          </div>
        ) : (
          <>
            <SimpleTotalsTable
              title={t("reports.fatherIncomeAllCars")}
              colA={t("finance.CASH")}
              colB={t("finance.BANK")}
              colSum={t("common.total")}
              values={allCarsTotals}
              pick={(row) => ({ a: row.incomeCash, b: row.incomeBank, sum: row.incomeSum })}
            />
            <SimpleTotalsTable
              title={t("reports.fatherExpensesAllCars")}
              colA={t("reports.fatherExpensePartner")}
              colB={t("reports.fatherExpenseMine")}
              colSum={t("common.total")}
              values={allCarsTotals}
              pick={(row) => ({ a: row.expensePartner, b: row.expenseMine, sum: row.expenseSum })}
            />

            <section className="crm-father-report__ownership">
              <div className="crm-father-report__table-title">{t("reports.fatherWhoOwns")}</div>
              <p className="crm-form-hint crm-father-report__hint">{t("reports.fatherWhoOwnsHint")}</p>
              <div className="crm-father-report__owner-badge">
                {t("reports.fatherMax")} + {t("reports.fatherOleh")}
              </div>
              <div className="crm-father-report__car-list crm-father-report__car-list--shared">
                {carList.length === 0 && !cars.isLoading ? (
                  <p className="crm-form-hint">{t("reports.fatherNoCars")}</p>
                ) : (
                  carList.map((c) => {
                    const checked = selectedCars.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`crm-father-report__car-chip${checked ? " crm-father-report__car-chip--active" : ""}`}
                        onClick={() => setSelectedCars((prev) => toggleFatherCar(c.id, prev))}
                      >
                        <span className={`crm-filter-check${checked ? " crm-filter-check--on" : ""}`} aria-hidden>
                          {checked ? "✓" : ""}
                        </span>
                        <span>{c.plate}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {!hasAssignment ? (
              <div className="crm-report-section__empty">
                <div className="crm-report-section__empty-icon">
                  <Icon name="car-01" size={28} color="rgba(255,255,255,0.7)" />
                </div>
                <div>
                  <div className="crm-report-section__empty-title">{t("reports.fatherPickCarsTitle")}</div>
                  <div className="crm-report-section__empty-subtitle">{t("reports.fatherPickCars")}</div>
                </div>
              </div>
            ) : (
              <>
                <SingleTotalBlock
                  title={t("reports.fatherIncomeSelected")}
                  amount={selectedTotals.incomeSum}
                />
                <SingleTotalBlock
                  title={t("reports.fatherExpensesSelected")}
                  amount={selectedTotals.expenseSum}
                />
              </>
            )}
          </>
        )}
      </div>
    </CollapsibleReportBlock>
  );
}
