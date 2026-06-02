import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OwnerStatus } from "@taxi/shared";
import type { OwnerRow } from "../types";
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
  const palette = ["#6933c3", "#1d4ed8", "#7b4bc4", "#448aff", "#26a69a", "#5c6bc0"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
          <Icon className="crm-owner-card__chevron" stroke="rgba(255,255,255,0.45)" fill="none" width="28" height="28">
            <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
        </div>

        <div className="crm-owner-card__actions">
          {owner.status !== OwnerStatus.ACTIVE && (
            <button
              type="button"
              className="crm-owner-action"
              disabled={props.activating}
              onClick={props.onActivate}
            >
              <Icon stroke="currentColor" fill="none" width="16" height="16">
                <path d="M12 3l2.5 7.5H22l-6 4.5 2.5 7.5L12 18l-6.5 4.5 2.5-7.5L2 10.5h7.5L12 3z" strokeWidth="1.4" strokeLinejoin="round" />
              </Icon>
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
              <Icon stroke="currentColor" fill="none" width="16" height="16">
                <path d="M12 3l7 3v5c0 4.4-2.8 8.4-7 9.8C7.8 19.4 5 15.4 5 11V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
              </Icon>
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
            icon={
              <Icon stroke="#448aff" fill="none" width="20" height="20">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" strokeWidth="1.4" />
              </Icon>
            }
          />
          <div className="crm-owner-card__divider" />
          <OwnerStat
            tone="drivers"
            label={t("admin.drivers")}
            value={String(owner.drivers)}
            icon={
              <Icon stroke="#b388ff" fill="none" width="20" height="20">
                <circle cx="12" cy="8" r="3.5" strokeWidth="1.6" />
                <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.6" strokeLinecap="round" />
              </Icon>
            }
          />
          <div className="crm-owner-card__divider" />
          <OwnerStat
            tone="joined"
            label={t("admin.createdAt")}
            value={formatJoined(owner.createdAt)}
            icon={
              <Icon stroke="#69f0ae" fill="none" width="20" height="20">
                <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
                <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
              </Icon>
            }
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
        <Icon stroke="#3b82f6" fill="none" width="72" height="72">
          <circle cx="10" cy="8" r="3.5" strokeWidth="1.6" />
          <path d="M5 20c0-3.3 2.5-6 5.5-6M14 11v6M11 14h6" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16 8c0-3.3 2.5-6 5.5-6 1.8 0 3.4.9 4.3 2.3" strokeWidth="1.6" strokeLinecap="round" />
        </Icon>
      </div>
      <h3 className="crm-owner-add-section__title">{t("admin.addOwnerTitle")}</h3>
      <p className="crm-owner-add-section__desc">{t("admin.addOwnerDesc")}</p>
      <button type="button" className="crm-btn-primary" onClick={props.onAdd}>
        <Icon width="18" height="18" stroke="#fff" fill="none">
          <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
        </Icon>
        <span>{t("admin.addOwner")}</span>
      </button>
    </section>
  );
}
