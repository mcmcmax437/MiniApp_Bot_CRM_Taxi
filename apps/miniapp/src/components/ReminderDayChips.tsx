import { useTranslation } from "react-i18next";

export const REMINDER_DAY_OPTIONS = [30, 14, 7, 3, 1] as const;

export function parseReminderDays(raw: string): Set<number> {
  const set = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return set;
}

export function serializeReminderDays(days: Set<number>): string {
  return [...days].sort((a, b) => b - a).join(",");
}

export function ReminderDayChips(props: {
  label: string;
  value: string;
  onChange: (serialized: string) => void;
}) {
  const { t } = useTranslation();
  const selected = parseReminderDays(props.value);

  function toggle(day: number) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    props.onChange(serializeReminderDays(next));
  }

  return (
    <div className="crm-reminder-days">
      <span className="crm-reminder-days__label">{props.label}</span>
      <div className="crm-reminder-days__chips">
        {REMINDER_DAY_OPTIONS.map((day) => {
          const on = selected.has(day);
          return (
            <button
              key={day}
              type="button"
              className={`crm-reminder-day-chip${on ? " crm-reminder-day-chip--on" : ""}`}
              onClick={() => toggle(day)}
            >
              {t("tracking.daysBeforeChip", { count: day })}
            </button>
          );
        })}
      </div>
      {selected.size === 0 ? (
        <p className="crm-form-hint crm-reminder-days__warn">{t("tracking.pickAtLeastOneDay")}</p>
      ) : null}
    </div>
  );
}
