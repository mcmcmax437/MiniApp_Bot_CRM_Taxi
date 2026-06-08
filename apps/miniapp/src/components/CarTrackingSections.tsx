import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaintenanceIntervalKind } from "@taxi/shared";
import {
  useCompleteMaintenance,
  useCreateMaintenanceRule,
  useDeleteMaintenanceRule,
  useLogMileage,
  useMaintenanceRecords,
  useMaintenanceRules,
  useMileageLogs,
} from "../hooks";
import type { Car, MaintenanceRule } from "../types";
import {
  hasMaintenancePreset,
  maintenanceRecordLabel,
  maintenanceRuleLabel,
} from "./trackingLabels";
import { Modal, Field, TextInput, NumberInput, DateInput, SelectInput, FormActions, formatDate } from "./ui";

const MAINTENANCE_PRESETS: Array<{
  nameKey: string;
  intervalKind: MaintenanceIntervalKind;
  intervalValue: number;
  yearlyMonth?: number;
}> = [
  { nameKey: "presetRadiator", intervalKind: MaintenanceIntervalKind.YEARLY, intervalValue: 1, yearlyMonth: 4 },
  { nameKey: "presetOil", intervalKind: MaintenanceIntervalKind.MILEAGE, intervalValue: 15000 },
  { nameKey: "presetGearbox", intervalKind: MaintenanceIntervalKind.MILEAGE, intervalValue: 200000 },
  { nameKey: "presetInspectionService", intervalKind: MaintenanceIntervalKind.MONTHS, intervalValue: 12 },
];

function formatMileage(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString()} km`;
}

function ruleDueLabel(rule: MaintenanceRule, currentMileage: number | null | undefined): string {
  const parts: string[] = [];
  if (rule.nextDueDate) parts.push(formatDate(rule.nextDueDate));
  if (rule.nextDueMileage != null) {
    const left =
      currentMileage != null ? rule.nextDueMileage - currentMileage : rule.nextDueMileage;
    parts.push(`${left.toLocaleString()} km`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function CarTrackingSections(props: {
  car: Car;
  onUpdated?: () => void;
}) {
  const { t } = useTranslation();
  const carId = props.car.id;
  const rules = useMaintenanceRules(carId);
  const records = useMaintenanceRecords(carId);
  const mileageLogs = useMileageLogs(carId);

  const [mileageOpen, setMileageOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const current = props.car.currentMileage ?? null;
  const updatedAt = props.car.mileageUpdatedAt;

  return (
    <>
      <section className="glass-card crm-car-detail-section">
        <div className="crm-section-head">
          <h3 className="crm-car-detail-section__title">{t("tracking.mileageTitle")}</h3>
          <button type="button" className="crm-link-btn" onClick={() => setMileageOpen(true)}>
            {t("tracking.logMileage")}
          </button>
        </div>
        <dl className="crm-car-detail-dl">
          <div className="crm-car-detail-dl__row">
            <dt>{t("tracking.currentMileage")}</dt>
            <dd>{formatMileage(current)}</dd>
          </div>
          {updatedAt ? (
            <div className="crm-car-detail-dl__row">
              <dt>{t("tracking.lastUpdated")}</dt>
              <dd>{formatDate(updatedAt)}</dd>
            </div>
          ) : null}
        </dl>
        {mileageLogs.isLoading ? (
          <p className="crm-form-hint">{t("common.loading")}</p>
        ) : mileageLogs.data && mileageLogs.data.length > 0 ? (
          <ul className="crm-tracking-history">
            {mileageLogs.data.slice(0, 8).map((log) => (
              <li key={log.id}>
                <span>{formatMileage(log.odometer)}</span>
                <span className="crm-tracking-history__meta">
                  {formatDate(log.recordedAt)} · {t(`tracking.source.${log.source}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-form-hint">{t("tracking.noMileageHistory")}</p>
        )}
      </section>

      <section className="glass-card crm-car-detail-section">
        <div className="crm-section-head">
          <h3 className="crm-car-detail-section__title">{t("tracking.maintenanceRules")}</h3>
          <button type="button" className="crm-link-btn" onClick={() => setRuleOpen(true)}>
            {t("tracking.addRule")}
          </button>
        </div>
        <div className="crm-tracking-presets">
          <span className="crm-form-hint">{t("tracking.presetsHint")}</span>
          <PresetButtons carId={carId} existing={rules.data ?? []} onAdded={props.onUpdated} />
        </div>
        {rules.isLoading ? (
          <p className="crm-form-hint">{t("common.loading")}</p>
        ) : rules.data && rules.data.length > 0 ? (
          <ul className="crm-tracking-rules">
            {rules.data.map((rule) => (
              <li key={rule.id} className="crm-tracking-rules__item">
                <div>
                  <strong>{maintenanceRuleLabel(rule, t)}</strong>
                  {rule.isMandatory ? (
                    <span className="crm-badge crm-badge--muted">{t("tracking.mandatory")}</span>
                  ) : null}
                  <div className="crm-tracking-rules__due">
                    {t("tracking.nextDue")}: {ruleDueLabel(rule, current)}
                  </div>
                  <div className="crm-form-hint">
                    {t(`tracking.interval.${rule.intervalKind}`, {
                      value: rule.intervalValue,
                      month: rule.yearlyMonth ?? "",
                    })}
                  </div>
                </div>
                <RuleDeleteButton ruleId={rule.id} onDeleted={props.onUpdated} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-form-hint">{t("tracking.noRules")}</p>
        )}
        <button type="button" className="crm-btn-outline crm-tracking-complete-btn" onClick={() => setCompleteOpen(true)}>
          {t("tracking.completeService")}
        </button>
      </section>

      <section className="glass-card crm-car-detail-section">
        <h3 className="crm-car-detail-section__title">{t("tracking.serviceHistory")}</h3>
        {records.isLoading ? (
          <p className="crm-form-hint">{t("common.loading")}</p>
        ) : records.data && records.data.length > 0 ? (
          <ul className="crm-tracking-history">
            {records.data.map((rec) => (
              <li key={rec.id}>
                <span>{maintenanceRecordLabel(rec, t, rules.data ?? [])}</span>
                <span className="crm-tracking-history__meta">
                  {formatDate(rec.completedAt)}
                  {rec.mileageAt != null ? ` · ${formatMileage(rec.mileageAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-form-hint">{t("tracking.noHistory")}</p>
        )}
      </section>

      <LogMileageModal
        open={mileageOpen}
        carId={carId}
        currentMileage={current}
        onClose={() => setMileageOpen(false)}
        onSaved={() => {
          setMileageOpen(false);
          props.onUpdated?.();
        }}
      />
      <AddRuleModal open={ruleOpen} carId={carId} onClose={() => setRuleOpen(false)} onSaved={() => { setRuleOpen(false); props.onUpdated?.(); }} />
      <CompleteServiceModal
        open={completeOpen}
        carId={carId}
        rules={rules.data ?? []}
        currentMileage={current}
        onClose={() => setCompleteOpen(false)}
        onSaved={() => { setCompleteOpen(false); props.onUpdated?.(); }}
      />
    </>
  );
}

function PresetButtons(props: {
  carId: string;
  existing: MaintenanceRule[];
  onAdded?: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateMaintenanceRule();

  return (
    <div className="crm-tracking-presets__row">
      {MAINTENANCE_PRESETS.map((p) => {
        const name = t(`tracking.${p.nameKey}`);
        if (hasMaintenancePreset(props.existing, p.nameKey, t)) return null;
        return (
          <button
            key={p.nameKey}
            type="button"
            className="crm-chip-btn"
            disabled={create.isPending}
            onClick={() => {
              create.mutate(
                {
                  carId: props.carId,
                  name,
                  presetKey: p.nameKey,
                  intervalKind: p.intervalKind,
                  intervalValue: p.intervalValue,
                  yearlyMonth: p.yearlyMonth ?? null,
                  isMandatory: true,
                  isActive: true,
                },
                { onSuccess: () => props.onAdded?.() },
              );
            }}
          >
            + {name}
          </button>
        );
      })}
    </div>
  );
}

function RuleDeleteButton(props: { ruleId: string; onDeleted?: () => void }) {
  const { t } = useTranslation();
  const del = useDeleteMaintenanceRule();
  return (
    <button
      type="button"
      className="crm-icon-btn"
      aria-label={t("common.delete")}
      onClick={() => {
        if (confirm(t("common.confirmDelete"))) {
          del.mutate(props.ruleId, { onSuccess: () => props.onDeleted?.() });
        }
      }}
    >
      ×
    </button>
  );
}

function LogMileageModal(props: {
  open: boolean;
  carId: string;
  currentMileage: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const log = useLogMileage();
  const [odometer, setOdometer] = useState<number | "">("");
  const [note, setNote] = useState("");

  if (!props.open) return null;

  return (
    <Modal
      open
      title={t("tracking.logMileage")}
      onClose={props.onClose}
      footer={<FormActions onCancel={props.onClose} onSave={() => {
        if (odometer === "") return;
        log.mutate(
          { carId: props.carId, odometer, note: note || null, source: "MANUAL" },
          { onSuccess: props.onSaved },
        );
      }} saving={log.isPending} />}
    >
      {props.currentMileage != null ? (
        <p className="crm-form-hint">{t("tracking.currentMileage")}: {formatMileage(props.currentMileage)}</p>
      ) : null}
      <Field label={t("tracking.odometer")}>
        <NumberInput value={odometer} onChange={setOdometer} />
      </Field>
      <Field label={t("cars.notes")}>
        <TextInput value={note} onChange={setNote} />
      </Field>
    </Modal>
  );
}

function AddRuleModal(props: { open: boolean; carId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const create = useCreateMaintenanceRule();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intervalKind, setIntervalKind] = useState<MaintenanceIntervalKind>(MaintenanceIntervalKind.MONTHS);
  const [intervalValue, setIntervalValue] = useState<number | "">(12);
  const [yearlyMonth, setYearlyMonth] = useState<number | "">(4);
  const [isMandatory, setMandatory] = useState(true);

  if (!props.open) return null;

  const intervalOptions = Object.values(MaintenanceIntervalKind).map((k) => ({
    value: k,
    label: t(`tracking.intervalKind.${k}`),
  }));

  return (
    <Modal
      open
      title={t("tracking.addRule")}
      onClose={props.onClose}
      footer={
        <FormActions
          onCancel={props.onClose}
          onSave={() => {
            if (!name.trim() || intervalValue === "") return;
            create.mutate(
              {
                carId: props.carId,
                name: name.trim(),
                intervalKind,
                intervalValue,
                yearlyMonth: intervalKind === MaintenanceIntervalKind.YEARLY ? yearlyMonth || null : null,
                isMandatory,
                isActive: true,
              },
              { onSuccess: props.onSaved },
            );
          }}
          saving={create.isPending}
        />
      }
    >
      <Field label={t("tracking.ruleName")}>
        <TextInput value={name} onChange={setName} />
      </Field>
      <Field label={t("tracking.ruleDescription")}>
        <TextInput value={description} onChange={setDescription} />
      </Field>
      <Field label={t("tracking.intervalKindLabel")}>
        <SelectInput value={intervalKind} onChange={setIntervalKind} options={intervalOptions} />
      </Field>
      <Field label={t("tracking.intervalValueLabel")}>
        <NumberInput value={intervalValue} onChange={setIntervalValue} />
      </Field>
      {intervalKind === MaintenanceIntervalKind.YEARLY ? (
        <Field label={t("tracking.yearlyMonth")}>
          <NumberInput value={yearlyMonth} onChange={setYearlyMonth} />
        </Field>
      ) : null}
      <label className="crm-checkbox">
        <input type="checkbox" checked={isMandatory} onChange={(e) => setMandatory(e.target.checked)} />
        {t("tracking.mandatory")}
      </label>
    </Modal>
  );
}

function CompleteServiceModal(props: {
  open: boolean;
  carId: string;
  rules: MaintenanceRule[];
  currentMileage: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const complete = useCompleteMaintenance();
  const [title, setTitle] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [mileageAt, setMileageAt] = useState<number | "">(props.currentMileage ?? "");
  const [notes, setNotes] = useState("");

  if (!props.open) return null;

  const ruleOptions = [
    { value: "", label: t("tracking.noLinkedRule") },
    ...props.rules.map((r) => ({ value: r.id, label: maintenanceRuleLabel(r, t) })),
  ];

  return (
    <Modal
      open
      title={t("tracking.completeService")}
      onClose={props.onClose}
      footer={
        <FormActions
          onCancel={props.onClose}
          onSave={() => {
            if (!title.trim()) return;
            complete.mutate(
              {
                carId: props.carId,
                ruleId: ruleId || null,
                title: title.trim(),
                presetKey,
                completedAt,
                mileageAt: mileageAt === "" ? null : mileageAt,
                notes: notes || null,
              },
              { onSuccess: props.onSaved },
            );
          }}
          saving={complete.isPending}
        />
      }
    >
      <Field label={t("tracking.serviceTitle")}>
        <TextInput value={title} onChange={setTitle} />
      </Field>
      <Field label={t("tracking.linkedRule")}>
        <SelectInput
          value={ruleId}
          onChange={(v) => {
            setRuleId(v);
            const rule = props.rules.find((r) => r.id === v);
            if (rule) {
              setPresetKey(rule.presetKey ?? null);
              if (!title) setTitle(maintenanceRuleLabel(rule, t));
            } else {
              setPresetKey(null);
            }
          }}
          options={ruleOptions}
        />
      </Field>
      <Field label={t("tracking.completedAt")}>
        <DateInput value={completedAt} onChange={setCompletedAt} />
      </Field>
      <Field label={t("tracking.odometer")}>
        <NumberInput value={mileageAt} onChange={setMileageAt} />
      </Field>
      <Field label={t("cars.notes")}>
        <TextInput value={notes} onChange={setNotes} />
      </Field>
    </Modal>
  );
}
