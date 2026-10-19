import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaintenanceIntervalKind } from "@taxi/shared";
import {
  useCompleteMaintenance,
  useCreateMaintenanceRule,
  useDeleteMaintenanceRule,
  useDeleteMileageLog,
  useLogMileage,
  useMaintenanceRecords,
  useMaintenanceRules,
  useMileageLogs,
  useSyncTrackerDays,
  useTrackerDays,
} from "../hooks";
import { confirmAction, showAlert } from "../telegram";
import { ApiError } from "../api";
import { IconActionButton } from "./crm";
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

function weekStartKey(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function formatDriven(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return `${rounded.toLocaleString()} km`;
}

function formatMileage(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString()} km`;
}

function OdometerChart(props: {
  logs: Array<{ id: string; odometer: number; recordedAt: string; source: string }>;
  readOnly?: boolean;
  onDelete?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(props.logs[0]?.id ?? null);
  const points = [...props.logs].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const selected = points.find((log) => log.id === selectedId) ?? points[points.length - 1];
  const width = 320;
  const height = 120;
  const pad = 16;
  const min = Math.min(...points.map((log) => log.odometer));
  const max = Math.max(...points.map((log) => log.odometer));
  const span = Math.max(max - min, 1);
  const coords = points.map((log, index) => {
    const x = points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((log.odometer - min) / span) * (height - pad * 2);
    return { log, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="crm-odo-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="crm-odo-chart__svg" role="img">
        {coords.length > 1 ? <polyline points={line} className="crm-odo-chart__line" /> : null}
        {coords.map((point) => (
          <circle
            key={point.log.id}
            cx={point.x}
            cy={point.y}
            r={selected?.id === point.log.id ? 6 : 4.5}
            className={`crm-odo-chart__dot${selected?.id === point.log.id ? " crm-odo-chart__dot--on" : ""}`}
            onClick={() => setSelectedId(point.log.id)}
          />
        ))}
      </svg>
      {selected ? (
        <div className="crm-odo-chart__info">
          <strong>{formatMileage(selected.odometer)}</strong>
          <span>
            {formatDate(selected.recordedAt)} · {t(`tracking.source.${selected.source}`)}
          </span>
          {!props.readOnly && props.onDelete ? (
            <button type="button" className="crm-link-btn" onClick={() => props.onDelete?.(selected.id)}>
              {t("common.delete")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function previousWeekInputs(now = new Date()): { from: string; to: string } {
  const [y, m, d] = now.toISOString().slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  const thisMonday = new Date(date);
  thisMonday.setUTCDate(date.getUTCDate() - sinceMonday);
  const prevMonday = new Date(thisMonday);
  prevMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const sunday = new Date(thisMonday);
  sunday.setUTCDate(thisMonday.getUTCDate() - 1);
  return { from: prevMonday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}
function GpsDistanceSection(props: { car: Car; readOnly?: boolean }) {
  const { t } = useTranslation();
  const days = useTrackerDays(props.car.id);
  const sync = useSyncTrackerDays(props.car.id);
  const canSync = Boolean(props.car.trackerLogin && props.car.trackerPassword);
  const initial = previousWeekInputs();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const weeks = (() => {
    const groups = new Map<string, Array<{ id: string; day: string; distanceKm: number }>>();
    for (const row of days.data ?? []) {
      const key = weekStartKey(row.day);
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([start, rows]) => {
        const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
        const total = Math.round(sorted.reduce((sum, row) => sum + row.distanceKm, 0) * 10) / 10;
        const peak = Math.max(...sorted.map((row) => row.distanceKm), 1);
        return { start, rows: sorted, total, peak };
      });
  })();
  const shownWeek = openWeek ?? weeks[0]?.start ?? null;

  function loadRange() {
    sync.mutate(
      from && to ? { start: from <= to ? from : to, end: from <= to ? to : from } : undefined,
      {
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : undefined;
          const key =
            code === "tracker_not_configured"
              ? "cars.trackerMap.errorNotConfigured"
              : code === "tracker_login_failed"
                ? "cars.trackerMap.errorLogin"
                : "cars.trackerMap.errorUnavailable";
          showAlert(t(key));
        },
      },
    );
  }

  return (
    <section className="glass-card crm-car-detail-section">
      <div className="crm-section-head">
        <h3 className="crm-car-detail-section__title">{t("tracking.gpsDistanceTitle")}</h3>
      </div>
      {!props.readOnly && canSync ? (
        <div className="crm-gps-load">
          <DateInput value={from} onChange={setFrom} />
          <DateInput value={to} onChange={setTo} />
          <button type="button" className="crm-btn-outline crm-gps-load__btn" disabled={sync.isPending} onClick={loadRange}>
            {sync.isPending ? t("common.loading") : t("tracking.loadGpsWeek")}
          </button>
        </div>
      ) : null}
      {days.isLoading ? (
        <p className="crm-form-hint">{t("common.loading")}</p>
      ) : weeks.length === 0 ? (
        <p className="crm-form-hint">{t("tracking.gpsEmpty")}</p>
      ) : (
        weeks.map((week) => {
          const open = shownWeek === week.start;
          const end = week.rows[week.rows.length - 1]?.day ?? week.start;
          return (
            <div key={week.start} className="crm-gps-week">
              <button
                type="button"
                className="crm-gps-week__head"
                aria-expanded={open}
                onClick={() => setOpenWeek(open ? "" : week.start)}
              >
                <span>
                  {formatDate(week.start)} – {formatDate(end)}
                </span>
                <strong>
                  {formatDriven(week.total)} {open ? "▴" : "▾"}
                </strong>
              </button>
              {open ? (
                <ul className="crm-gps-week__days">
                  {week.rows.map((row) => (
                    <li key={row.id} className="crm-gps-week__day">
                      <span className="crm-gps-week__date">{formatDate(row.day)}</span>
                      <span className="crm-gps-week__bar">
                        <span style={{ width: `${Math.max(4, (row.distanceKm / week.peak) * 100)}%` }} />
                      </span>
                      <span className="crm-gps-week__km">{formatDriven(row.distanceKm)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
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
  readOnly?: boolean;
  onUpdated?: () => void;
}) {
  const { t } = useTranslation();
  const readOnly = props.readOnly;
  const carId = props.car.id;
  const rules = useMaintenanceRules(carId);
  const records = useMaintenanceRecords(carId);
  const mileageLogs = useMileageLogs(carId);
  const deleteMileage = useDeleteMileageLog();

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
          {!readOnly ? (
            <button type="button" className="crm-link-btn" onClick={() => setMileageOpen(true)}>
              {t("tracking.logMileage")}
            </button>
          ) : null}
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
          <OdometerChart
            logs={mileageLogs.data}
            readOnly={readOnly}
            onDelete={(id) => {
              void confirmAction(t("tracking.deleteMileageConfirm"), t("common.delete"), t("common.cancel")).then(
                (ok) => {
                  if (ok) deleteMileage.mutate(id, { onSuccess: () => props.onUpdated?.() });
                },
              );
            }}
          />
        ) : (
          <p className="crm-form-hint">{t("tracking.noMileageHistory")}</p>
        )}
      </section>

      <GpsDistanceSection car={props.car} readOnly={readOnly} />

      <section className="glass-card crm-car-detail-section">
        <div className="crm-section-head">
          <h3 className="crm-car-detail-section__title">{t("tracking.maintenanceRules")}</h3>
          {!readOnly ? (
            <IconActionButton
              icon="add-01"
              label={t("tracking.addRule")}
              onClick={() => setRuleOpen(true)}
            />
          ) : null}
        </div>
        {!readOnly ? (
          <div className="crm-tracking-presets">
            <span className="crm-form-hint">{t("tracking.presetsHint")}</span>
            <PresetButtons carId={carId} existing={rules.data ?? []} onAdded={props.onUpdated} />
          </div>
        ) : null}
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
                {!readOnly ? <RuleDeleteButton ruleId={rule.id} onDeleted={props.onUpdated} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="crm-form-hint">{t("tracking.noRules")}</p>
        )}
        {!readOnly ? (
          <button type="button" className="crm-btn-outline crm-tracking-complete-btn" onClick={() => setCompleteOpen(true)}>
            {t("tracking.completeService")}
          </button>
        ) : null}
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
