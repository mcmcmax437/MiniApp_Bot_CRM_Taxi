import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../crm";
import { DateInput, formatDate, formatMoney } from "../ui";
import { readReportSectionOpen, writeReportSectionOpen } from "./reportSectionStorage";

function useReportSectionCollapsed(storageKey: string, defaultOpen = true) {
  const [open, setOpen] = useState(() => readReportSectionOpen(storageKey, defaultOpen));

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeReportSectionOpen(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { open, toggle };
}

export function ReportBlockHead(props: {
  avatarClassName?: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className={`crm-report-section__avatar${props.avatarClassName ? ` ${props.avatarClassName}` : ""}`}>
        {props.icon}
      </div>
      <div className="crm-report-section__titles">
        <h3 className="crm-report-section__title">{props.title}</h3>
        {props.subtitle ? <p className="crm-report-section__subtitle">{props.subtitle}</p> : null}
      </div>
    </>
  );
}

export function CollapsibleReportBlock(props: {
  storageKey: string;
  defaultOpen?: boolean;
  className?: string;
  head: ReactNode;
  children: ReactNode;
}) {
  const { open, toggle } = useReportSectionCollapsed(props.storageKey, props.defaultOpen ?? true);

  return (
    <section
      className={`crm-report-glass crm-report-section${props.className ? ` ${props.className}` : ""}${!open ? " crm-report-section--collapsed" : ""}`}
    >
      <button
        type="button"
        className="crm-report-section__head crm-report-section__head--toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        {props.head}
        <Icon
          name="arrow-down-01"
          size={24}
          color="rgba(255,255,255,0.45)"
          className={`crm-report-section__chevron crm-report-section__chevron--toggle${open ? " crm-report-section__chevron--open" : ""}`}
        />
      </button>
      {open ? <div className="crm-report-section__collapsible">{props.children}</div> : null}
    </section>
  );
}

export function ReportFiltersCard(props: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  applying?: boolean;
  /** Months back from today (0 = current month only). Applies range immediately. */
  onPreset?: (monthsBack: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="crm-report-glass crm-report-filters">
      <h2 className="crm-report-filters__title">
        {t("reports.from")} / {t("reports.to")}
      </h2>
      <p className="crm-report-filters__subtitle">{t("reports.pageSubtitle")}</p>

      {props.onPreset ? (
        <div className="crm-report-filters__presets">
          <button type="button" className="crm-report-preset" onClick={() => props.onPreset!(0)}>
            {t("reports.presetThisMonth")}
          </button>
          <button type="button" className="crm-report-preset" onClick={() => props.onPreset!(2)}>
            {t("reports.preset3Months")}
          </button>
          <button type="button" className="crm-report-preset" onClick={() => props.onPreset!(5)}>
            {t("reports.preset6Months")}
          </button>
          <button type="button" className="crm-report-preset" onClick={() => props.onPreset!(11)}>
            {t("reports.preset12Months")}
          </button>
        </div>
      ) : null}

      <div className="crm-report-filters__dates">
        <label className="crm-report-date-field">
          <span className="crm-report-date-field__label">{t("reports.from")}</span>
          <div className="crm-report-date-field__value">
            <Icon name="calendar-01" size={22} color="rgba(255,255,255,0.7)" />
            <DateInput value={props.from} onChange={props.onFromChange} />
            <span className="crm-report-date-field__display">{formatDate(props.from)}</span>
          </div>
        </label>

        <label className="crm-report-date-field">
          <span className="crm-report-date-field__label">{t("reports.to")}</span>
          <div className="crm-report-date-field__value">
            <Icon name="calendar-01" size={22} color="rgba(255,255,255,0.7)" />
            <DateInput value={props.to} onChange={props.onToChange} />
            <span className="crm-report-date-field__display">{formatDate(props.to)}</span>
          </div>
        </label>
      </div>

      <button type="button" className="crm-report-apply" onClick={props.onApply} disabled={props.applying}>
        <Icon name="chart-bar-line" size={22} color="#fff" />
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
    <CollapsibleReportBlock
      storageKey="reports-summary"
      className="crm-report-summary-block"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--summary"
          icon={<Icon name="chart-bar-line" size={28} color="#82B1FF" />}
          title={t("reports.summaryTitle")}
          subtitle={t("reports.summarySubtitle")}
        />
      }
    >
      <div className="crm-report-summary">
        <ReportSummaryItem
          tone="income"
          value={props.loading ? "…" : props.income}
          label={t("reports.income")}
          icon={<Icon name="receipt-dollar" size={26} color="#69F0AE" />}
        />
        <div className="crm-report-summary__divider" />
        <ReportSummaryItem
          tone="expense"
          value={props.loading ? "…" : props.expenses}
          label={t("reports.expenses")}
          icon={<Icon name="chart-decrease" size={26} color="#FF8A80" />}
        />
        <div className="crm-report-summary__divider" />
        <ReportSummaryItem
          tone="profit"
          value={props.loading ? "…" : props.profit}
          label={t("reports.profit")}
          icon={<Icon name="clock-01" size={26} color="#82B1FF" />}
        />
      </div>
    </CollapsibleReportBlock>
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
    <CollapsibleReportBlock
      storageKey={`reports-by-${props.tone}`}
      head={
        <ReportBlockHead
          avatarClassName={`crm-report-section__avatar--${props.tone}`}
          icon={
            props.tone === "car" ? (
              <Icon name="car-01" size={28} color="#3B82F6" />
            ) : (
              <Icon name="user" size={28} color="#A855F7" />
            )
          }
          title={props.title}
          subtitle={props.subtitle}
        />
      }
    >
      <div className="crm-report-section__body">
        {props.loading ? (
          <div className="crm-report-section__empty">
            <span className="crm-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : !hasRows ? (
          <div className="crm-report-section__empty">
            <div className="crm-report-section__empty-icon">
              <Icon name="archive-01" size={28} color="rgba(255,255,255,0.7)" />
            </div>
            <div>
              <div className="crm-report-section__empty-title">{t("reports.emptyTitle")}</div>
              <div className="crm-report-section__empty-subtitle">{t("reports.emptySubtitle")}</div>
            </div>
          </div>
        ) : (
          <div className="crm-report-section__rows">
            {props.carRows?.map((row) => (
              <div key={row.carId} className="crm-report-row">
                <div className="crm-report-row__label">{row.label}</div>
                <div className="crm-report-row__values">
                  <span className="crm-report-row__income">+{formatMoney(row.income)}</span>
                  <span className="crm-report-row__expense">-{formatMoney(row.expenses)}</span>
                  <span className="crm-report-row__profit">{formatMoney(row.profit)}</span>
                </div>
              </div>
            ))}
            {props.driverRows?.map((row) => (
              <div key={row.driverId} className="crm-report-row">
                <div className="crm-report-row__label">{row.label}</div>
                <div className="crm-report-row__values">
                  <span className="crm-report-row__income">+{formatMoney(row.income)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleReportBlock>
  );
}
