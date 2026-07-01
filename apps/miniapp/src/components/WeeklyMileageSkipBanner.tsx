import { useTranslation } from "react-i18next";
import { Icon } from "./crm";
import { useReminderSettings, useSkipWeeklyMileage } from "../hooks";

export function WeeklyMileageSkipBanner(props: {
  mileageReminderCount: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const settings = useReminderSettings();
  const skip = useSkipWeeklyMileage();
  const skipped = settings.data?.weeklyMileageSkippedThisWeek ?? false;
  const hasMileageReminders = props.mileageReminderCount > 0;

  if (!settings.data?.weeklyMileageEnabled) return null;
  if (!skipped && !hasMileageReminders) return null;

  return (
    <div
      className={`crm-weekly-mileage-skip glass-card${props.compact ? " crm-weekly-mileage-skip--compact" : ""}`}
    >
      <Icon name="chart-line-data-01" size={22} color="var(--taxi-warning, #ffb300)" />
      <div className="crm-weekly-mileage-skip__body">
        <div className="crm-weekly-mileage-skip__title">
          {skipped ? t("reminders.weeklySkippedTitle") : t("reminders.weeklySkipTitle")}
        </div>
        <p className="crm-weekly-mileage-skip__text">
          {skipped
            ? t("reminders.weeklySkippedHint")
            : t("reminders.weeklySkipHint", { count: props.mileageReminderCount })}
        </p>
      </div>
      <button
        type="button"
        className={skipped ? "crm-btn-outline crm-weekly-mileage-skip__btn" : "crm-btn-primary crm-weekly-mileage-skip__btn"}
        disabled={skip.isPending}
        onClick={() => skip.mutate(!skipped)}
      >
        {skip.isPending
          ? t("common.loading")
          : skipped
            ? t("reminders.weeklyUnskip")
            : t("reminders.weeklySkip")}
      </button>
    </div>
  );
}
