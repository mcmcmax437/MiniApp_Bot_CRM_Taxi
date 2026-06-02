import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DriverBalance } from "@taxi/shared";
import type { Driver } from "../types";
import { formatDate, formatMoney } from "./ui";
import { Icon } from "./crm";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string): string {
  const palette = ["#7b4bc4", "#448aff", "#26a69a", "#ff9800", "#e91e63", "#5c6bc0"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}

export function DriverCard(props: {
  driver: Driver;
  balance?: DriverBalance;
  tripsThisMonth: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { driver } = props;
  const activeAgreements = (driver.agreements ?? []).filter((a) => a.status === "ACTIVE");
  const carLabel =
    activeAgreements.length === 0
      ? t("drivers.noActiveCar")
      : activeAgreements.map((a) => a.car?.plate).filter(Boolean).join(", ") ||
        t("drivers.noActiveCar");

  return (
    <button type="button" className="crm-driver-card" onClick={props.onClick}>
      <div className="crm-driver-card__top">
        <div className="crm-driver-card__avatar" style={{ backgroundColor: avatarColor(driver.fullName) }}>
          {initials(driver.fullName) || "?"}
        </div>

        <div className="crm-driver-card__meta">
          <div className="crm-driver-card__name">{driver.fullName}</div>
          <div className="crm-driver-card__badge">
            <span className="crm-driver-card__badge-dot" />
            {carLabel}
          </div>
        </div>

        <Icon className="crm-driver-card__chevron" stroke="rgba(255,255,255,0.45)" fill="none" width="28" height="28">
          <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
      </div>

      {driver.phone ? (
        <div className="crm-driver-card__phone">
          <Icon stroke="rgba(255,255,255,0.54)" fill="none" width="18" height="18">
            <path
              d="M7 4h3l1 3-2 1a9 9 0 0 0 4 4l1-2 3 1v3a2 2 0 0 1-2 2A12 12 0 0 1 5 6a2 2 0 0 1 2-2z"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </Icon>
          <span>{driver.phone}</span>
        </div>
      ) : null}

      <div className="crm-driver-card__stats">
        <StatColumn
          tone="joined"
          label={t("drivers.joined")}
          value={formatDate(driver.createdAt)}
          icon={
            <Icon stroke="rgba(255,255,255,0.54)" fill="none" width="20" height="20">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
        />
        <div className="crm-driver-card__divider" />
        <StatColumn
          tone="trips"
          label={t("drivers.tripsMonth")}
          value={String(props.tripsThisMonth)}
          icon={
            <Icon stroke="rgba(255,255,255,0.54)" fill="none" width="20" height="20">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" strokeWidth="1.4" />
            </Icon>
          }
        />
        <div className="crm-driver-card__divider" />
        <StatColumn
          tone="balance"
          label={t("drivers.balance")}
          value={formatMoney(props.balance?.balance ?? 0)}
          icon={
            <Icon stroke="rgba(255,255,255,0.54)" fill="none" width="20" height="20">
              <path d="M12 3v18M7 8h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
        />
      </div>
    </button>
  );
}

function StatColumn(props: { label: string; value: string; icon: ReactNode; tone: "joined" | "trips" | "balance" }) {
  return (
    <div className={`crm-driver-stat crm-driver-stat--${props.tone}`}>
      <div className="crm-driver-stat__icon">{props.icon}</div>
      <div className="crm-driver-stat__text">
        <div className="crm-driver-stat__label">{props.label}</div>
        <div className="crm-driver-stat__value">{props.value}</div>
      </div>
    </div>
  );
}

export function DriversEmptyState(props: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="crm-driver-empty">
      <div className="crm-driver-empty__icon">
        <Icon stroke="#448AFF" fill="none" width="72" height="72">
          <circle cx="12" cy="8" r="4" strokeWidth="1.6" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.6" strokeLinecap="round" />
        </Icon>
        <span className="crm-driver-empty__plus">+</span>
      </div>
      <h3 className="crm-driver-empty__title">{t("drivers.noDriversYet")}</h3>
      <p className="crm-driver-empty__subtitle">{t("drivers.addFirstDriver")}</p>
      <button type="button" className="crm-btn-primary" onClick={props.onAdd}>
        <Icon width="18" height="18" stroke="#fff" fill="none">
          <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
        </Icon>
        <span>{t("drivers.addDriver")}</span>
      </button>
    </div>
  );
}
