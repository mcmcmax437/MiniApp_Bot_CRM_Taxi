import { useCallback, useState, type CSSProperties, type ReactNode } from "react";

/** Hugeicons Stroke Rounded — class suffix without `hgi-` prefix (see icons.css CDN). */
export type IconName =
  | "add-01"
  | "archive-01"
  | "arrow-down-01"
  | "arrow-left-01"
  | "arrow-right-01"
  | "calendar-01"
  | "call-02"
  | "car-01"
  | "chart-bar-line"
  | "chart-decrease"
  | "chart-increase"
  | "chart-line-data-01"
  | "checkmark-circle-01"
  | "clipboard"
  | "clock-01"
  | "credit-card"
  | "delete-02"
  | "download-01"
  | "dollar-01"
  | "edit-02"
  | "file-02"
  | "filter"
  | "fire"
  | "garage"
  | "globe"
  | "home-01"
  | "information-circle"
  | "invoice-01"
  | "lock"
  | "notification-01"
  | "parking-area-circle"
  | "minus-sign"
  | "pencil"
  | "receipt-dollar"
  | "refresh-01"
  | "search-01"
  | "settings-01"
  | "shield-01"
  | "star"
  | "taxi"
  | "upload-01"
  | "user"
  | "user-add-01"
  | "wallet-01";

export function Icon(props: {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const size = props.size ?? 24;
  const color = props.color ?? "currentColor";

  return (
    <span
      className={["crm-icon", "hgi-stroke", `hgi-${props.name}`, props.className].filter(Boolean).join(" ")}
      style={{ fontSize: size, color, lineHeight: 1, ...props.style }}
      aria-hidden
    />
  );
}

/** Compact icon-only control with an accessible label. */
export function IconActionButton(props: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
  className?: string;
  spinning?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "crm-icon-action-btn",
        props.spinning ? "crm-icon-action-btn--spinning" : "",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      title={props.label}
    >
      <Icon name={props.icon} size={props.size ?? 20} color="currentColor" />
    </button>
  );
}

export function AppHeader(props: { title: string; subtitle: string }) {
  return (
    <header className="crm-header">
      <div className="crm-header__logo">
        <Icon name="taxi" className="crm-header__logo-icon" size={28} color="var(--taxi-accent)" />
      </div>
      <div className="crm-header__text">
        <h1 className="crm-header__title">{props.title}</h1>
        <p className="crm-header__subtitle">{props.subtitle}</p>
      </div>
    </header>
  );
}

function useSectionCollapsed(storageKey: string | undefined, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const saved = localStorage.getItem(`crm-section-${storageKey}`);
      if (saved !== null) return saved === "1";
    } catch {
      /* ignore */
    }
    return defaultOpen;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          localStorage.setItem(`crm-section-${storageKey}`, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [storageKey]);

  return { open, toggle };
}

export function SectionCard(props: {
  title: string;
  /** Optional one-line description shown under the title. */
  subtitle?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** When set, section can be collapsed; state is persisted per key. */
  storageKey?: string;
  defaultOpen?: boolean;
}) {
  const collapsible = Boolean(props.storageKey);
  const { open, toggle } = useSectionCollapsed(props.storageKey, props.defaultOpen ?? true);

  const headContent = (
    <>
      <span className="crm-section__icon">{props.icon}</span>
      <div className="crm-section__titles">
        <h2 className="crm-section__title">{props.title}</h2>
        {props.subtitle ? <p className="crm-section__subtitle">{props.subtitle}</p> : null}
      </div>
      {props.action ? (
        <div className="crm-section__action" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {props.action}
        </div>
      ) : null}
      {collapsible ? (
        <span className={`crm-section__chevron${open ? " crm-section__chevron--open" : ""}`} aria-hidden>
          <Icon name="arrow-down-01" size={20} color="var(--taxi-text-muted)" />
        </span>
      ) : null}
    </>
  );

  return (
    <section className={`crm-section glass-card${collapsible && !open ? " crm-section--collapsed" : ""}`}>
      {collapsible ? (
        <button type="button" className="crm-section__head crm-section__head--toggle" onClick={toggle} aria-expanded={open}>
          {headContent}
        </button>
      ) : (
        <div className="crm-section__head">{headContent}</div>
      )}
      {open ? <div className="crm-section__body">{props.children}</div> : null}
    </section>
  );
}

export type DashboardStatsPeriod = "all" | "previous" | "month";

export function StatPeriodToggle(props: {
  value: DashboardStatsPeriod;
  onChange: (value: DashboardStatsPeriod) => void;
  allLabel: string;
  previousLabel: string;
  monthLabel: string;
}) {
  return (
    <div className="crm-period-toggle crm-period-toggle--triple" role="group" aria-label={props.allLabel}>
      <button
        type="button"
        className={`crm-period-toggle__btn${props.value === "all" ? " crm-period-toggle__btn--active" : ""}`}
        onClick={() => props.onChange("all")}
      >
        {props.allLabel}
      </button>
      <button
        type="button"
        className={`crm-period-toggle__btn${props.value === "previous" ? " crm-period-toggle__btn--active" : ""}`}
        onClick={() => props.onChange("previous")}
      >
        {props.previousLabel}
      </button>
      <button
        type="button"
        className={`crm-period-toggle__btn${props.value === "month" ? " crm-period-toggle__btn--active" : ""}`}
        onClick={() => props.onChange("month")}
      >
        {props.monthLabel}
      </button>
    </div>
  );
}

export function StatCard(props: {
  label: string;
  value: string;
  suffix: string;
  detail?: string;
  tone: "income" | "expense" | "profit" | "roi";
  icon: ReactNode;
  onClick?: () => void;
}) {
  const className = `crm-stat glass-card crm-stat--${props.tone}${props.onClick ? " crm-stat--link" : ""}`;
  const body = (
    <>
      <div className="crm-stat__icon">{props.icon}</div>
      <div className="crm-stat__label">{props.label}</div>
      <div className="crm-stat__value">{props.value}</div>
      <div className="crm-stat__suffix">{props.suffix}</div>
      {props.detail ? <div className="crm-stat__detail">{props.detail}</div> : null}
    </>
  );
  if (props.onClick) {
    return (
      <button type="button" className={className} onClick={props.onClick}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function GlassButton(props: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button type="button" className="crm-import-card" onClick={props.onClick} disabled={props.loading}>
      <div className="crm-import-card__icon">{props.icon}</div>
      <div className="crm-import-card__title">{props.title}</div>
      <div className="crm-import-card__subtitle">{props.subtitle}</div>
    </button>
  );
}
