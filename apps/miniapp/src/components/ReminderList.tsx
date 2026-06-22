import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ReminderItem } from "@taxi/shared";
import { formatDate, formatMoney } from "./ui";

export function reminderIcon(kind: string): string {
  if (kind === "INSURANCE") return "🛡️";
  if (kind === "INSPECTION") return "🔧";
  if (kind === "DOCUMENT") return "📄";
  if (kind === "MILEAGE_REPORT") return "📊";
  if (kind === "RENTAL_ENDING") return "🚗";
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
    case "RENTAL_ENDING":
      // Rental agreements are managed under Finance → Fleet. The reminder is
      // a heads-up for the owner to arrange hand-off or extend the contract.
      return "/finance";
    default:
      return null;
  }
}

function formatReminderDetail(detail: string, t: (key: string) => string): string {
  if (detail === "weekly") return t("reminders.weekly");
  if (detail === "overdue") return t("reminders.dueToday");
  if (detail === "due") return t("reminders.dueNow");
  if (/^\d+d$/.test(detail)) return detail;
  if (detail.endsWith(" km")) return detail;
  return detail;
}

/**
 * Returns the remaining km for an inspection-by-mileage reminder, or null if
 * the detail doesn't look like a km figure. Used to colour-code the row so
 * overdue / close-to-due inspections stand out.
 */
function parseKmLeft(detail: string | undefined): number | null {
  if (!detail) return null;
  if (detail === "overdue") return 0;
  const m = detail.match(/^(-?\d[\d\s]*)\s*km$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function reminderTone(r: ReminderItem): "overdue" | "warning" | "ok" | "default" {
  // Inspection-by-mileage reminders carry the remaining distance in the
  // detail field. Once we're within 500 km the row should look "warning"
  // (amber), and at or below zero it should look "overdue" (red).
  if (r.kind === "INSPECTION" && r.dueDate == null) {
    const km = parseKmLeft(r.detail);
    if (km != null) {
      if (km <= 0) return "overdue";
      if (km <= 500) return "warning";
      return "ok";
    }
  }
  return "default";
}

function formatReminderMeta(
  r: ReminderItem,
  t: (key: string, opts?: { count: number }) => string,
): { text: string; tone: ReturnType<typeof reminderTone> } {
  const parts: string[] = [];
  const tone = reminderTone(r);

  if (r.daysUntil != null) {
    if (r.daysUntil < 0) parts.push(t("reminders.daysOverdue", { count: -r.daysUntil }));
    else parts.push(t("reminders.daysUntil", { count: r.daysUntil }));
  }

  if (r.dueDate) parts.push(formatDate(r.dueDate));

  if (r.detail && !(r.kind === "MILEAGE_REPORT" && r.detail === "weekly")) {
    parts.push(formatReminderDetail(r.detail, t));
  }

  if (r.amount != null) parts.push(formatMoney(r.amount));

  return { text: parts.join(" · "), tone };
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
        const itemClass = `crm-reminder-item crm-reminder-item--link${
          meta.tone === "overdue"
            ? " crm-reminder-item--overdue"
            : meta.tone === "warning"
              ? " crm-reminder-item--warning"
              : ""
        }`;

        return (
          <button
            key={`${r.kind}-${r.refId}-${idx}`}
            type="button"
            className={itemClass}
            disabled={!path}
            onClick={() => path && navigate(path)}
          >
            <span className="crm-reminder-item__icon">{reminderIcon(r.kind)}</span>
            <div className="crm-reminder-item__body">
              <div className="crm-reminder-item__kind">{t(`reminders.${r.kind}`)}</div>
              <div className="crm-reminder-item__label">{r.label}</div>
              {meta.text ? <div className="crm-reminder-item__meta">{meta.text}</div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
