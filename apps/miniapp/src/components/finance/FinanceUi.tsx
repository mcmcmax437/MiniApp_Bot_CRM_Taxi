import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { showAlert } from "../../telegram";
import { Icon } from "../crm";

export type FinanceTabId = "payments" | "expenses" | "taxes" | "fleet" | "balances";

const TAB_META: Record<
  FinanceTabId,
  { color: string; icon: (color: string) => ReactNode }
> = {
  payments: {
    color: "#448aff",
    icon: (c) => <Icon name="credit-card" size={15} color={c} />,
  },
  expenses: {
    color: "#ff5252",
    icon: (c) => <Icon name="fire" size={15} color={c} />,
  },
  taxes: {
    color: "#ffb74d",
    icon: (c) => <Icon name="lock" size={15} color={c} />,
  },
  fleet: {
    color: "#69f0ae",
    icon: (c) => <Icon name="car-01" size={15} color={c} />,
  },
  balances: {
    color: "#b388ff",
    icon: (c) => <Icon name="lock" size={15} color={c} />,
  },
};

export function FinanceTabs(props: { active: FinanceTabId; onChange: (tab: FinanceTabId) => void }) {
  const { t } = useTranslation();
  const tabs: FinanceTabId[] = ["payments", "expenses", "taxes", "fleet", "balances"];

  return (
    <div className="crm-finance-tabs glass-card">
      <div className="crm-finance-tabs__scroll">
        {tabs.map((id) => {
          const meta = TAB_META[id];
          const active = props.active === id;
          const label =
            id === "payments"
              ? t("finance.payments")
              : id === "expenses"
                ? t("finance.expenses")
                : id === "taxes"
                  ? t("finance.taxes")
                  : id === "fleet"
                    ? t("fleet.title")
                    : t("finance.balances");

          return (
            <button
              key={id}
              type="button"
              className={`crm-finance-tab${active ? " crm-finance-tab--active" : ""}`}
              onClick={() => props.onChange(id)}
              aria-current={active ? "page" : undefined}
            >
              <span className="crm-finance-tab__icon">{meta.icon(active ? "#fff" : meta.color)}</span>
              <span className="crm-finance-tab__label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FinanceAddButton(props: {
  label: string;
  onClick: () => void;
  /** When set, the button stays clickable and shows this message instead of doing nothing. */
  blockedReason?: string;
}) {
  return (
    <button
      type="button"
      className={`crm-btn-primary crm-finance-add-btn${props.blockedReason ? " crm-btn-primary--blocked" : ""}`}
      onClick={() => {
        if (props.blockedReason) {
          showAlert(props.blockedReason);
          return;
        }
        props.onClick();
      }}
      aria-disabled={props.blockedReason ? true : undefined}
      title={props.blockedReason}
    >
      <Icon name="add-01" size={20} color="#fff" />
      <span>{props.label}</span>
    </button>
  );
}

export function FinanceStatCard(props: {
  title: string;
  value: string;
  subtitle: string;
  tone: "blue" | "green" | "red" | "purple";
  icon: ReactNode;
}) {
  return (
    <div className={`crm-finance-stat crm-finance-stat--${props.tone}`}>
      <div className="crm-finance-stat__icon">{props.icon}</div>
      <div className="crm-finance-stat__title">{props.title}</div>
      <div className="crm-finance-stat__value">{props.value}</div>
      <div className="crm-finance-stat__subtitle">{props.subtitle}</div>
    </div>
  );
}

export function FinanceStatsRow(props: { children: ReactNode }) {
  return <div className="crm-finance-stats">{props.children}</div>;
}

export type FinancePeriod = "all" | "month" | "year";

export function FinanceSearchRow(props: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  period: FinancePeriod;
  onPeriodChange: (v: FinancePeriod) => void;
  periodOpen: boolean;
  onPeriodOpenChange: (v: boolean) => void;
  filterLabel?: string;
  filterActive?: boolean;
  onFilterClick?: () => void;
  filterMenu?: ReactNode;
}) {
  const { t } = useTranslation();
  const periods: FinancePeriod[] = ["all", "month", "year"];

  return (
    <div className="crm-finance-filters">
      <label className="crm-search-input crm-finance-search">
        <Icon name="search-01" size={20} color="rgba(255,255,255,0.45)" />
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={props.searchPlaceholder}
        />
      </label>

      <div className="crm-filter-wrap">
        <button
          type="button"
          className={`crm-finance-filter-btn${props.period !== "all" ? " crm-finance-filter-btn--active" : ""}`}
          onClick={() => props.onPeriodOpenChange(!props.periodOpen)}
        >
          <Icon name="calendar-01" size={18} color="rgba(255,255,255,0.7)" />
          <span className="crm-finance-filter-btn__label">{t("finance.period")}</span>
          <Icon name="arrow-down-01" size={16} color="rgba(255,255,255,0.5)" />
        </button>
        {props.periodOpen ? (
          <div className="crm-filter-menu crm-finance-period-menu">
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                className={`crm-filter-menu__item${props.period === p ? " crm-filter-menu__item--active" : ""}`}
                onClick={() => {
                  props.onPeriodChange(p);
                  props.onPeriodOpenChange(false);
                }}
              >
                {t(`finance.period_${p}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {props.onFilterClick ? (
        <div className="crm-filter-wrap">
          <button
            type="button"
            className={`crm-finance-filter-btn${props.filterActive ? " crm-finance-filter-btn--active" : ""}`}
            onClick={props.onFilterClick}
          >
            <Icon name="filter" size={18} color="rgba(255,255,255,0.7)" />
            <span className="crm-finance-filter-btn__label">{props.filterLabel ?? t("finance.filter")}</span>
          </button>
          {props.filterMenu}
        </div>
      ) : null}
    </div>
  );
}

export function FinanceEmptyState(props: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="crm-finance-empty glass-card">
      <div className="crm-finance-empty__icon">
        <Icon name="lock" size={72} color="#4B8FFF" />
      </div>
      <h3 className="crm-finance-empty__title">{props.title}</h3>
      <p className="crm-finance-empty__desc">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button type="button" className="crm-btn-primary" onClick={props.onAction}>
          <Icon name="add-01" size={18} color="#fff" />
          <span>{props.actionLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

export function FinanceList(props: { loading?: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  if (props.loading) {
    return (
      <div className="crm-empty-box">
        <span className="crm-spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  return <div className="crm-finance-list">{props.children}</div>;
}

export function FinanceListItem(props: {
  title: string;
  subtitle?: string;
  badge?: string;
  amount?: string;
  amountTone?: "income" | "expense" | "neutral";
  className?: string;
  onClick?: () => void;
}) {
  const tone = props.amountTone ?? "neutral";
  const Tag = props.onClick ? "button" : "div";
  const rootClass = ["crm-finance-item", props.className].filter(Boolean).join(" ");
  return (
    <Tag type={props.onClick ? "button" : undefined} className={rootClass} onClick={props.onClick}>
      <div className="crm-finance-item__main">
        <div className="crm-finance-item__title-row">
          <div className="crm-finance-item__title">{props.title}</div>
          {props.badge ? <span className="crm-finance-item__badge">{props.badge}</span> : null}
        </div>
        {props.subtitle ? <div className="crm-finance-item__subtitle">{props.subtitle}</div> : null}
      </div>
      {props.amount ? (
        <div className={`crm-finance-item__amount crm-finance-item__amount--${tone}`}>{props.amount}</div>
      ) : null}
      {props.onClick ? (
        <Icon className="crm-finance-item__chevron" name="arrow-right-01" size={22} color="rgba(255,255,255,0.4)" />
      ) : null}
    </Tag>
  );
}

export function financeInPeriod(dateStr: string, period: FinancePeriod): boolean {
  if (period === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return d.getFullYear() === now.getFullYear();
}
