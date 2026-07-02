import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader, Icon } from "../components/crm";
import {
  expenseDisplaySubtitle,
  expenseDisplayTitle,
  paymentDisplaySubtitle,
  paymentDisplayTitle,
} from "../components/finance/financeLabels";
import { useCars, useExpenses, usePayments } from "../hooks";
import type { Expense, Payment } from "../types";
import { formatDate, formatMoney } from "../components/ui";
import {
  DASHBOARD_FLEET_OTHER_CAR_ID,
  filterDashboardExpenses,
  filterDashboardIncomePayments,
  parseStatBreakdownKind,
  parseStatsPeriod,
} from "../utils/dashboardStats";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)));
}

export function StatBreakdownPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const kind = parseStatBreakdownKind(searchParams.get("kind"));
  const period = parseStatsPeriod(searchParams.get("period"));
  const carId = searchParams.get("carId") ?? "";

  const payments = usePayments();
  const expenses = useExpenses();
  const cars = useCars();

  const carLabel = useMemo(() => {
    if (carId === DASHBOARD_FLEET_OTHER_CAR_ID) return t("dashboard.chartFleetOther");
    if (!carId) return null;
    const car = (cars.data ?? []).find((c) => c.id === carId);
    if (!car) return null;
    const name = [car.make, car.model].filter(Boolean).join(" ");
    return [car.plate, name].filter(Boolean).join(" · ");
  }, [carId, cars.data, t]);

  const periodSuffix =
    period === "month"
      ? t("dashboard.monthSuffix")
      : period === "previous"
        ? t("dashboard.previousMonthSuffix")
        : t("dashboard.allTimeSuffix");

  const { items, total, loading } = useMemo(() => {
    if (kind === "income") {
      const list = sortByDateDesc(
        filterDashboardIncomePayments(payments.data ?? [], period, carId),
        (p) => p.date,
      );
      return {
        items: list,
        total: round2(list.reduce((s, p) => s + p.amount, 0)),
        loading: payments.isLoading,
      };
    }
    if (kind === "expenses") {
      const list = sortByDateDesc(
        filterDashboardExpenses(expenses.data ?? [], period, carId),
        (e) => e.date,
      );
      return {
        items: list,
        total: round2(list.reduce((s, e) => s + e.amount, 0)),
        loading: expenses.isLoading,
      };
    }
    return { items: [], total: 0, loading: false };
  }, [kind, period, carId, payments.data, payments.isLoading, expenses.data, expenses.isLoading]);

  if (!kind) {
    return (
      <div className="crm-page">
        <div className="crm-page-header-block">
          <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
        </div>
        <div className="crm-empty-box">
          <p>{t("common.error")}</p>
          <button type="button" className="crm-btn-primary" onClick={() => navigate("/")}>
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  const title =
    kind === "income" ? t("dashboard.statBreakdownIncome") : t("dashboard.statBreakdownExpenses");

  return (
    <div className="crm-page crm-page--stat-breakdown">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <button type="button" className="crm-page-back" onClick={() => navigate("/")}>
            <Icon name="arrow-left-01" size={20} color="rgba(255,255,255,0.7)" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="crm-page-head__title">{title}</h2>
          <p className="crm-page-head__subtitle">
            {[periodSuffix, carLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className={`crm-stat-breakdown-total glass-card crm-stat-breakdown-total--${kind}`}>
        <span className="crm-stat-breakdown-total__label">{t("dashboard.statBreakdownTotal")}</span>
        <span className="crm-stat-breakdown-total__value">{formatMoney(total)}</span>
        <span className="crm-stat-breakdown-total__meta">
          {t("dashboard.statBreakdownCount", { count: items.length })}
        </span>
      </div>

      {loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="crm-empty-box">
          <Icon name="archive-01" size={42} color="var(--taxi-text-muted)" />
          <p className="crm-empty-box__title">{t("dashboard.statBreakdownEmpty")}</p>
        </div>
      ) : (
        <ul className="crm-activity-feed crm-stat-breakdown-list">
          {kind === "income"
            ? (items as Payment[]).map((p) => (
                <li key={p.id} className="crm-activity-feed__item crm-activity-feed__item--income">
                  <div className="crm-activity-feed__main">
                    <div className="crm-activity-feed__title">
                      {paymentDisplayTitle(p, t, t("common.none"))}
                    </div>
                    <div className="crm-activity-feed__meta">
                      {paymentDisplaySubtitle(
                        p,
                        formatDate(p.date),
                        t,
                        t("common.none"),
                      )}
                    </div>
                  </div>
                  <div className="crm-activity-feed__amount crm-activity-feed__amount--income">
                    +{formatMoney(p.amount)}
                  </div>
                </li>
              ))
            : (items as Expense[]).map((e) => (
                <li key={e.id} className="crm-activity-feed__item crm-activity-feed__item--expense">
                  <div className="crm-activity-feed__main">
                    <div className="crm-activity-feed__title">
                      {expenseDisplayTitle(e, t)}
                    </div>
                    <div className="crm-activity-feed__meta">
                      {expenseDisplaySubtitle(
                        e,
                        formatDate(e.date),
                        t,
                        t("common.none"),
                      )}
                    </div>
                  </div>
                  <div className="crm-activity-feed__amount crm-activity-feed__amount--expense">
                    −{formatMoney(e.amount)}
                  </div>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
