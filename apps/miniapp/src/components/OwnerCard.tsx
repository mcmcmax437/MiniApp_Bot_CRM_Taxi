import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OwnerStatus } from "@taxi/shared";
import type { OwnerRow } from "../types";
import { Icon } from "./crm";
import { formatDate } from "./ui";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string): string {
  const palette = ["#6933c3", "#1d4ed8", "#7b4bc4", "#448aff", "#26a69a", "#5c6bc0"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}

function formatJoined(iso: string): string {
  return formatDate(iso);
}

const STATUS_CLASS: Record<OwnerStatus, string> = {
  [OwnerStatus.ACTIVE]: "crm-owner-status--active",
  [OwnerStatus.PENDING]: "crm-owner-status--pending",
  [OwnerStatus.SUSPENDED]: "crm-owner-status--suspended",
};

export function OwnerCard(props: {
  owner: OwnerRow;
  onActivate: () => void;
  onSuspend: () => void;
  activating?: boolean;
  suspending?: boolean;
}) {
  const { t } = useTranslation();
  const { owner } = props;
  const displayName = owner.name ?? "—";
  const username = owner.username ? `@${owner.username}` : "@—";

  return (
    <article className="crm-owner-card">
      <div
        className="crm-owner-card__avatar"
        style={{ backgroundColor: avatarColor(displayName) }}
      >
        {initials(displayName) || "?"}
      </div>

      <div className="crm-owner-card__body">
        <div className="crm-owner-card__head">
          <h3 className="crm-owner-card__name">{displayName}</h3>
          <div className={`crm-owner-status ${STATUS_CLASS[owner.status]}`}>
            <span className="crm-owner-status__dot" />
            {t(`admin.${owner.status}`)}
          </div>
          <Icon
            className="crm-owner-card__chevron"
            name="arrow-right-01"
            size={28}
            color="rgba(255,255,255,0.45)"
          />
        </div>

        <div className="crm-owner-card__actions">
          {owner.status !== OwnerStatus.ACTIVE && (
            <button
              type="button"
              className="crm-owner-action"
              disabled={props.activating}
              onClick={props.onActivate}
            >
              <Icon name="star" size={16} color="currentColor" />
              {t("admin.activate")}
            </button>
          )}
          {owner.status !== OwnerStatus.SUSPENDED && (
            <button
              type="button"
              className="crm-owner-action"
              disabled={props.suspending}
              onClick={props.onSuspend}
            >
              <Icon name="shield-01" size={16} color="currentColor" />
              {t("admin.suspend")}
            </button>
          )}
        </div>

        <div className="crm-owner-card__meta">
          {username} • ID {owner.telegramUserId}
        </div>

        <div className="crm-owner-card__stats">
          <OwnerStat
            tone="cars"
            label={t("admin.cars")}
            value={String(owner.cars)}
            icon={<Icon name="car-01" size={20} color="#448aff" />}
          />
          <div className="crm-owner-card__divider" />
          <OwnerStat
            tone="drivers"
            label={t("admin.drivers")}
            value={String(owner.drivers)}
            icon={<Icon name="user" size={20} color="#b388ff" />}
          />
          <div className="crm-owner-card__divider" />
          <OwnerStat
            tone="joined"
            label={t("admin.createdAt")}
            value={formatJoined(owner.createdAt)}
            icon={<Icon name="calendar-01" size={20} color="#69f0ae" />}
          />
        </div>
      </div>
    </article>
  );
}

function OwnerStat(props: { label: string; value: string; icon: ReactNode; tone: string }) {
  return (
    <div className={`crm-owner-stat crm-owner-stat--${props.tone}`}>
      <div className="crm-owner-stat__icon">{props.icon}</div>
      <div className="crm-owner-stat__text">
        <div className="crm-owner-stat__label">{props.label}</div>
        <div className="crm-owner-stat__value">{props.value}</div>
      </div>
    </div>
  );
}

export function OwnersAddSection(props: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="crm-owner-add-section">
      <div className="crm-owner-add-section__icon">
        <Icon name="user-add-01" size={72} color="#3b82f6" />
      </div>
      <h3 className="crm-owner-add-section__title">{t("admin.addOwnerTitle")}</h3>
      <p className="crm-owner-add-section__desc">{t("admin.addOwnerDesc")}</p>
      <button type="button" className="crm-btn-primary" onClick={props.onAdd}>
        <Icon name="add-01" size={18} color="#fff" />
        <span>{t("admin.addOwner")}</span>
      </button>
    </section>
  );
}
