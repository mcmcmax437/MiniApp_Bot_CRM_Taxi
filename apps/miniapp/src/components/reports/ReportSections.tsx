import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../crm";
import { DateInput, formatMoney } from "../ui";

function formatDateDisplay(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function ReportFiltersCard(props: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  applying?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="crm-report-glass crm-report-filters">
      <h2 className="crm-report-filters__title">
        {t("reports.from")} / {t("reports.to")}
      </h2>
      <p className="crm-report-filters__subtitle">{t("reports.pageSubtitle")}</p>

      <div className="crm-report-filters__dates">
        <label className="crm-report-date-field">
          <span className="crm-report-date-field__label">{t("reports.from")}</span>
          <div className="crm-report-date-field__value">
            <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
            <DateInput value={props.from} onChange={props.onFromChange} />
            <span className="crm-report-date-field__display">{formatDateDisplay(props.from)}</span>
          </div>
        </label>

        <label className="crm-report-date-field">
          <span className="crm-report-date-field__label">{t("reports.to")}</span>
          <div className="crm-report-date-field__value">
            <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
            <DateInput value={props.to} onChange={props.onToChange} />
            <span className="crm-report-date-field__display">{formatDateDisplay(props.to)}</span>
          </div>
        </label>
      </div>

      <button type="button" className="crm-report-apply" onClick={props.onApply} disabled={props.applying}>
        <Icon stroke="#fff" fill="none" width="22" height="22">
          <path d="M4 18v-4M8 14v-6M12 10V6M16 14v-2M20 10v6" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 18h16" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
        <span>{t("reports.apply")}</span>
      </button>
    </section>
  );
}

export function ReportSummaryCard(props: {
  income: string;
  expenses: string;
  profit: string;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="crm-report-glass crm-report-summary">
      <ReportSummaryItem
        tone="income"
        value={props.loading ? "…" : props.income}
        label={t("reports.income")}
        icon={
          <Icon stroke="#69F0AE" fill="none" width="26" height="26">
            <path d="M8 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" strokeWidth="1.6" strokeLinejoin="round" />
          </Icon>
        }
      />
      <div className="crm-report-summary__divider" />
      <ReportSummaryItem
        tone="expense"
        value={props.loading ? "…" : props.expenses}
        label={t("reports.expenses")}
        icon={
          <Icon stroke="#FF8A80" fill="none" width="26" height="26">
            <path d="M6 8l6 8 6-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
        }
      />
      <div className="crm-report-summary__divider" />
      <ReportSummaryItem
        tone="profit"
        value={props.loading ? "…" : props.profit}
        label={t("reports.profit")}
        icon={
          <Icon stroke="#82B1FF" fill="none" width="26" height="26">
            <circle cx="12" cy="12" r="8" strokeWidth="1.6" />
            <path d="M12 8v4l3 2" strokeWidth="1.6" strokeLinecap="round" />
          </Icon>
        }
      />
    </section>
  );
}

function ReportSummaryItem(props: {
  tone: "income" | "expense" | "profit";
  value: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <div className={`crm-report-summary__item crm-report-summary__item--${props.tone}`}>
      <div className="crm-report-summary__icon">{props.icon}</div>
      <div className="crm-report-summary__value">{props.value}</div>
      <div className="crm-report-summary__label">{props.label}</div>
    </div>
  );
}

type CarRow = { carId: string; label: string; income: number; expenses: number; profit: number };
type DriverRow = { driverId: string; label: string; income: number };

export function ReportSectionCard(props: {
  title: string;
  subtitle: string;
  tone: "car" | "driver";
  carRows?: CarRow[];
  driverRows?: DriverRow[];
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const rows = props.carRows ?? props.driverRows ?? [];
  const hasRows = rows.length > 0;

  return (
    <section className="crm-report-glass crm-report-section">
      <div className="crm-report-section__head">
        <div className={`crm-report-section__avatar crm-report-section__avatar--${props.tone}`}>
          {props.tone === "car" ? (
            <Icon stroke="#3B82F6" fill="none" width="28" height="28">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" strokeWidth="1.4" />
            </Icon>
          ) : (
            <Icon stroke="#A855F7" fill="none" width="28" height="28">
              <circle cx="12" cy="8" r="3.5" strokeWidth="1.6" />
              <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          )}
        </div>
        <div className="crm-report-section__titles">
          <h3 className="crm-report-section__title">{props.title}</h3>
          <p className="crm-report-section__subtitle">{props.subtitle}</p>
        </div>
        <Icon className="crm-report-section__chevron" stroke="rgba(255,255,255,0.45)" fill="none" width="28" height="28">
          <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
      </div>

      <div className="crm-report-section__body">
        {props.loading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : !hasRows ? (
          <div className="crm-report-section__empty">
            <div className="crm-report-section__empty-icon">
              <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="28" height="28">
                <path d="M4 8h16v12H4zM8 8V5h8v3" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M4 12h16" strokeWidth="1.6" />
              </Icon>
            </div>
            <div>
              <div className="crm-report-section__empty-title">{t("reports.emptyTitle")}</div>
              <div className="crm-report-section__empty-subtitle">{t("reports.emptySubtitle")}</div>
            </div>
          </div>
        ) : (
          <div className="crm-report-section__list">
            {props.carRows?.map((c) => (
              <div key={c.carId} className="crm-report-section__row">
                <div className="crm-report-section__row-label">{c.label}</div>
                <div className="crm-report-section__row-meta">
                  {t("reports.income")}: {formatMoney(c.income)} · {t("reports.expenses")}: {formatMoney(c.expenses)}
                </div>
                <div className="crm-report-section__row-value">{formatMoney(c.profit)}</div>
              </div>
            ))}
            {props.driverRows?.map((d) => (
              <div key={d.driverId} className="crm-report-section__row">
                <div className="crm-report-section__row-label">{d.label}</div>
                <div className="crm-report-section__row-value">{formatMoney(d.income)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
