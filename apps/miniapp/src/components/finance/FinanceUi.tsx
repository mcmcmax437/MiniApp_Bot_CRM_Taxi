import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../crm";

export type FinanceTabId = "payments" | "expenses" | "fleet" | "balances";

const TAB_META: Record<
  FinanceTabId,
  { color: string; icon: (color: string) => ReactNode }
> = {
  payments: {
    color: "#448aff",
    icon: (c) => (
      <Icon stroke={c} fill="none" width="18" height="18">
        <rect x="3" y="6" width="18" height="13" rx="2" strokeWidth="1.6" />
        <path d="M3 10h18" strokeWidth="1.6" />
      </Icon>
    ),
  },
  expenses: {
    color: "#ff5252",
    icon: (c) => (
      <Icon stroke={c} fill="none" width="18" height="18">
        <path d="M12 3c-1.5 3-4 5-4 8a4 4 0 0 0 8 0c0-3-2.5-5-4-8z" strokeWidth="1.6" strokeLinejoin="round" />
      </Icon>
    ),
  },
  fleet: {
    color: "#69f0ae",
    icon: (c) => (
      <Icon stroke={c} fill="none" width="18" height="18">
        <path
          d="M4 8h12l1 3h2v5H3v-5h1l1-3zm2 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </Icon>
    ),
  },
  balances: {
    color: "#b388ff",
    icon: (c) => (
      <Icon stroke={c} fill="none" width="18" height="18">
        <path d="M6 8h12v10H6z" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeWidth="1.6" />
      </Icon>
    ),
  },
};

export function FinanceTabs(props: { active: FinanceTabId; onChange: (tab: FinanceTabId) => void }) {
  const { t } = useTranslation();
  const tabs: FinanceTabId[] = ["payments", "expenses", "fleet", "balances"];

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
                : id === "fleet"
                  ? t("fleet.title")
                  : t("finance.balances");

          return (
            <button
              key={id}
              type="button"
              className={`crm-finance-tab${active ? " crm-finance-tab--active" : ""}`}
              onClick={() => props.onChange(id)}
            >
              {meta.icon(active ? "#fff" : meta.color)}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FinanceAddButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="crm-btn-primary crm-finance-add-btn"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <Icon width="20" height="20" stroke="#fff" fill="none">
        <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
      </Icon>
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
        <Icon stroke="rgba(255,255,255,0.45)" fill="none" width="20" height="20">
          <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
          <path d="M20 20l-3.5-3.5" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
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
          <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="18" height="18">
            <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
            <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
          </Icon>
          <span>{t("finance.period")}</span>
          <Icon stroke="rgba(255,255,255,0.5)" fill="none" width="16" height="16">
            <path d="M8 10l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
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
            <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="18" height="18">
              <path d="M4 6h16M7 12h10M10 18h4" strokeWidth="1.8" strokeLinecap="round" />
            </Icon>
            <span>{props.filterLabel ?? t("finance.filter")}</span>
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
        <Icon stroke="#4B8FFF" fill="none" width="72" height="72">
          <path d="M6 8h12v10H6z" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeWidth="1.6" />
          <circle cx="12" cy="13" r="1.5" fill="#4B8FFF" />
        </Icon>
      </div>
      <h3 className="crm-finance-empty__title">{props.title}</h3>
      <p className="crm-finance-empty__desc">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button type="button" className="crm-btn-primary" onClick={props.onAction}>
          <Icon width="18" height="18" stroke="#fff" fill="none">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </Icon>
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
  amount?: string;
  amountTone?: "income" | "expense" | "neutral";
  onClick?: () => void;
}) {
  const tone = props.amountTone ?? "neutral";
  const Tag = props.onClick ? "button" : "div";
  return (
    <Tag type={props.onClick ? "button" : undefined} className="crm-finance-item" onClick={props.onClick}>
      <div className="crm-finance-item__main">
        <div className="crm-finance-item__title">{props.title}</div>
        {props.subtitle ? <div className="crm-finance-item__subtitle">{props.subtitle}</div> : null}
      </div>
      {props.amount ? (
        <div className={`crm-finance-item__amount crm-finance-item__amount--${tone}`}>{props.amount}</div>
      ) : null}
      {props.onClick ? (
        <Icon className="crm-finance-item__chevron" stroke="rgba(255,255,255,0.4)" fill="none" width="22" height="22">
          <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
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
