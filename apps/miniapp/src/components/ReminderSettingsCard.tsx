import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReminderSettings, useSaveReminderSettings } from "../hooks";
import { SectionCard, Icon, IconActionButton, type IconName } from "./crm";
import { Field, SelectInput, NumberInput, FormActions } from "./ui";
import { parseReminderDays, ReminderDayChips } from "./ReminderDayChips";

/**
 * Read-only summary for a "days before due date" list. Returns up to
 * `max` chips and a "+N more" hint if the list is longer, so the card
 * never gets overwhelmed by text like "30 d before, 14 d before, 7 d
 * before, 3 d before, 1 d before".
 */
function DaysSummary(props: { raw: string; max?: number }) {
  const { t } = useTranslation();
  const days = useMemo(
    () => [...parseReminderDays(props.raw)].sort((a, b) => b - a),
    [props.raw],
  );
  if (days.length === 0) {
    return <span className="crm-reminder-summary__empty">—</span>;
  }
  const max = props.max ?? 3;
  const visible = days.slice(0, max);
  const overflow = days.length - visible.length;
  return (
    <div className="crm-reminder-summary__chips">
      {visible.map((d) => (
        <span key={d} className="crm-reminder-summary__chip">
          {t("tracking.daysBeforeChip", { count: d })}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="crm-reminder-summary__chip crm-reminder-summary__chip--more">
          {t("common.plusMore", { count: overflow })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One row of the read-only summary view. Renders a small icon + label on
 * the left and either a value or `DaysSummary` on the right, so the
 * section reads like a structured key/value table rather than a wall of
 * text.
 */
function SummaryRow(props: {
  icon: IconName;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="crm-reminder-summary__row">
      <div className="crm-reminder-summary__label">
        <Icon name={props.icon} size={18} color="var(--taxi-accent, #ffc107)" />
        <div>
          <div className="crm-reminder-summary__label-text">{props.label}</div>
          {props.hint ? (
            <div className="crm-reminder-summary__label-hint">{props.hint}</div>
          ) : null}
        </div>
      </div>
      <div className="crm-reminder-summary__value">{props.children}</div>
    </div>
  );
}

export function ReminderSettingsCard() {
  const { t } = useTranslation();
  const settings = useReminderSettings();
  const save = useSaveReminderSettings();
  const [editing, setEditing] = useState(false);
  const [insuranceDaysBefore, setInsurance] = useState("14,7,3");
  const [inspectionDaysBefore, setInspection] = useState("7,3,1");
  const [documentDaysBefore, setDocument] = useState("14,7,3");
  const [inspectionMileageIntervalKm, setInspectionMileageInterval] = useState<number | "">("");
  const [weeklyMileageEnabled, setWeeklyEnabled] = useState(true);
  const [weeklyMileageWeekday, setWeekday] = useState(1);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setInsurance(s.insuranceDaysBefore);
    setInspection(s.inspectionDaysBefore);
    setDocument(s.documentDaysBefore);
    setInspectionMileageInterval(s.inspectionMileageIntervalKm ?? "");
    setWeeklyEnabled(s.weeklyMileageEnabled);
    setWeekday(s.weeklyMileageWeekday);
  }, [settings.data]);

  const weekdayLabel = (d: number) => t(`tracking.weekday.${d}`);
  const weekdayOptions = ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => ({
    value: String(d),
    label: weekdayLabel(d),
  }));

  const canSave =
    parseReminderDays(insuranceDaysBefore).size > 0 &&
    parseReminderDays(inspectionDaysBefore).size > 0 &&
    parseReminderDays(documentDaysBefore).size > 0;

  return (
    <SectionCard
      storageKey="reminder-settings"
      defaultOpen={false}
      title={t("tracking.reminderSettingsTitle")}
      icon={<Icon name="settings-01" size={24} color="var(--taxi-text-muted)" />}
    >
      {settings.isLoading ? (
        <p className="crm-form-hint">{t("common.loading")}</p>
      ) : editing ? (
        <div className="crm-reminder-settings-form">
          <p className="crm-form-hint">{t("tracking.reminderDaysIntro")}</p>
          <ReminderDayChips
            label={t("tracking.insuranceReminders")}
            value={insuranceDaysBefore}
            onChange={setInsurance}
          />
          <ReminderDayChips
            label={t("tracking.inspectionReminders")}
            value={inspectionDaysBefore}
            onChange={setInspection}
          />
          <Field label={t("tracking.inspectionMileageIntervalKm")}>
            <NumberInput
              value={inspectionMileageIntervalKm}
              onChange={setInspectionMileageInterval}
              placeholder="20000"
            />
          </Field>
          <p className="crm-form-hint">{t("tracking.inspectionMileageIntervalHint")}</p>
          <ReminderDayChips
            label={t("tracking.documentReminders")}
            value={documentDaysBefore}
            onChange={setDocument}
          />
          <label className="crm-checkbox">
            <input
              type="checkbox"
              checked={weeklyMileageEnabled}
              onChange={(e) => setWeeklyEnabled(e.target.checked)}
            />
            {t("tracking.weeklyMileageEnabled")}
          </label>
          {weeklyMileageEnabled ? (
            <Field label={t("tracking.weeklyMileageWeekday")}>
              <SelectInput
                value={String(weeklyMileageWeekday)}
                onChange={(v) => setWeekday(Number(v))}
                options={weekdayOptions}
              />
            </Field>
          ) : null}
          <FormActions
            onCancel={() => setEditing(false)}
            onSave={() => {
              if (!canSave) return;
              save.mutate(
                {
                  insuranceDaysBefore,
                  inspectionDaysBefore,
                  documentDaysBefore,
                  inspectionMileageIntervalKm:
                    inspectionMileageIntervalKm === "" ? null : inspectionMileageIntervalKm,
                  weeklyMileageEnabled,
                  weeklyMileageWeekday,
                },
                { onSuccess: () => setEditing(false) },
              );
            }}
            saving={save.isPending}
          />
        </div>
      ) : (
        <div className="crm-reminder-summary">
          <div className="crm-reminder-summary__section">
            <div className="crm-reminder-summary__heading">
              {t("tracking.reminderSectionDueDate")}
            </div>
            <SummaryRow
              icon="shield-01"
              label={t("tracking.insuranceReminders")}
              hint={t("tracking.reminderDueBeforeHint")}
            >
              <DaysSummary raw={settings.data?.insuranceDaysBefore ?? ""} />
            </SummaryRow>
            <SummaryRow
              icon="settings-01"
              label={t("tracking.inspectionReminders")}
              hint={t("tracking.reminderDueBeforeHint")}
            >
              <DaysSummary raw={settings.data?.inspectionDaysBefore ?? ""} />
            </SummaryRow>
            <SummaryRow
              icon="file-02"
              label={t("tracking.documentReminders")}
              hint={t("tracking.reminderDueBeforeHint")}
            >
              <DaysSummary raw={settings.data?.documentDaysBefore ?? ""} />
            </SummaryRow>
          </div>

          <div className="crm-reminder-summary__section">
            <div className="crm-reminder-summary__heading">
              {t("tracking.reminderSectionMileage")}
            </div>
            <SummaryRow
              icon="chart-bar-line"
              label={t("tracking.inspectionMileageIntervalKm")}
              hint={t("tracking.reminderMileageHint")}
            >
              {settings.data?.inspectionMileageIntervalKm ? (
                <span className="crm-reminder-summary__chip crm-reminder-summary__chip--accent">
                  {t("tracking.everyKm", {
                    value: settings.data.inspectionMileageIntervalKm.toLocaleString(),
                  })}
                </span>
              ) : (
                <span className="crm-reminder-summary__empty">{t("common.none")}</span>
              )}
            </SummaryRow>
          </div>

          <div className="crm-reminder-summary__section">
            <div className="crm-reminder-summary__heading">
              {t("tracking.reminderSectionCheckIn")}
            </div>
            <SummaryRow
              icon="calendar-01"
              label={t("tracking.weeklyMileageEnabled")}
              hint={t("tracking.reminderCheckInHint")}
            >
              {settings.data?.weeklyMileageEnabled ? (
                <span className="crm-reminder-summary__chip crm-reminder-summary__chip--accent">
                  {weekdayLabel(settings.data.weeklyMileageWeekday)}
                </span>
              ) : (
                <span className="crm-reminder-summary__empty">{t("common.off")}</span>
              )}
            </SummaryRow>
          </div>

          <IconActionButton
            icon="edit-02"
            label={t("common.edit")}
            onClick={() => setEditing(true)}
            className="crm-reminder-settings__edit"
          />
        </div>
      )}
    </SectionCard>
  );
}
