import { type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useMaintenanceRules } from "../hooks";
import type { Car } from "../types";
import { IconActionButton } from "./crm";
import { CopyOnDoubleTap, formatDate } from "./ui";
import { formatMoney } from "../currency";
import { maintenanceRuleLabel } from "./trackingLabels";
import type { MaintenanceRule } from "../types";

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

export function CarOverviewPanel(props: {
  car: Car;
  readOnly?: boolean;
  onEditTires: () => void;
}) {
  const { t } = useTranslation();
  const rules = useMaintenanceRules(props.car.id);
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
  children?: ReactNode;
}) {
  const display = props.value ?? "—";
  return (
    <div className="crm-car-overview__cell">
      <div className="crm-car-overview__cell-label">{props.label}</div>
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
