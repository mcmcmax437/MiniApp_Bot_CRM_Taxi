import type { CSSProperties, ReactNode } from "react";

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
  | "pencil"
  | "receipt-dollar"
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

export function SectionCard(props: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="crm-section glass-card">
      <div className="crm-section__head">
        <span className="crm-section__icon">{props.icon}</span>
        <h2 className="crm-section__title">{props.title}</h2>
        {props.action ? <div className="crm-section__action">{props.action}</div> : null}
      </div>
      <div className="crm-section__body">{props.children}</div>
    </section>
  );
}

export function StatCard(props: {
  label: string;
  value: string;
  suffix: string;
  tone: "income" | "expense" | "profit";
  icon: ReactNode;
}) {
  return (
    <div className={`crm-stat glass-card crm-stat--${props.tone}`}>
      <div className="crm-stat__icon">{props.icon}</div>
      <div className="crm-stat__label">{props.label}</div>
      <div className="crm-stat__value">{props.value}</div>
      <div className="crm-stat__suffix">{props.suffix}</div>
    </div>
  );
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
