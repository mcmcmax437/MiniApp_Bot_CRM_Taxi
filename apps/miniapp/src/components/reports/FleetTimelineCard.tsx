import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgreements, useCars } from "../../hooks";
import { formatDate } from "../../dates";
import { formatMoney } from "../ui";
import { Icon } from "../crm";
import { CollapsibleReportBlock, ReportBlockHead } from "./ReportSections";
import {
  barColor,
  buildFleetTimeline,
  canShiftTimelineForward,
  defaultTimelineRange,
  shiftTimelineRange,
  toYmd,
  type TimelineScale,
} from "./fleetTimeline";

const SCALE_KEY = "reports-fleet-timeline-scale";

function todayLocal(): string {
  return toYmd(new Date());
}

function loadScale(): TimelineScale {
  const stored = localStorage.getItem(SCALE_KEY);
  if (stored === "week" || stored === "month" || stored === "year") return stored;
  return "week";
}

export function FleetTimelineCard() {
  const { t, i18n } = useTranslation();
  const agreements = useAgreements();
  const cars = useCars();
  const [scale, setScale] = useState<TimelineScale>(loadScale);
  const [range, setRange] = useState(() => defaultTimelineRange(loadScale(), todayLocal()));

  function changeScale(next: TimelineScale) {
    setScale(next);
    localStorage.setItem(SCALE_KEY, next);
    setRange(defaultTimelineRange(next, todayLocal()));
  }

  const locale = i18n.language;
  const asOf = todayLocal();
  const canGoNext = canShiftTimelineForward(scale, range, asOf);

  const model = useMemo(() => {
    return buildFleetTimeline(
      agreements.data ?? [],
      (cars.data ?? []).map((c) => ({ id: c.id, plate: c.plate })),
      range,
      scale,
      (ymd) => {
        const d = new Date(`${ymd}T12:00:00`);
        if (scale === "year") {
          return d.toLocaleDateString(locale, { month: "short" });
        }
        if (scale === "week") {
          const wd = d.toLocaleDateString(locale, { weekday: "short" });
          return `${wd} ${d.getDate()}`;
        }
        return String(d.getDate());
      },
      asOf,
    );
  }, [agreements.data, cars.data, range, scale, locale, asOf]);

  const loading = agreements.isLoading || cars.isLoading;
  const maxHeat = Math.max(1, ...model.heat.map((c) => c.cars));
  const colCount = model.columns.length;

  return (
    <CollapsibleReportBlock
      storageKey="reports-fleet-timeline"
      defaultOpen
      className="crm-fleet-timeline"
      head={
        <ReportBlockHead
          avatarClassName="crm-report-section__avatar--car"
          icon={<Icon name="chart-bar-line" size={22} color="#69f0ae" />}
          title={t("reports.fleetTimelineTitle")}
          subtitle={t("reports.fleetTimelineSubtitle")}
        />
      }
    >
      <div className="crm-fleet-timeline__toolbar">
        <div className="crm-fleet-timeline__scales" role="group" aria-label={t("reports.fleetTimelineScale")}>
          {(["week", "month", "year"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`crm-fleet-timeline__scale${scale === id ? " crm-fleet-timeline__scale--active" : ""}`}
              onClick={() => changeScale(id)}
              aria-pressed={scale === id}
            >
              {t(
                id === "week"
                  ? "reports.fleetTimelineWeek"
                  : id === "month"
                    ? "reports.fleetTimelineMonth"
                    : "reports.fleetTimelineYear",
              )}
            </button>
          ))}
        </div>
        <div className="crm-fleet-timeline__nav">
          <button
            type="button"
            className="crm-fleet-timeline__nav-btn"
            onClick={() => setRange((prev) => shiftTimelineRange(scale, prev, -1))}
            aria-label={t("reports.fleetTimelinePrev")}
          >
            <span className="crm-fleet-timeline__chevron crm-fleet-timeline__chevron--left" aria-hidden />
          </button>
          <div className="crm-fleet-timeline__range">
            {formatDate(model.range.from)}
            {model.range.from !== model.range.to ? ` – ${formatDate(model.range.to)}` : ""}
          </div>
          <button
            type="button"
            className="crm-fleet-timeline__nav-btn"
            onClick={() => setRange((prev) => shiftTimelineRange(scale, prev, 1))}
            disabled={!canGoNext}
            aria-label={t("reports.fleetTimelineNext")}
          >
            <span className="crm-fleet-timeline__chevron crm-fleet-timeline__chevron--right" aria-hidden />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : (
        <>
          <div className="crm-fleet-timeline__summary">
            <span>{t("reports.fleetTimelineCars", { count: model.activeCars })}</span>
            <span>{t("reports.fleetTimelineDays", { count: model.carDays })}</span>
            <span className="crm-fleet-timeline__expected">
              {t("reports.fleetTimelineExpected", { amount: formatMoney(model.expectedRent) })}
            </span>
          </div>

          <div className="crm-fleet-timeline__heat">
            <span className="crm-fleet-timeline__heat-label">{t("reports.fleetTimelineHeatmap")}</span>
            <div className="crm-fleet-timeline__heat-row">
              {model.heat.map((cell) => {
                const tLevel = cell.cars / maxHeat;
                return (
                  <span
                    key={cell.key}
                    className="crm-fleet-timeline__heat-cell"
                    title={`${cell.label}: ${t("reports.fleetTimelineCars", { count: cell.cars })}`}
                    style={{
                      background:
                        cell.cars === 0
                          ? "rgba(255,255,255,0.06)"
                          : `rgba(105, 240, 174, ${0.18 + tLevel * 0.72})`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {model.rows.length === 0 ? (
            <p className="crm-form-hint">{t("reports.fleetTimelineEmpty")}</p>
          ) : (
            <div className="crm-fleet-gantt">
              <div className="crm-fleet-gantt__side crm-fleet-gantt__side--left">
                <div className="crm-fleet-gantt__corner" />
                {model.rows.map((row) => (
                  <div key={row.carId} className="crm-fleet-gantt__plate" title={row.plate}>
                    <span className="crm-fleet-gantt__plate-id">{row.plate}</span>
                    <span className="crm-fleet-gantt__plate-meta">
                      {t("reports.fleetTimelineDayCount", { count: row.days })} · {formatMoney(row.expectedRent)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="crm-fleet-gantt__mid"
                style={{ ["--gantt-cols" as string]: String(colCount) }}
                onWheel={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollWidth <= el.clientWidth) return;
                  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
                  e.preventDefault();
                  el.scrollLeft += e.deltaY;
                }}
              >
                <div className="crm-fleet-gantt__canvas">
                  <div className="crm-fleet-gantt__axis">
                    {model.columns.map((col) => (
                      <span
                        key={col.key}
                        className={`crm-fleet-gantt__tick${col.weekend ? " crm-fleet-gantt__tick--weekend" : ""}`}
                      >
                        {col.label}
                      </span>
                    ))}
                  </div>
                  {model.rows.map((row) => (
                    <div key={row.carId} className="crm-fleet-gantt__track">
                      {row.bars.map((bar) => (
                        <div
                          key={bar.agreementId}
                          className="crm-fleet-gantt__bar"
                          style={{
                            gridColumn: `${bar.colStart} / span ${bar.colSpan}`,
                            background: barColor(bar.driverName + bar.carId),
                          }}
                          title={t("reports.fleetTimelineBar", {
                            driver: bar.driverName,
                            plate: bar.plate,
                            days: bar.days,
                            amount: formatMoney(bar.expectedRent),
                          })}
                        >
                          <span className="crm-fleet-gantt__bar-label">{bar.driverName}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="crm-fleet-gantt__guides" aria-hidden>
                    {model.columns.map((col) => (
                      <span
                        key={col.key}
                        className={`crm-fleet-gantt__guide${col.weekend ? " crm-fleet-gantt__guide--weekend" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </CollapsibleReportBlock>
  );
}
