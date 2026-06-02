import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import type { Car } from "../types";
import { formatDate } from "./ui";
import { Icon } from "./crm";
import { DocumentThumbnail } from "./DocumentThumbnail";

const statusClass: Record<CarStatus, string> = {
  [CarStatus.AVAILABLE]: "crm-car-status--available",
  [CarStatus.RENTED]: "crm-car-status--rented",
  [CarStatus.MAINTENANCE]: "crm-car-status--maintenance",
  [CarStatus.INACTIVE]: "crm-car-status--inactive",
};

export function CarCard(props: { car: Car; coverDocumentId?: string; onClick: () => void }) {
  const { t } = useTranslation();
  const { car } = props;
  const subtitle = [car.make, car.model, car.year].filter(Boolean).join(" ");

  return (
    <button type="button" className="crm-car-card" onClick={props.onClick}>
      <div className="crm-car-card__top">
        <div className="crm-car-card__thumb">
          {props.coverDocumentId ? (
            <DocumentThumbnail documentId={props.coverDocumentId} alt={subtitle || car.plate} className="crm-car-card__photo" />
          ) : (
            <Icon width="36" height="36" fill="rgba(255,255,255,0.35)">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" />
            </Icon>
          )}
        </div>

        <div className="crm-car-card__meta">
          <div className="crm-car-card__plate">{car.plate}</div>
          {subtitle ? <div className="crm-car-card__model">{subtitle}</div> : null}
          <div className={`crm-car-status ${statusClass[car.status]}`}>
            <Icon width="16" height="16" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9l-7 7z" />
            </Icon>
            <span>{t(`cars.${car.status}`)}</span>
          </div>
        </div>

        <Icon className="crm-car-card__chevron" stroke="rgba(255,255,255,0.45)" fill="none" width="28" height="28">
          <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
      </div>

      <div className="crm-car-card__dates">
        <DateInfo
          tone="insurance"
          label={t("cars.insurance")}
          date={formatDate(car.insuranceExpiry)}
          icon={
            <Icon stroke="#448AFF" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
        />
        <div className="crm-car-card__divider" />
        <DateInfo
          tone="inspection"
          label={t("cars.inspection")}
          date={formatDate(car.inspectionExpiry)}
          icon={
            <Icon stroke="#FF9800" fill="none" width="22" height="22">
              <path d="M14.7 6.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 3 3 1.3-1.3zM5 13l7.1-7.1 3 3L8 16H5v-3z" strokeWidth="1.4" strokeLinejoin="round" />
            </Icon>
          }
        />
      </div>
    </button>
  );
}

function DateInfo(props: {
  label: string;
  date: string;
  icon: ReactNode;
  tone: "insurance" | "inspection";
}) {
  return (
    <div className={`crm-car-date crm-car-date--${props.tone}`}>
      <div className="crm-car-date__icon">{props.icon}</div>
      <div className="crm-car-date__text">
        <div className="crm-car-date__label">{props.label}</div>
        <div className="crm-car-date__value">{props.date}</div>
      </div>
    </div>
  );
}
