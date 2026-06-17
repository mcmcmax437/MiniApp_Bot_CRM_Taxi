import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { showAlert } from "../../telegram";
import { formatMoney } from "../../currency";
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

export type FinanceDateSort = "newest" | "oldest";

export function sortFinanceByDate<T>(
  items: T[],
  sort: FinanceDateSort,
  getDate: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
    return sort === "newest" ? diff : -diff;
  });
}

export function FinanceSearchRow(props: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  period: FinancePeriod;
  onPeriodChange: (v: FinancePeriod) => void;
  periodOpen: boolean;
  onPeriodOpenChange: (v: boolean) => void;
  dateSort?: FinanceDateSort;
  onDateSortChange?: (v: FinanceDateSort) => void;
  sortOpen?: boolean;
  onSortOpenChange?: (v: boolean) => void;
  filterLabel?: string;
  filterActive?: boolean;
  onFilterClick?: () => void;
  filterMenu?: ReactNode;
}) {
  const { t } = useTranslation();
  const periods: FinancePeriod[] = ["all", "month", "year"];
  const dateSorts: FinanceDateSort[] = ["newest", "oldest"];

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
          onClick={() => {
            props.onSortOpenChange?.(false);
            props.onPeriodOpenChange(!props.periodOpen);
          }}
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

      {props.onDateSortChange ? (
        <div className="crm-filter-wrap">
          <button
            type="button"
            className={`crm-finance-filter-btn${props.dateSort !== "newest" ? " crm-finance-filter-btn--active" : ""}`}
            onClick={() => {
              props.onPeriodOpenChange(false);
              props.onSortOpenChange?.(!props.sortOpen);
            }}
          >
            <Icon name="clock-01" size={18} color="rgba(255,255,255,0.7)" />
            <span className="crm-finance-filter-btn__label">{t("finance.sortByDate")}</span>
            <Icon name="arrow-down-01" size={16} color="rgba(255,255,255,0.5)" />
          </button>
          {props.sortOpen ? (
            <div className="crm-filter-menu crm-finance-period-menu">
              {dateSorts.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`crm-filter-menu__item${props.dateSort === s ? " crm-filter-menu__item--active" : ""}`}
                  onClick={() => {
                    props.onDateSortChange?.(s);
                    props.onSortOpenChange?.(false);
                  }}
                >
                  {t(`finance.dateSort_${s}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {props.onFilterClick ? (
        <div className="crm-filter-wrap">
          <button
            type="button"
            className={`crm-finance-filter-btn${props.filterActive ? " crm-finance-filter-btn--active" : ""}`}
            onClick={() => {
              props.onPeriodOpenChange(false);
              props.onSortOpenChange?.(false);
              props.onFilterClick?.();
            }}
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

export function FinanceList(props: { loading?: boolean; className?: string; children: ReactNode }) {
  const { t } = useTranslation();
  if (props.loading) {
    return (
      <div className="crm-empty-box">
        <span className="crm-spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  const rootClass = ["crm-finance-list", props.className].filter(Boolean).join(" ");
  return <div className={rootClass}>{props.children}</div>;
}

export function PartnerAlertMark(props: { label: string }) {
  return (
    <span className="crm-partner-alert" title={props.label} aria-label={props.label}>
      !
    </span>
  );
}

export function FinanceListItem(props: {
  title: string;
  subtitle?: string;
  partnerAlert?: boolean;
  partnerAlertLabel?: string;
  amount?: string;
  amountTone?: "income" | "expense" | "neutral";
  className?: string;
  onClick?: () => void;
  /** When true, renders an inline button that opens the full note viewer.
   *  The button stops propagation so it doesn't trigger the row's onClick. */
  noteExpandable?: boolean;
  onShowNote?: () => void;
  /** Label for the inline "view note" button. */
  showNoteLabel?: string;
}) {
  const tone = props.amountTone ?? "neutral";
  const Tag = props.onClick ? "button" : "div";
  const rootClass = ["crm-finance-item", props.onClick ? "crm-finance-item--interactive" : "", props.className]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag type={props.onClick ? "button" : undefined} className={rootClass} onClick={props.onClick}>
      <div className="crm-finance-item__main">
        <div className="crm-finance-item__title-line">
          <div className="crm-finance-item__title">{props.title}</div>
          {props.partnerAlert ? <PartnerAlertMark label={props.partnerAlertLabel ?? "!"} /> : null}
        </div>
        {props.subtitle ? <div className="crm-finance-item__subtitle">{props.subtitle}</div> : null}
        {props.noteExpandable && props.onShowNote ? (
          <button
            type="button"
            className="crm-finance-note-toggle"
            data-stop-press="true"
            onClick={(ev) => {
              ev.stopPropagation();
              props.onShowNote?.();
            }}
            onPointerDown={(ev) => ev.stopPropagation()}
            onMouseDown={(ev) => ev.stopPropagation()}
            onTouchStart={(ev) => ev.stopPropagation()}
          >
            {props.showNoteLabel ?? "…"}
          </button>
        ) : null}
      </div>
      {props.amount ? (
        <div className={`crm-finance-item__amount crm-finance-item__amount--${tone}`}>{props.amount}</div>
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

export function getFinanceMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * ISO week key for a date string (YYYY-MM-DD). Weeks run Mon-Sun and are
 * identified by their year + ISO week number, e.g. "2026-24". Used to
 * stripe the finance list at week boundaries instead of row boundaries.
 */
export function getFinanceWeekKey(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
  // Copy to avoid mutating the original date.
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Shift to nearest Thursday: this is the ISO week definition.
  const dayNr = (target.getDay() + 6) % 7; // Mon=0, ..., Sun=6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-${String(week).padStart(2, "0")}`;
}

export function formatFinanceMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function groupFinanceByMonth<T>(items: T[], getDate: (item: T) => string) {
  const groups: { monthKey: string; items: T[] }[] = [];
  for (const item of items) {
    const monthKey = getFinanceMonthKey(getDate(item));
    const last = groups[groups.length - 1];
    if (last?.monthKey === monthKey) {
      last.items.push(item);
    } else {
      groups.push({ monthKey, items: [item] });
    }
  }
  return groups;
}

export function FinanceMonthDivider(props: {
  label: string;
  isFirst?: boolean;
  total?: number;
  countLabel?: string;
  summaryTone?: "income" | "expense";
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  const interactive = Boolean(props.onToggle);
  const className = [
    "crm-finance-month-divider",
    props.isFirst ? "crm-finance-month-divider--first" : "",
    interactive ? "crm-finance-month-divider--interactive" : "",
    props.collapsed ? "crm-finance-month-divider--collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="crm-finance-month-divider__line" aria-hidden />
      <div className="crm-finance-month-divider__content">
        <span className="crm-finance-month-divider__label">{props.label}</span>
        {props.total != null ? (
          <div className="crm-finance-month-divider__summary">
            <span
              className={`crm-finance-month-divider__total crm-finance-month-divider__total--${props.summaryTone ?? "neutral"}`}
            >
              {formatMoney(props.total)}
            </span>
            {props.countLabel ? (
              <span className="crm-finance-month-divider__count">{props.countLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {interactive ? (
        <span className="crm-finance-month-divider__chevron" aria-hidden>
          <Icon name="arrow-down-01" size={18} color="rgba(255, 193, 7, 0.75)" />
        </span>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        aria-expanded={!props.collapsed}
        aria-label={
          props.collapsed
            ? t("finance.expandMonth", { month: props.label })
            : t("finance.collapseMonth", { month: props.label })
        }
        onClick={props.onToggle}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} role="separator" aria-label={props.label}>
      {content}
    </div>
  );
}

function loadCollapsedMonths(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function saveCollapsedMonths(storageKey: string, collapsed: Set<string>) {
  localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
}

export function FinanceDateGroupedList<T>(props: {
  items: T[];
  getDate: (item: T) => string;
  getKey: (item: T) => string;
  getAmount: (item: T) => number;
  formatCount?: (count: number) => string;
  summaryTone?: "income" | "expense";
  collapseStorageKey?: string;
  renderItem: (item: T) => ReactNode;
}) {
  const { i18n } = useTranslation();
  const locale =
    i18n.language === "uk" ? "uk-UA" : i18n.language === "ru" ? "ru-RU" : "en-US";
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() =>
    props.collapseStorageKey ? loadCollapsedMonths(props.collapseStorageKey) : new Set(),
  );
  const groups = useMemo(
    () => groupFinanceByMonth(props.items, props.getDate),
    [props.items, props.getDate],
  );

  function toggleMonth(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      if (props.collapseStorageKey) saveCollapsedMonths(props.collapseStorageKey, next);
      return next;
    });
  }

  return (
    <>
      {groups.map((group, index) => {
        const total = group.items.reduce((sum, item) => sum + props.getAmount(item), 0);
        const countLabel = props.formatCount?.(group.items.length);
        const collapsed = collapsedMonths.has(group.monthKey);
        const label = formatFinanceMonthLabel(group.monthKey, locale);
        // Within a month, alternate row backgrounds by week (not by row).
        // Each new ISO week (Mon-Sun) flips the alt state.
        let prevWeekKey: string | null = null;
        let weekAlt = false;
        const monthAlt = index % 2 === 1;
        return (
          <div
            key={group.monthKey}
            className={`crm-finance-month-group${monthAlt ? " crm-finance-month-group--alt" : ""}${collapsed ? " crm-finance-month-group--collapsed" : ""}`}
          >
            <FinanceMonthDivider
              label={label}
              isFirst={index === 0}
              total={total}
              countLabel={countLabel}
              summaryTone={props.summaryTone}
              collapsed={collapsed}
              onToggle={() => toggleMonth(group.monthKey)}
            />
            {!collapsed
              ? group.items.map((item) => {
                  const weekKey = getFinanceWeekKey(props.getDate(item));
                  if (weekKey !== prevWeekKey) {
                    weekAlt = !weekAlt;
                    prevWeekKey = weekKey;
                  }
                  const weekClass = weekAlt ? " crm-finance-month-group__item--week-alt" : "";
                  return (
                    <div
                      key={props.getKey(item)}
                      className={`crm-finance-month-group__item${weekClass}`}
                    >
                      {props.renderItem(item)}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
    </>
  );
}
