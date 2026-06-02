import type { ReactNode, SVGProps } from "react";
import { tg } from "../telegram";

export function Icon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export function AppHeader(props: { title: string; subtitle: string }) {
  return (
    <header className="crm-header">
      <div className="crm-header__logo">
        <Icon className="crm-header__logo-icon">
          <path
            d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
            fill="currentColor"
          />
        </Icon>
      </div>
      <div className="crm-header__text">
        <h1 className="crm-header__title">{props.title}</h1>
        <p className="crm-header__subtitle">{props.subtitle}</p>
      </div>
      <button type="button" className="crm-header__action" aria-label="Menu">
        <Icon width="20" height="20">
          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
        </Icon>
      </button>
      <button
        type="button"
        className="crm-header__action"
        aria-label="Close"
        onClick={() => tg?.close?.()}
      >
        <Icon width="20" height="20">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </Icon>
      </button>
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
