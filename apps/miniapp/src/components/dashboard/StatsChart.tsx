import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ReportSummary } from "@taxi/shared";
import { formatMoney } from "../ui";
import { Icon, type DashboardStatsPeriod } from "../crm";
import { DASHBOARD_FLEET_OTHER_CAR_ID } from "../../utils/dashboardStats";

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
 *
 * Each row is a clickable button that navigates to the car detail page
 * with `?finance=1`. That flag tells the detail page to auto-open the
 * monthly finance chart section, so the user lands directly on the data
 * they came from the dashboard to see.
 */
export function StatsChart(props: { rows: ReportSummary["byCar"]; period: DashboardStatsPeriod }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rows = props.rows;

  function openRow(row: ReportSummary["byCar"][number]) {
    if (row.carId === DASHBOARD_FLEET_OTHER_CAR_ID) {
      const params = new URLSearchParams({
        kind: "expenses",
        period: props.period,
        carId: DASHBOARD_FLEET_OTHER_CAR_ID,
      });
      navigate(`/stats?${params.toString()}`);
      return;
    }
    navigate(`/cars/${row.carId}?finance=1`);
  }

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
            <button
              type="button"
              className="crm-stats-chart__row-button"
              onClick={() => openRow(row)}
              aria-label={
                row.carId === DASHBOARD_FLEET_OTHER_CAR_ID
                  ? t("dashboard.chartFleetOtherOpen")
                  : t("dashboard.chartRowOpen", { label: row.label })
              }
            >
              <div className="crm-stats-chart__label">
                <span>{row.label}</span>
                <Icon
                  name="arrow-right-01"
                  size={14}
                  color="rgba(255,255,255,0.45)"
                />
              </div>
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
            </button>
          </li>
        );
      })}
    </ul>
  );
}
