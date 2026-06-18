import { type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useMaintenanceRecords, useMaintenanceRules, useReminderSettings } from "../hooks";
import type { Car, MaintenanceRecord } from "../types";
import { IconActionButton } from "./crm";
import { CopyOnDoubleTap, formatDate } from "./ui";
import { formatMoney } from "../currency";
import { maintenanceRuleLabel } from "./trackingLabels";
import type { MaintenanceRule } from "../types";

const INSPECTION_PRESET = "presetInspectionService";
const INSPECTION_WARN_KM = 500;

const statusClass: Record<CarStatus, string> = {
  [CarStatus.AVAILABLE]: "crm-car-status--available",
  [CarStatus.RENTED]: "crm-car-status--rented",
  [CarStatus.MAINTENANCE]: "crm-car-status--maintenance",
  [CarStatus.INACTIVE]: "crm-car-status--inactive",
};

function formatMileage(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString()} km`;
}

function tireSummary(
  car: Car,
  axle: "front" | "rear",
  t: (key: string) => string,
): string | null {
  const brand =
    axle === "front" ? car.tireFrontBrand ?? car.tireBrand : car.tireRearBrand;
  const size = axle === "front" ? car.tireFrontSize ?? car.tireSize : car.tireRearSize;
  const season =
    axle === "front"
      ? car.tireFrontSeason ?? car.tireSeason
      : car.tireRearSeason;
  if (!brand && !size && !season) return null;
  const parts = [brand, size, season ? t(`cars.tireSeason.${season}`) : null].filter(Boolean);
  return parts.join(" · ") || null;
}

function nextServiceLabel(
  rules: MaintenanceRule[] | undefined,
  currentMileage: number | null | undefined,
  t: TFunction,
): string {
  if (!rules?.length) return "—";
  const rule = rules.find((r) => r.isActive && (r.nextDueDate || r.nextDueMileage != null));
  if (!rule) return "—";
  const parts: string[] = [maintenanceRuleLabel(rule, t)];
  if (rule.nextDueMileage != null && currentMileage != null) {
    parts.push(`${(rule.nextDueMileage - currentMileage).toLocaleString()} km`);
  } else if (rule.nextDueDate) {
    parts.push(formatDate(rule.nextDueDate));
  }
  return parts.join(" · ");
}

/**
 * Compute the distance to the next inspection, mirroring the same logic the
 * server uses in `services/reminders.ts`. The user can see exactly how many
 * km are left until the next inspection directly on the car overview —
 * not just when the reminder shows up in the dashboard list.
 *
 * Returns null when no inspection baseline can be established (no record
 * and no rule), or when the owner hasn't configured an inspection
 * interval yet.
 */
function computeInspectionKmLeft(
  intervalKm: number | null | undefined,
  currentMileage: number | null | undefined,
  records: MaintenanceRecord[] | undefined,
  rules: MaintenanceRule[] | undefined,
): number | null {
  if (!intervalKm || intervalKm <= 0 || currentMileage == null) return null;

  // Prefer the most recent maintenance record for the inspection preset.
  // Records carry `mileageAt` — the odometer reading at the time of the
  // last completed inspection.
  const recordBaseline = records
    ?.filter((r) => r.presetKey === INSPECTION_PRESET && r.mileageAt != null)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))[0]?.mileageAt;

  // Fall back to a maintenance rule's `lastCompletedMileage` so a freshly
  // configured rule (without any completed records yet) still shows
  // progress.
  const ruleBaseline = rules
    ?.filter((r) => r.presetKey === INSPECTION_PRESET && r.lastCompletedMileage != null)
    .sort((a, b) => (a.lastCompletedMileage ?? 0) > (b.lastCompletedMileage ?? 0) ? 1 : -1)[0]
    ?.lastCompletedMileage;

  const baseline = recordBaseline ?? ruleBaseline ?? null;
  if (baseline == null) return null;

  return baseline + intervalKm - currentMileage;
}

function formatKmLeft(km: number | null, t: TFunction): {
  text: string;
  tone: "ok" | "warning" | "overdue" | "none";
} {
  if (km == null) {
    return { text: "—", tone: "none" };
  }
  if (km <= 0) {
    return { text: t("tracking.inspectionOverdue"), tone: "overdue" };
  }
  const rounded = Math.round(km);
  return {
    text: t("tracking.inspectionKmLeft", { value: rounded.toLocaleString() }),
    tone: rounded <= INSPECTION_WARN_KM ? "warning" : "ok",
  };
}

export function CarOverviewPanel(props: {
  car: Car;
  readOnly?: boolean;
  onEditTires: () => void;
}) {
  const { t } = useTranslation();
  const rules = useMaintenanceRules(props.car.id);
  const records = useMaintenanceRecords(props.car.id);
  const reminderSettings = useReminderSettings();
  const car = props.car;

  const frontTire = tireSummary(car, "front", t);
  const rearTire = tireSummary(car, "rear", t);
  const hasTracker = Boolean(
    car.trackerLogin ||
    car.trackerPassword ||
    car.trackerUrl ||
    car.trackerSimNumber ||
    car.trackerNotes,
  );
  const trackerDisplay = car.trackerLogin?.trim() || (hasTracker ? "—" : t("common.none"));
  const subtitle = [car.make, car.model, car.year].filter(Boolean).join(" ");
  const inspectionKmLeft = computeInspectionKmLeft(
    reminderSettings.data?.inspectionMileageIntervalKm,
    car.currentMileage,
    records.data,
    rules.data,
  );
  const inspectionDisplay = formatKmLeft(inspectionKmLeft, t);

  return (
    <section className="glass-card crm-car-overview">
      <div className="crm-car-overview__head">
        <h3 className="crm-car-overview__title">{t("cars.overviewTitle")}</h3>
        {subtitle ? <p className="crm-car-overview__subtitle">{subtitle}</p> : null}
      </div>

      <div className="crm-car-overview__grid">
        <OverviewCell label={t("cars.plate")} copyValue={car.plate} value={car.plate} />
        <OverviewCell label={t("cars.status")}>
          <span className={`crm-car-status crm-car-status--compact ${statusClass[car.status]}`}>
            {t(`cars.${car.status}`)}
          </span>
        </OverviewCell>
        <OverviewCell label={t("tracking.currentMileage")} value={formatMileage(car.currentMileage)} />
        <OverviewCell
          label={t("tracking.nextDue")}
          value={nextServiceLabel(rules.data, car.currentMileage, t)}
        />
        <OverviewCell label={t("cars.insurance")} value={formatDate(car.insuranceExpiry)} />
        <OverviewCell label={t("cars.inspection")} value={formatDate(car.inspectionExpiry)} />
        <OverviewCell
          label={t("tracking.inspectionByMileage")}
          hint={t("tracking.inspectionByMileageHint")}
        >
          <span
            className={`crm-inspection-km crm-inspection-km--${inspectionDisplay.tone}`}
            title={
              inspectionDisplay.tone === "overdue"
                ? t("tracking.inspectionOverdueHint")
                : t("tracking.inspectionKmLeftHint", {
                    value: (inspectionKmLeft ?? 0).toLocaleString(),
                  })
            }
          >
            {inspectionDisplay.text}
          </span>
        </OverviewCell>
        <OverviewCell label={t("cars.vin")} copyValue={car.vin ?? undefined} value={car.vin ?? "—"} />
        {car.purchasePrice != null ? (
          <OverviewCell label={t("cars.purchasePrice")} value={formatMoney(car.purchasePrice)} />
        ) : null}
        {car.purchaseDate ? (
          <OverviewCell label={t("cars.purchaseDate")} value={formatDate(car.purchaseDate)} />
        ) : null}
        <OverviewCell
          label={t("cars.trackerTitle")}
          copyValue={car.trackerLogin?.trim() || undefined}
          value={trackerDisplay}
        />
      </div>

      <div className="crm-car-overview__tires">
        <div className="crm-car-overview__tires-head">
          <span className="crm-car-overview__tires-label">{t("cars.tiresTitle")}</span>
          {!props.readOnly ? (
            <IconActionButton
              icon={frontTire || rearTire ? "edit-02" : "add-01"}
              label={frontTire || rearTire ? t("common.edit") : t("cars.addTires")}
              onClick={props.onEditTires}
            />
          ) : null}
        </div>
        <div className="crm-car-overview__tire-rows">
          <div className="crm-car-overview__tire-row">
            <span className="crm-car-overview__tire-axle">{t("cars.tireFrontTitle")}</span>
            <span className="crm-car-overview__tire-value">{frontTire ?? t("common.none")}</span>
          </div>
          <div className="crm-car-overview__tire-row">
            <span className="crm-car-overview__tire-axle">{t("cars.tireRearTitle")}</span>
            <span className="crm-car-overview__tire-value">{rearTire ?? t("common.none")}</span>
          </div>
        </div>
      </div>

      {car.notes?.trim() ? (
        <div className="crm-car-overview__notes">
          <span className="crm-car-overview__notes-label">{t("cars.notes")}</span>
          <p className="crm-car-overview__notes-text">{car.notes}</p>
        </div>
      ) : null}
    </section>
  );
}

function OverviewCell(props: {
  label: string;
  value?: string;
  copyValue?: string;
  hint?: string;
  children?: ReactNode;
}) {
  const display = props.value ?? "—";
  return (
    <div className="crm-car-overview__cell">
      <div className="crm-car-overview__cell-label">
        {props.label}
        {props.hint ? <div className="crm-car-overview__cell-hint">{props.hint}</div> : null}
      </div>
      <div className="crm-car-overview__cell-body">
        {props.children ? (
          props.children
        ) : props.copyValue ? (
          <CopyOnDoubleTap value={props.copyValue} className="crm-car-overview__cell-value">
            {display}
          </CopyOnDoubleTap>
        ) : (
          <div className="crm-car-overview__cell-value" title={display}>
            {display}
          </div>
        )}
      </div>
    </div>
  );
}
