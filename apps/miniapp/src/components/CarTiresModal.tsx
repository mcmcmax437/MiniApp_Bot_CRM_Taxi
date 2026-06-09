import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TireSeason } from "@taxi/shared";
import { useSaveCar } from "../hooks";
import type { Car } from "../types";
import { Modal, Field, TextInput, DateInput, SelectInput, FormActions } from "./ui";

const ph = (t: (k: string) => string, key: string) => t(`cars.placeholder.${key}`);

export interface TireFormState {
  tireFrontBrand: string;
  tireFrontSize: string;
  tireFrontSeason: TireSeason | "";
  tireFrontInstalledAt: string;
  tireFrontNotes: string;
  tireRearBrand: string;
  tireRearSize: string;
  tireRearSeason: TireSeason | "";
  tireRearInstalledAt: string;
  tireRearNotes: string;
}

export function carToTireForm(car: Car): TireFormState {
  return {
    tireFrontBrand: car.tireFrontBrand ?? car.tireBrand ?? "",
    tireFrontSize: car.tireFrontSize ?? car.tireSize ?? "",
    tireFrontSeason: car.tireFrontSeason ?? car.tireSeason ?? "",
    tireFrontInstalledAt: (car.tireFrontInstalledAt ?? car.tireInstalledAt)
      ? (car.tireFrontInstalledAt ?? car.tireInstalledAt)!.slice(0, 10)
      : "",
    tireFrontNotes: car.tireFrontNotes ?? car.tireNotes ?? "",
    tireRearBrand: car.tireRearBrand ?? "",
    tireRearSize: car.tireRearSize ?? "",
    tireRearSeason: car.tireRearSeason ?? "",
    tireRearInstalledAt: car.tireRearInstalledAt ? car.tireRearInstalledAt.slice(0, 10) : "",
    tireRearNotes: car.tireRearNotes ?? "",
  };
}

function tirePayload(form: TireFormState): Record<string, unknown> {
  return {
    tireBrand: null,
    tireSize: null,
    tireSeason: null,
    tireInstalledAt: null,
    tireNotes: null,
    tireFrontBrand: form.tireFrontBrand.trim() || null,
    tireFrontSize: form.tireFrontSize.trim() || null,
    tireFrontSeason: form.tireFrontSeason || null,
    tireFrontInstalledAt: form.tireFrontInstalledAt || null,
    tireFrontNotes: form.tireFrontNotes.trim() || null,
    tireRearBrand: form.tireRearBrand.trim() || null,
    tireRearSize: form.tireRearSize.trim() || null,
    tireRearSeason: form.tireRearSeason || null,
    tireRearInstalledAt: form.tireRearInstalledAt || null,
    tireRearNotes: form.tireRearNotes.trim() || null,
  };
}

export function CarTiresModal(props: {
  open: boolean;
  car: Car;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveCar();
  const [form, setForm] = useState<TireFormState>(() => carToTireForm(props.car));

  useEffect(() => {
    if (props.open) setForm(carToTireForm(props.car));
  }, [props.open, props.car]);

  function patch(patch: Partial<TireFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  return (
    <Modal
      open={props.open}
      title={t("cars.tiresTitle")}
      onClose={props.onClose}
      footer={
        <FormActions
          onCancel={props.onClose}
          onSave={() => {
            save.mutate(
              { id: props.car.id, data: tirePayload(form) },
              {
                onSuccess: () => {
                  props.onSaved?.();
                  props.onClose();
                },
              },
            );
          }}
          saving={save.isPending}
        />
      }
    >
      <div className="crm-form-section-label">{t("cars.tireFrontTitle")}</div>
      <TireAxleFields
        t={t}
        brand={form.tireFrontBrand}
        size={form.tireFrontSize}
        season={form.tireFrontSeason}
        installedAt={form.tireFrontInstalledAt}
        notes={form.tireFrontNotes}
        onBrand={(v) => patch({ tireFrontBrand: v })}
        onSize={(v) => patch({ tireFrontSize: v })}
        onSeason={(v) => patch({ tireFrontSeason: v })}
        onInstalledAt={(v) => patch({ tireFrontInstalledAt: v })}
        onNotes={(v) => patch({ tireFrontNotes: v })}
      />
      <div className="crm-form-section-label">{t("cars.tireRearTitle")}</div>
      <TireAxleFields
        t={t}
        brand={form.tireRearBrand}
        size={form.tireRearSize}
        season={form.tireRearSeason}
        installedAt={form.tireRearInstalledAt}
        notes={form.tireRearNotes}
        onBrand={(v) => patch({ tireRearBrand: v })}
        onSize={(v) => patch({ tireRearSize: v })}
        onSeason={(v) => patch({ tireRearSeason: v })}
        onInstalledAt={(v) => patch({ tireRearInstalledAt: v })}
        onNotes={(v) => patch({ tireRearNotes: v })}
      />
    </Modal>
  );
}

function TireAxleFields(props: {
  t: (key: string) => string;
  brand: string;
  size: string;
  season: TireSeason | "";
  installedAt: string;
  notes: string;
  onBrand: (v: string) => void;
  onSize: (v: string) => void;
  onSeason: (v: TireSeason | "") => void;
  onInstalledAt: (v: string) => void;
  onNotes: (v: string) => void;
}) {
  return (
    <>
      <Field label={props.t("cars.tireBrand")}>
        <TextInput value={props.brand} placeholder={ph(props.t, "tireBrand")} onChange={props.onBrand} />
      </Field>
      <Field label={props.t("cars.tireSize")}>
        <TextInput value={props.size} placeholder={ph(props.t, "tireSize")} onChange={props.onSize} />
      </Field>
      <Field label={props.t("cars.tireSeasonField")}>
        <SelectInput
          value={props.season}
          onChange={props.onSeason}
          options={[
            { value: "", label: "—" },
            ...Object.values(TireSeason).map((s) => ({
              value: s,
              label: props.t(`cars.tireSeason.${s}`),
            })),
          ]}
        />
      </Field>
      <Field label={props.t("cars.tireInstalledAt")}>
        <DateInput
          value={props.installedAt}
          example={ph(props.t, "tireInstalledAt")}
          clearable
          onChange={props.onInstalledAt}
        />
      </Field>
      <Field label={props.t("cars.tireNotes")}>
        <TextInput value={props.notes} placeholder={ph(props.t, "tireNotes")} onChange={props.onNotes} />
      </Field>
    </>
  );
}
