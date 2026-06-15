import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DriverBalance } from "@taxi/shared";
import type { Driver } from "../types";
import { formatDate, formatMoney } from "./ui";
import { Icon } from "./crm";
import { CardOpenHint } from "./CardOpenHint";

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
  onBalanceClick?: () => void;
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
    <div className="crm-driver-card">
      <div className="crm-driver-card__top">
        <div className="crm-driver-card__avatar" style={{ backgroundColor: avatarColor(driver.fullName) }}>
          {initials(driver.fullName) || "?"}
        </div>

        <div className="crm-driver-card__meta">
          <div className="crm-driver-card__name">{driver.fullName}</div>
          <div className="crm-driver-card__badge">
            <span
              className={`crm-driver-card__badge-dot${activeAgreements.length > 0 ? " crm-driver-card__badge-dot--active" : ""}`}
            />
            {carLabel}
          </div>
        </div>

        <CardOpenHint />
      </div>

      {driver.phone ? (
        <div className="crm-driver-card__phone">
          <Icon name="call-02" size={14} color="rgba(255,255,255,0.54)" />
          <span>{driver.phone}</span>
        </div>
      ) : null}

      <div className="crm-driver-card__stats">
        <StatColumn
          tone="joined"
          label={t("drivers.joined")}
          value={formatDate(driver.createdAt)}
          icon={<Icon name="calendar-01" size={16} color="rgba(255,255,255,0.54)" />}
        />
        <div className="crm-driver-card__divider" />
        <StatColumn
          tone="trips"
          label={t("drivers.tripsMonth")}
          value={String(props.tripsThisMonth)}
          icon={<Icon name="car-01" size={16} color="rgba(255,255,255,0.54)" />}
        />
        <div className="crm-driver-card__divider" />
        <StatColumn
          tone="balance"
          state={(props.balance?.balance ?? 0) > 0 ? "owing" : "settled"}
          label={t("drivers.balance")}
          value={formatMoney(props.balance?.balance ?? 0)}
          icon={<Icon name="dollar-01" size={16} color="rgba(255,255,255,0.54)" />}
          onClick={props.onBalanceClick}
          clickable={Boolean(props.onBalanceClick)}
        />
      </div>
    </div>
  );
}

function StatColumn(props: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "joined" | "trips" | "balance";
  state?: "owing" | "settled";
  clickable?: boolean;
  onClick?: () => void;
}) {
  const stateClass = props.state ? ` crm-driver-stat--${props.state}` : "";
  const clickableClass = props.clickable ? " crm-driver-stat--clickable" : "";
  const className = `crm-driver-stat crm-driver-stat--${props.tone}${stateClass}${clickableClass}`;
  const inner = (
    <>
      <div className="crm-driver-stat__icon">{props.icon}</div>
      <div className="crm-driver-stat__text">
        <div className="crm-driver-stat__label">{props.label}</div>
        <div className="crm-driver-stat__value">{props.value}</div>
      </div>
    </>
  );
  if (props.clickable) {
    return (
      <button type="button" className={className} onClick={props.onClick}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function DriversEmptyState(props: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="crm-driver-empty">
      <div className="crm-driver-empty__icon">
        <Icon name="user" size={72} color="#448AFF" />
        <span className="crm-driver-empty__plus">+</span>
      </div>
      <h3 className="crm-driver-empty__title">{t("drivers.noDriversYet")}</h3>
      <p className="crm-driver-empty__subtitle">{t("drivers.addFirstDriver")}</p>
      <button type="button" className="crm-btn-primary" onClick={props.onAdd}>
        <Icon name="add-01" size={18} color="#fff" />
        <span>{t("drivers.addDriver")}</span>
      </button>
    </div>
  );
}
