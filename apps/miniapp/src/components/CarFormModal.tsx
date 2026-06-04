import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus, carFormFieldErrors, type CarFormField } from "@taxi/shared";
import { useDeleteCar, useSaveCar, useUploadDocument } from "../hooks";
import type { Car } from "../types";
import {
  Modal,
  type ModalHandle,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
} from "./ui";
import { CarPhotoPicker, type PendingCarPhoto } from "./CarPhotoPicker";
import { CarPhotosSection } from "./CarPhotosSection";

const ph = (t: (k: string) => string, key: string) => t(`cars.placeholder.${key}`);

export interface CarFormState {
  plate: string;
  make: string;
  model: string;
  year: number | "";
  status: CarStatus;
  insuranceExpiry: string;
  inspectionExpiry: string;
  notes: string;
}

export const emptyCarForm: CarFormState = {
  plate: "",
  make: "",
  model: "",
  year: "",
  status: CarStatus.AVAILABLE,
  insuranceExpiry: "",
  inspectionExpiry: "",
  notes: "",
};

export function carToForm(car: Car): CarFormState {
  return {
    plate: car.plate,
    make: car.make ?? "",
    model: car.model ?? "",
    year: car.year ?? "",
    status: car.status,
    insuranceExpiry: car.insuranceExpiry ? car.insuranceExpiry.slice(0, 10) : "",
    inspectionExpiry: car.inspectionExpiry ? car.inspectionExpiry.slice(0, 10) : "",
    notes: car.notes ?? "",
  };
}

export function CarFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  car?: Car;
  onClose: () => void;
  onSaved?: (car: Car) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveCar();
  const upload = useUploadDocument();
  const del = useDeleteCar();
  const isEdit = props.mode === "edit" && props.car;

  const [form, setForm] = useState<CarFormState>(() =>
    props.car ? carToForm(props.car) : emptyCarForm,
  );
  const [pendingPhotos, setPendingPhotos] = useState<PendingCarPhoto[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<CarFormField>>(new Set());
  const modalRef = useRef<ModalHandle>(null);

  const requiredMsg = t("common.requiredField");

  useEffect(() => {
    if (!props.open) return;
    setForm(props.car ? carToForm(props.car) : emptyCarForm);
    setPendingPhotos((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
    setCoverKey(null);
    setFieldErrors(new Set());
  }, [props.open, props.car?.id]);

  function clearPendingPhotos(photos: PendingCarPhoto[]) {
    for (const p of photos) URL.revokeObjectURL(p.previewUrl);
  }

  function resetForm() {
    setForm(props.car ? carToForm(props.car) : emptyCarForm);
    clearPendingPhotos(pendingPhotos);
    setPendingPhotos([]);
    setCoverKey(null);
    setFieldErrors(new Set());
  }

  function handleClosed() {
    resetForm();
    props.onClose();
  }

  function requestClose() {
    modalRef.current?.dismiss();
  }

  function patchForm(patch: Partial<CarFormState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (fieldErrors.size > 0) {
        const nextErrors = new Set(fieldErrors);
        for (const key of Object.keys(patch) as CarFormField[]) {
          nextErrors.delete(key);
        }
        setFieldErrors(nextErrors);
      }
      return next;
    });
  }

  function fieldInvalid(name: CarFormField): boolean {
    return fieldErrors.has(name);
  }

  function submit() {
    const errors = carFormFieldErrors(form);
    if (errors.size > 0) {
      setFieldErrors(errors);
      return;
    }

    const data: Record<string, unknown> = {
      plate: form.plate.trim(),
      make: form.make || null,
      model: form.model || null,
      year: form.year === "" ? null : form.year,
      status: form.status,
      insuranceExpiry: form.insuranceExpiry || null,
      inspectionExpiry: form.inspectionExpiry || null,
      notes: form.notes || null,
    };

    save.mutate(
      { id: isEdit ? props.car!.id : undefined, data },
      {
        onSuccess: async (car) => {
          const finish = (saved: Car) => {
            props.onSaved?.(saved);
            requestClose();
          };

          if (!isEdit && pendingPhotos.length > 0 && car.id) {
            try {
              const uploaded = await Promise.all(
                pendingPhotos.map((p) =>
                  upload.mutateAsync({
                    relatedType: "CAR",
                    relatedId: car.id,
                    file: p.file,
                  }),
                ),
              );
              const coverIndex = pendingPhotos.findIndex((p) => p.key === coverKey);
              const coverDoc = uploaded[coverIndex >= 0 ? coverIndex : 0];
              if (coverDoc?.id) {
                const updated = await save.mutateAsync({
                  id: car.id,
                  data: { coverDocumentId: coverDoc.id },
                });
                finish(updated);
                return;
              }
            } catch {
              /* still close with base car */
            }
          }
          finish(car);
        },
      },
    );
  }

  return (
    <Modal
      ref={modalRef}
      open={props.open}
      title={isEdit ? t("cars.editCar") : t("cars.addCar")}
      onClose={handleClosed}
      backLabel={t("common.back")}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FormActions
            onCancel={requestClose}
            onSave={submit}
            saving={save.isPending || upload.isPending}
          />
          {isEdit && (
            <button
              type="button"
              className="crm-btn-outline"
              onClick={() => {
                if (confirm(t("common.confirmDelete"))) {
                  del.mutate(props.car!.id, {
                    onSuccess: () => {
                      props.onDeleted?.();
                      requestClose();
                    },
                  });
                }
              }}
            >
              {t("common.delete")}
            </button>
          )}
        </div>
      }
    >
      <Field label={t("cars.plate")} invalid={fieldInvalid("plate")} errorMessage={requiredMsg}>
        <TextInput
          value={form.plate}
          placeholder={ph(t, "plate")}
          invalid={fieldInvalid("plate")}
          onChange={(v) => patchForm({ plate: v })}
        />
      </Field>
      <Field label={t("cars.brand")} invalid={fieldInvalid("make")} errorMessage={requiredMsg}>
        <TextInput
          value={form.make}
          placeholder={ph(t, "brand")}
          invalid={fieldInvalid("make")}
          onChange={(v) => patchForm({ make: v })}
        />
      </Field>
      <Field label={t("cars.model")} invalid={fieldInvalid("model")} errorMessage={requiredMsg}>
        <TextInput
          value={form.model}
          placeholder={ph(t, "model")}
          invalid={fieldInvalid("model")}
          onChange={(v) => patchForm({ model: v })}
        />
      </Field>
      <Field label={t("cars.year")} invalid={fieldInvalid("year")} errorMessage={requiredMsg}>
        <NumberInput
          value={form.year}
          placeholder={ph(t, "year")}
          invalid={fieldInvalid("year")}
          onChange={(v) => patchForm({ year: v })}
        />
      </Field>
      <Field label={t("cars.status")}>
        <SelectInput
          value={form.status}
          onChange={(v) => patchForm({ status: v })}
          options={Object.values(CarStatus).map((s) => ({ value: s, label: t(`cars.${s}`) }))}
        />
      </Field>
      <Field label={t("cars.insurance")} invalid={fieldInvalid("insuranceExpiry")} errorMessage={requiredMsg}>
        <DateInput
          value={form.insuranceExpiry}
          example={ph(t, "insuranceExpiry")}
          invalid={fieldInvalid("insuranceExpiry")}
          onChange={(v) => patchForm({ insuranceExpiry: v })}
        />
      </Field>
      <Field label={t("cars.inspection")} invalid={fieldInvalid("inspectionExpiry")} errorMessage={requiredMsg}>
        <DateInput
          value={form.inspectionExpiry}
          example={ph(t, "inspectionExpiry")}
          invalid={fieldInvalid("inspectionExpiry")}
          onChange={(v) => patchForm({ inspectionExpiry: v })}
        />
      </Field>
      <Field label={t("cars.notes")}>
        <TextInput value={form.notes} placeholder={ph(t, "notes")} onChange={(v) => patchForm({ notes: v })} />
      </Field>
      {!isEdit ? (
        <CarPhotoPicker
          photos={pendingPhotos}
          coverKey={coverKey}
          onPhotosChange={setPendingPhotos}
          onCoverKeyChange={setCoverKey}
        />
      ) : (
        <CarPhotosSection carId={props.car!.id} coverDocumentId={props.car!.coverDocumentId} />
      )}
    </Modal>
  );
}
