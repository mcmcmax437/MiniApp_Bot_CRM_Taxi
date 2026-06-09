import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSaveCar } from "../hooks";
import type { Car } from "../types";
import { Modal, Field, TextInput, PasswordInput, FormActions } from "./ui";

const ph = (t: (k: string) => string, key: string) => t(`cars.placeholder.${key}`);

export interface TrackerFormState {
  trackerLogin: string;
  trackerPassword: string;
  trackerUrl: string;
  trackerNotes: string;
}

export function carToTrackerForm(car: Car): TrackerFormState {
  return {
    trackerLogin: car.trackerLogin ?? "",
    trackerPassword: car.trackerPassword ?? "",
    trackerUrl: car.trackerUrl ?? "",
    trackerNotes: car.trackerNotes ?? "",
  };
}

function trackerPayload(form: TrackerFormState): Record<string, unknown> {
  return {
    trackerLogin: form.trackerLogin.trim() || null,
    trackerPassword: form.trackerPassword.trim() || null,
    trackerUrl: form.trackerUrl.trim() || null,
    trackerNotes: form.trackerNotes.trim() || null,
  };
}

export function CarTrackerModal(props: {
  open: boolean;
  car: Car;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveCar();
  const [form, setForm] = useState<TrackerFormState>(() => carToTrackerForm(props.car));

  useEffect(() => {
    if (props.open) setForm(carToTrackerForm(props.car));
  }, [props.open, props.car]);

  function patch(patch: Partial<TrackerFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  return (
    <Modal
      open={props.open}
      title={t("cars.trackerTitle")}
      onClose={props.onClose}
      footer={
        <FormActions
          onCancel={props.onClose}
          onSave={() => {
            save.mutate(
              { id: props.car.id, data: trackerPayload(form) },
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
      <Field label={t("cars.trackerLogin")}>
        <TextInput
          value={form.trackerLogin}
          placeholder={ph(t, "trackerLogin")}
          onChange={(v) => patch({ trackerLogin: v })}
        />
      </Field>
      <Field label={t("cars.trackerPassword")}>
        <PasswordInput
          value={form.trackerPassword}
          placeholder={ph(t, "trackerPassword")}
          onChange={(v) => patch({ trackerPassword: v })}
        />
      </Field>
      <Field label={t("cars.trackerUrl")}>
        <TextInput
          value={form.trackerUrl}
          placeholder={ph(t, "trackerUrl")}
          onChange={(v) => patch({ trackerUrl: v })}
        />
      </Field>
      <Field label={t("cars.trackerNotes")}>
        <TextInput
          value={form.trackerNotes}
          placeholder={ph(t, "trackerNotes")}
          onChange={(v) => patch({ trackerNotes: v })}
        />
      </Field>
    </Modal>
  );
}
