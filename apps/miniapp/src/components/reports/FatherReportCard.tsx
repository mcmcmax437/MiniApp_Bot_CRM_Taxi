import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCars, useExpenses, usePayments } from "../../hooks";
import { Icon } from "../crm";
import { formatMoney } from "../ui";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import {
  assignFatherCar,
  sumFatherPersonTotals,
  sumFatherTotals,
  type FatherPersonId,
  type FatherPersonTotals,
} from "./fatherReport";

function TotalsTable(props: {
  title: string;
  colA: string;
  colB: string;
  colSum: string;
  maxLabel: string;
  olehLabel: string;
  totalLabel: string;
  max: FatherPersonTotals;
  oleh: FatherPersonTotals;
  total: FatherPersonTotals;
  pick: (row: FatherPersonTotals) => { a: number; b: number; sum: number };
}) {
  const rows: Array<{ label: string; values: FatherPersonTotals; strong?: boolean }> = [
    { label: props.maxLabel, values: props.max },
    { label: props.olehLabel, values: props.oleh },
    { label: props.totalLabel, values: props.total, strong: true },
  ];

  return (
    <div className="crm-father-report__table-block">
      <div className="crm-father-report__table-title">{props.title}</div>
      <div className="crm-driver-income-report__table-wrap">
        <table className="crm-driver-income-report__table crm-father-report__table">
          <thead>
            <tr>
              <th>{/* person */}</th>
              <th>{props.colA}</th>
              <th>{props.colB}</th>
              <th>{props.colSum}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const v = props.pick(row.values);
              return (
                <tr key={row.label} className={row.strong ? "crm-father-report__row--total" : undefined}>
                  <td>{row.label}</td>
                  <td>{formatMoney(v.a)}</td>
                  <td>{formatMoney(v.b)}</td>
                  <td className="crm-driver-income-report__total-cell">{formatMoney(v.sum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * “For Father” report: manually assign cars to Max / Oleh each time, then
 * see income (cash/bank) and expenses (partner/mine) for those cars in the
 * page date range.
 */
export function FatherReportCard(props: { from: string; to: string }) {
  const { t } = useTranslation();
  const cars = useCars();
  const payments = usePayments();
  const expenses = useExpenses();
  const [maxCars, setMaxCars] = useState<string[]>([]);
  const [olehCars, setOlehCars] = useState<string[]>([]);

  const carList = cars.data ?? [];
  const loading = cars.isLoading || payments.isLoading || expenses.isLoading;

  function onToggleCar(person: FatherPersonId, carId: string) {
    const next = assignFatherCar(person, carId, maxCars, olehCars);
    setMaxCars(next.maxCars);
    setOlehCars(next.olehCars);
  }

  const maxTotals = useMemo(
    () =>
      sumFatherPersonTotals(
        payments.data ?? [],
        expenses.data ?? [],
        new Set(maxCars),
        props.from,
        props.to,
      ),
    [payments.data, expenses.data, maxCars, props.from, props.to],
  );

  const olehTotals = useMemo(
    () =>
      sumFatherPersonTotals(
        payments.data ?? [],
        expenses.data ?? [],
        new Set(olehCars),
        props.from,
        props.to,
      ),
    [payments.data, expenses.data, olehCars, props.from, props.to],
  );

  const total = useMemo(() => sumFatherTotals(maxTotals, olehTotals), [maxTotals, olehTotals]);

  const maxLabel = t("reports.fatherMax");
  const olehLabel = t("reports.fatherOleh");
  const hasAssignment = maxCars.length > 0 || olehCars.length > 0;

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
        <section className="crm-father-report__ownership">
          <div className="crm-father-report__table-title">{t("reports.fatherWhoOwns")}</div>
          <p className="crm-form-hint crm-father-report__hint">{t("reports.fatherWhoOwnsHint")}</p>
          <div className="crm-father-report__owners">
            <div className="crm-father-report__owner-col">
              <div className="crm-father-report__owner-name">{maxLabel}</div>
              <div className="crm-father-report__car-list">
                {carList.length === 0 && !cars.isLoading ? (
                  <p className="crm-form-hint">{t("reports.fatherNoCars")}</p>
                ) : (
                  carList.map((c) => {
                    const checked = maxCars.includes(c.id);
                    return (
                      <button
                        key={`max-${c.id}`}
                        type="button"
                        className={`crm-father-report__car-chip${checked ? " crm-father-report__car-chip--active" : ""}`}
                        onClick={() => onToggleCar("max", c.id)}
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
            </div>
            <div className="crm-father-report__owner-col">
              <div className="crm-father-report__owner-name">{olehLabel}</div>
              <div className="crm-father-report__car-list">
                {carList.map((c) => {
                  const checked = olehCars.includes(c.id);
                  return (
                    <button
                      key={`oleh-${c.id}`}
                      type="button"
                      className={`crm-father-report__car-chip${checked ? " crm-father-report__car-chip--active" : ""}`}
                      onClick={() => onToggleCar("oleh", c.id)}
                    >
                      <span className={`crm-filter-check${checked ? " crm-filter-check--on" : ""}`} aria-hidden>
                        {checked ? "✓" : ""}
                      </span>
                      <span>{c.plate}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : !hasAssignment ? (
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
            <TotalsTable
              title={t("reports.fatherIncomeTitle")}
              colA={t("finance.CASH")}
              colB={t("finance.BANK")}
              colSum={t("common.total")}
              maxLabel={maxLabel}
              olehLabel={olehLabel}
              totalLabel={t("common.total")}
              max={maxTotals}
              oleh={olehTotals}
              total={total}
              pick={(row) => ({ a: row.incomeCash, b: row.incomeBank, sum: row.incomeSum })}
            />
            <TotalsTable
              title={t("reports.fatherExpensesTitle")}
              colA={t("reports.fatherExpensePartner")}
              colB={t("reports.fatherExpenseMine")}
              colSum={t("common.total")}
              maxLabel={maxLabel}
              olehLabel={olehLabel}
              totalLabel={t("common.total")}
              max={maxTotals}
              oleh={olehTotals}
              total={total}
              pick={(row) => ({ a: row.expensePartner, b: row.expenseMine, sum: row.expenseSum })}
            />
          </>
        )}
      </div>
    </CollapsibleReportBlock>
  );
}
