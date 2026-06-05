import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ReminderItem } from "@taxi/shared";
import { formatDate, formatMoney } from "./ui";

export function reminderIcon(kind: string): string {
  if (kind === "INSURANCE") return "🛡️";
  if (kind === "INSPECTION") return "🔧";
  if (kind === "DOCUMENT") return "📄";
  if (kind === "MAINTENANCE") return "🛠️";
  if (kind === "MILEAGE_REPORT") return "📊";
  return "💸";
}

export function reminderPath(r: ReminderItem): string | null {
  switch (r.kind) {
    case "INSURANCE":
    case "INSPECTION":
    case "MILEAGE_REPORT":
      return `/cars/${r.refId}`;
    case "OVERDUE_PAYMENT":
      return "/finance";
    case "DOCUMENT":
      return "/documents";
    case "MAINTENANCE":
      return "/cars";
    default:
      return null;
  }
}

function formatReminderDetail(detail: string, t: (key: string) => string): string {
  if (detail === "weekly") return t("reminder.weekly");
  if (detail === "overdue") return t("reminder.overdue");
  if (detail === "due") return t("reminder.dueNow");
  if (/^\d+d$/.test(detail)) return detail;
  if (detail.endsWith(" km")) return detail;
  return detail;
}

function formatReminderMeta(
  r: ReminderItem,
  t: (key: string, opts?: { count: number }) => string,
): string {
  const parts: string[] = [];

  if (r.daysUntil != null) {
    if (r.daysUntil < 0) parts.push(t("reminder.overdue"));
    else parts.push(t("reminder.daysUntil", { count: r.daysUntil }));
  }

  if (r.dueDate) parts.push(formatDate(r.dueDate));

  if (r.detail && !(r.kind === "MILEAGE_REPORT" && r.detail === "weekly")) {
    parts.push(formatReminderDetail(r.detail, t));
  }

  if (r.amount != null) parts.push(formatMoney(r.amount));

  return parts.join(" · ");
}

export function ReminderList(props: { items: ReminderItem[]; limit?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const list = props.limit != null ? props.items.slice(0, props.limit) : props.items;

  return (
    <div className="crm-reminder-list">
      {list.map((r, idx) => {
        const path = reminderPath(r);
        const meta = formatReminderMeta(r, t);

        return (
          <button
            key={`${r.kind}-${r.refId}-${idx}`}
            type="button"
            className="crm-reminder-item crm-reminder-item--link"
            disabled={!path}
            onClick={() => path && navigate(path)}
          >
            <span className="crm-reminder-item__icon">{reminderIcon(r.kind)}</span>
            <div className="crm-reminder-item__body">
              <div className="crm-reminder-item__kind">{t(`reminder.${r.kind}`)}</div>
              <div className="crm-reminder-item__label">{r.label}</div>
              {meta ? <div className="crm-reminder-item__meta">{meta}</div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
