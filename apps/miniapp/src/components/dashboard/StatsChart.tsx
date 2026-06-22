import { useTranslation } from "react-i18next";
import { formatMoney } from "../ui";
import { Icon } from "../crm";
import type { ReportSummary } from "@taxi/shared";

/**
 * A small, dependency-free bar chart that summarises fleet numbers on the
 * dashboard. Renders one row per car with paired income / expense bars,
 * so the user can spot which car is earning vs. costing at a glance.
 *
 * Why pure CSS bars (no recharts/chart.js/d3)?
 *   - The whole UI already leans on CSS shapes and gradients, adding a
 *     charting library would double the bundle for a single visualisation.
 *   - The data is small (one bar pair per car) so DOM rendering is cheap.
 *   - Numbers live in the `byCar` rows on the report summary we already
 *     pull, so no new API call is needed.
 */
export function StatsChart(props: { rows: ReportSummary["byCar"] }) {
  const { t } = useTranslation();
  const rows = props.rows;

  if (!rows.length) {
    return (
      <div className="crm-stats-chart__empty">
        <Icon name="chart-increase" size={28} color="var(--taxi-text-muted)" />
        <p className="crm-form-hint">{t("dashboard.chartEmpty")}</p>
      </div>
    );
  }

  // Sort by profit descending so the most successful car is at the top —
  // this is what the owner typically wants to see first. Cars with no
  // activity still show up because they're sorted by profit (0) too.
  const sorted = [...rows].sort((a, b) => b.profit - a.profit);
  const max = Math.max(
    1,
    ...sorted.map((r) => Math.max(r.income, r.expenses)),
  );

  return (
    <ul className="crm-stats-chart">
      {sorted.map((row) => {
        const incomeWidth = (row.income / max) * 100;
        const expenseWidth = (row.expenses / max) * 100;
        const tone =
          row.profit > 0 ? "profit" : row.profit < 0 ? "loss" : "neutral";
        return (
          <li key={row.carId} className={`crm-stats-chart__row crm-stats-chart__row--${tone}`}>
            <div className="crm-stats-chart__label">{row.label}</div>
            <div className="crm-stats-chart__bars">
              <div className="crm-stats-chart__line">
                <span className="crm-stats-chart__caption">{t("dashboard.income")}</span>
                <div className="crm-stats-chart__bar crm-stats-chart__bar--income">
                  <div
                    className="crm-stats-chart__bar-fill"
                    style={{ width: `${incomeWidth}%` }}
                  />
                </div>
                <span className="crm-stats-chart__value">{formatMoney(row.income)}</span>
              </div>
              <div className="crm-stats-chart__line">
                <span className="crm-stats-chart__caption">{t("dashboard.expenses")}</span>
                <div className="crm-stats-chart__bar crm-stats-chart__bar--expense">
                  <div
                    className="crm-stats-chart__bar-fill"
                    style={{ width: `${expenseWidth}%` }}
                  />
                </div>
                <span className="crm-stats-chart__value">{formatMoney(row.expenses)}</span>
              </div>
              <div className="crm-stats-chart__profit">
                {t("dashboard.profit")}:{" "}
                <strong className={`crm-stats-chart__profit-value crm-stats-chart__profit-value--${tone}`}>
                  {formatMoney(row.profit)}
                </strong>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
