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
  const username = owner.username ? `@${owner.username}` : "";

  // The previous card was a tall "stat hero" — a 72px avatar, a
  // three-block stat grid, and a large chevron. The information is
  // the same, but at 4-5 owners per page it pushed everything else
  // off the screen. This new layout is a single, dense row per
  // owner: small avatar, name + handle, a single line of meta facts
  // (cars · drivers · joined), and compact action buttons aligned
  // to the right.
  return (
    <article className="crm-owner-card">
      <div
        className="crm-owner-card__avatar"
        style={{ backgroundColor: avatarColor(displayName) }}
      >
        {initials(displayName) || "?"}
      </div>

      <div className="crm-owner-card__body">
        <div className="crm-owner-card__top">
          <div className="crm-owner-card__id">
            <h3 className="crm-owner-card__name">{displayName}</h3>
            <div className="crm-owner-card__handle">
              {username ? <span>{username}</span> : null}
              <span>·</span>
              <span>ID {owner.telegramUserId}</span>
            </div>
          </div>
          <div className={`crm-owner-status ${STATUS_CLASS[owner.status]}`}>
            <span className="crm-owner-status__dot" />
            {t(`admin.${owner.status}`)}
          </div>
        </div>

        <div className="crm-owner-card__meta-row">
          <span className="crm-owner-card__meta-item">
            <Icon name="car-01" size={14} color="rgba(255,255,255,0.55)" />
            {t("admin.cars")}: <strong>{owner.cars}</strong>
          </span>
          <span className="crm-owner-card__meta-item">
            <Icon name="user" size={14} color="rgba(255,255,255,0.55)" />
            {t("admin.drivers")}: <strong>{owner.drivers}</strong>
          </span>
          <span className="crm-owner-card__meta-item">
            <Icon name="calendar-01" size={14} color="rgba(255,255,255,0.55)" />
            {t("admin.createdAt")}: <strong>{formatJoined(owner.createdAt)}</strong>
          </span>
        </div>

        <div className="crm-owner-card__actions">
          {owner.status !== OwnerStatus.ACTIVE && (
            <button
              type="button"
              className="crm-owner-action crm-owner-action--compact"
              disabled={props.activating}
              onClick={props.onActivate}
            >
              <Icon name="star" size={14} color="currentColor" />
              {t("admin.activate")}
            </button>
          )}
          {owner.status !== OwnerStatus.SUSPENDED && (
            <button
              type="button"
              className="crm-owner-action crm-owner-action--compact"
              disabled={props.suspending}
              onClick={props.onSuspend}
            >
              <Icon name="shield-01" size={14} color="currentColor" />
              {t("admin.suspend")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function OwnersAddSection(props: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="crm-owner-add-section">
      <div className="crm-owner-add-section__icon">
        <Icon name="user-add-01" size={56} color="#3b82f6" />
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
