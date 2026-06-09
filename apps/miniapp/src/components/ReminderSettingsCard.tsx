import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReminderSettings, useSaveReminderSettings } from "../hooks";
import { SectionCard, Icon, IconActionButton } from "./crm";
import { Field, SelectInput, NumberInput, FormActions } from "./ui";
import { parseReminderDays, ReminderDayChips } from "./ReminderDayChips";

export function ReminderSettingsCard() {
  const { t } = useTranslation();
  const settings = useReminderSettings();
  const save = useSaveReminderSettings();
  const [editing, setEditing] = useState(false);
  const [insuranceDaysBefore, setInsurance] = useState("14,7,3");
  const [inspectionDaysBefore, setInspection] = useState("7,3,1");
  const [documentDaysBefore, setDocument] = useState("14,7,3");
  const [maintenanceDaysBefore, setMaintenance] = useState("14,7,3");
  const [inspectionMileageIntervalKm, setInspectionMileageInterval] = useState<number | "">("");
  const [weeklyMileageEnabled, setWeeklyEnabled] = useState(true);
  const [weeklyMileageWeekday, setWeekday] = useState(1);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setInsurance(s.insuranceDaysBefore);
    setInspection(s.inspectionDaysBefore);
    setDocument(s.documentDaysBefore);
    setMaintenance(s.maintenanceDaysBefore);
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
    parseReminderDays(documentDaysBefore).size > 0 &&
    parseReminderDays(maintenanceDaysBefore).size > 0;

  function formatDaysSummary(raw: string): string {
    const days = [...parseReminderDays(raw)].sort((a, b) => b - a);
    if (days.length === 0) return "—";
    return days.map((d) => t("tracking.daysBeforeChip", { count: d })).join(", ");
  }

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
          <ReminderDayChips
            label={t("tracking.maintenanceReminders")}
            value={maintenanceDaysBefore}
            onChange={setMaintenance}
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
                  maintenanceDaysBefore,
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
        <div>
          <dl className="crm-car-detail-dl">
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.insuranceReminders")}</dt>
              <dd>{formatDaysSummary(settings.data?.insuranceDaysBefore ?? "")}</dd>
            </div>
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.inspectionReminders")}</dt>
              <dd>{formatDaysSummary(settings.data?.inspectionDaysBefore ?? "")}</dd>
            </div>
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.inspectionMileageIntervalKm")}</dt>
              <dd>
                {settings.data?.inspectionMileageIntervalKm
                  ? t("tracking.everyKm", { value: settings.data.inspectionMileageIntervalKm })
                  : t("common.none")}
              </dd>
            </div>
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.documentReminders")}</dt>
              <dd>{formatDaysSummary(settings.data?.documentDaysBefore ?? "")}</dd>
            </div>
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.maintenanceReminders")}</dt>
              <dd>{formatDaysSummary(settings.data?.maintenanceDaysBefore ?? "")}</dd>
            </div>
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.weeklyMileageEnabled")}</dt>
              <dd>
                {settings.data?.weeklyMileageEnabled
                  ? weekdayLabel(settings.data.weeklyMileageWeekday)
                  : t("common.none")}
              </dd>
            </div>
          </dl>
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
