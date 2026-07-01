import { useTranslation } from "react-i18next";
import { selectableYears } from "./driverIncomeExport";

export function ReportYearMonthPicker(props: {
  year: number;
  onYearChange: (year: number) => void;
  monthKeys: string[];
  selectedMonths: Set<string>;
  onToggleMonth: (monthKey: string) => void;
  onSelectAllMonths: () => void;
  monthLabel: (monthKey: string) => string;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const years = selectableYears();

  return (
    <div className="crm-report-year-month-picker">
      <label className="crm-report-year-month-picker__year">
        <span className="crm-report-year-month-picker__label">{t("reports.accountantYear")}</span>
        <select
          className="crm-report-year-month-picker__select"
          value={props.year}
          disabled={props.loading}
          onChange={(e) => props.onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {props.monthKeys.length > 0 ? (
        <div className="crm-driver-income-report__month-pick crm-report-year-month-picker__months">
          <div className="crm-driver-income-report__month-pick-head">
            <span className="crm-driver-income-report__month-pick-label">
              {t("reports.accountantPickMonths")}
            </span>
            <button
              type="button"
              className="crm-driver-income-report__select-all"
              onClick={props.onSelectAllMonths}
            >
              {t("reports.accountantSelectAllMonths")}
            </button>
          </div>
          <div className="crm-driver-income-report__month-chips">
            {[...props.monthKeys].reverse().map((monthKey) => {
              const active = props.selectedMonths.has(monthKey);
              return (
                <button
                  key={monthKey}
                  type="button"
                  className={`crm-driver-income-report__month-chip${active ? " crm-driver-income-report__month-chip--active" : ""}`}
                  onClick={() => props.onToggleMonth(monthKey)}
                >
                  {props.monthLabel(monthKey)}
                </button>
              );
            })}
          </div>
        </div>
      ) : props.loading ? null : (
        <p className="crm-form-hint crm-report-year-month-picker__empty">
          {t("reports.accountantNoMonthsInYear", { year: props.year })}
        </p>
      )}
    </div>
  );
}
