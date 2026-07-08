import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import type { ReminderItem } from "@taxi/shared";
import type { Car } from "../types";
import { formatDate } from "./ui";
import { Icon } from "./crm";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { CardOpenHint } from "./CardOpenHint";
import { CarAttentionMark } from "./CarAttentionMark";
import { expiryUrgency } from "../utils/expiryUrgency";

const statusClass: Record<CarStatus, string> = {
  [CarStatus.AVAILABLE]: "crm-car-status--available",
  [CarStatus.RENTED]: "crm-car-status--rented",
  [CarStatus.MAINTENANCE]: "crm-car-status--maintenance",
  [CarStatus.INACTIVE]: "crm-car-status--inactive",
};

export function CarCard(props: {
  car: Car;
  coverDocumentId?: string;
  needsAttention?: boolean;
  reminders?: ReminderItem[];
}) {
  const { t } = useTranslation();
  const { car } = props;
  const subtitle = [car.make, car.model, car.year].filter(Boolean).join(" ");

  return (
    <div className="crm-car-card">
      <div className="crm-car-card__top">
        <div className="crm-car-card__thumb">
          {props.coverDocumentId ? (
            <DocumentThumbnail documentId={props.coverDocumentId} alt={subtitle || car.plate} className="crm-car-card__photo" />
          ) : (
            <Icon name="car-01" size={36} color="rgba(255,255,255,0.35)" />
          )}
        </div>

        <div className="crm-car-card__meta">
          <div className="crm-car-card__plate">
            <span className="crm-car-card__plate-line">
              <span>{car.plate}</span>
              {props.needsAttention ? (
                <CarAttentionMark carId={car.id} reminders={props.reminders} />
              ) : null}
            </span>
          </div>
          {subtitle ? <div className="crm-car-card__model">{subtitle}</div> : null}
          <div className={`crm-car-status ${statusClass[car.status]}`}>
            <Icon name="checkmark-circle-01" size={16} color="currentColor" />
            <span>{t(`cars.${car.status}`)}</span>
          </div>
        </div>

        <CardOpenHint />
      </div>

      <div className="crm-car-card__dates">
        <DateInfo
          tone="insurance"
          label={t("cars.insurance")}
          date={formatDate(car.insuranceExpiry)}
          rawDate={car.insuranceExpiry}
          icon={<Icon name="calendar-01" size={22} color="#448AFF" />}
        />
        <div className="crm-car-card__divider" />
        <DateInfo
          tone="inspection"
          label={t("cars.inspection")}
          date={formatDate(car.inspectionExpiry)}
          rawDate={car.inspectionExpiry}
          icon={<Icon name="pencil" size={22} color="#FF9800" />}
        />
      </div>
    </div>
  );
}

function DateInfo(props: {
  label: string;
  date: string;
  rawDate?: string | null;
  icon: ReactNode;
  tone: "insurance" | "inspection";
}) {
  const urgency = expiryUrgency(props.rawDate);
  return (
    <div className={`crm-car-date crm-car-date--${props.tone} crm-expiry--${urgency}`}>
      <div className="crm-car-date__icon">{props.icon}</div>
      <div className="crm-car-date__text">
        <div className="crm-car-date__label">{props.label}</div>
        <div className="crm-car-date__value">{props.date}</div>
      </div>
    </div>
  );
}

export function CarsEmptyState(props: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="crm-car-empty">
      <div className="crm-car-empty__icon">
        <Icon name="car-01" size={72} color="rgba(68, 138, 255, 0.85)" />
        <span className="crm-car-empty__plus">+</span>
      </div>
      <h3 className="crm-car-empty__title">{t("cars.noCarsYet")}</h3>
      <p className="crm-car-empty__subtitle">{t("cars.addFirstCar")}</p>
      <button type="button" className="crm-btn-primary" onClick={props.onAdd}>
        <Icon name="add-01" size={18} color="#fff" />
        <span>{t("cars.addCar")}</span>
      </button>
    </div>
  );
}
