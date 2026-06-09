import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus, ExpenseCategory, TireSeason, carFormFieldErrors, type CarFormField } from "@taxi/shared";
import { useDeleteCar, useSaveCar, useSaveExpense, useUploadDocument } from "../hooks";
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
  MoneyNumberInput,
  PasswordInput,
  todayInput,
} from "./ui";
import { CarPhotoPicker, type PendingCarPhoto } from "./CarPhotoPicker";
import { CarPhotosSection } from "./CarPhotosSection";
import { CarDocumentsSection } from "./CarDocumentsSection";
import { showAlert } from "../telegram";
import { ApiError } from "../api";

const ph = (t: (k: string) => string, key: string) => t(`cars.placeholder.${key}`);

export interface CarFormState {
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: number | "";
  status: CarStatus;
  insuranceExpiry: string;
  inspectionExpiry: string;
  notes: string;
  purchasePrice: number | "";
  purchaseDate: string;
  tireBrand: string;
  tireSize: string;
  tireSeason: TireSeason | "";
  tireInstalledAt: string;
  tireNotes: string;
  showTires: boolean;
  trackerLogin: string;
  trackerPassword: string;
  trackerUrl: string;
  trackerNotes: string;
}

export const emptyCarForm: CarFormState = {
  plate: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  status: CarStatus.AVAILABLE,
  insuranceExpiry: "",
  inspectionExpiry: "",
  notes: "",
  purchasePrice: "",
  purchaseDate: todayInput(),
  tireBrand: "",
  tireSize: "",
  tireSeason: "",
  tireInstalledAt: "",
  tireNotes: "",
  showTires: false,
  trackerLogin: "",
  trackerPassword: "",
  trackerUrl: "",
  trackerNotes: "",
};

export function carToForm(car: Car): CarFormState {
  return {
    plate: car.plate,
    vin: car.vin ?? "",
    make: car.make ?? "",
    model: car.model ?? "",
    year: car.year ?? "",
    status: car.status,
    insuranceExpiry: car.insuranceExpiry ? car.insuranceExpiry.slice(0, 10) : "",
    inspectionExpiry: car.inspectionExpiry ? car.inspectionExpiry.slice(0, 10) : "",
    notes: car.notes ?? "",
    purchasePrice: car.purchasePrice ?? "",
    purchaseDate: car.purchaseDate ? car.purchaseDate.slice(0, 10) : todayInput(),
    tireBrand: car.tireBrand ?? "",
    tireSize: car.tireSize ?? "",
    tireSeason: car.tireSeason ?? "",
    tireInstalledAt: car.tireInstalledAt ? car.tireInstalledAt.slice(0, 10) : "",
    tireNotes: car.tireNotes ?? "",
    showTires: Boolean(
      car.tireBrand || car.tireSize || car.tireSeason || car.tireInstalledAt || car.tireNotes,
    ),
    trackerLogin: car.trackerLogin ?? "",
    trackerPassword: car.trackerPassword ?? "",
    trackerUrl: car.trackerUrl ?? "",
    trackerNotes: car.trackerNotes ?? "",
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
  const saveExpense = useSaveExpense();
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

  function tirePayload(): Record<string, unknown> {
    const hasTireInput =
      form.tireBrand.trim() ||
      form.tireSize.trim() ||
      form.tireSeason ||
      form.tireInstalledAt ||
      form.tireNotes.trim();

    if (!form.showTires && !hasTireInput) {
      return isEdit
        ? {
            tireBrand: null,
            tireSize: null,
            tireSeason: null,
            tireInstalledAt: null,
            tireNotes: null,
          }
        : {};
    }

    return {
      tireBrand: form.tireBrand.trim() || null,
      tireSize: form.tireSize.trim() || null,
      tireSeason: form.tireSeason || null,
      tireInstalledAt: form.tireInstalledAt || null,
      tireNotes: form.tireNotes.trim() || null,
    };
  }

  function submit() {
    const errors = carFormFieldErrors(form);
    if (errors.size > 0) {
      setFieldErrors(errors);
      const first = document.querySelector(".crm-field--error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const data: Record<string, unknown> = {
      plate: form.plate.trim(),
      vin: form.vin.trim().toUpperCase() || null,
      make: form.make || null,
      model: form.model || null,
      year: form.year === "" ? null : form.year,
      status: form.status,
      insuranceExpiry: form.insuranceExpiry || null,
      inspectionExpiry: form.inspectionExpiry || null,
      notes: form.notes || null,
      purchasePrice: form.purchasePrice === "" ? null : form.purchasePrice,
      purchaseDate: form.purchaseDate || null,
      ...tirePayload(),
      trackerLogin: form.trackerLogin.trim() || null,
      trackerPassword: form.trackerPassword.trim() || null,
      trackerUrl: form.trackerUrl.trim() || null,
      trackerNotes: form.trackerNotes.trim() || null,
    };

    save.mutate(
      { id: isEdit ? props.car!.id : undefined, data },
      {
        onError: (err) => {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : t("common.error", { defaultValue: "Something went wrong" });
          void showAlert(msg);
        },
        onSuccess: async (car) => {
          const finish = async (saved: Car) => {
            if (!isEdit && form.purchasePrice !== "" && saved.id) {
              try {
                await saveExpense.mutateAsync({
                  data: {
                    carId: saved.id,
                    category: ExpenseCategory.OTHER,
                    amount: form.purchasePrice,
                    date: form.purchaseDate || todayInput(),
                    note: t("cars.purchaseExpenseNote", { plate: saved.plate }),
                  },
                });
              } catch {
                /* car saved; expense can be added manually */
              }
            }
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
                    isCarPhoto: true,
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
                void finish(updated);
                return;
              }
            } catch {
              /* still close with base car */
            }
          }
          void finish(car);
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
            saving={save.isPending || upload.isPending || saveExpense.isPending}
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
      <Field label={t("cars.vin")}>
        <TextInput
          value={form.vin}
          placeholder={ph(t, "vin")}
          onChange={(v) => patchForm({ vin: v.toUpperCase() })}
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
      <Field label={t("cars.insurance")}>
        <DateInput
          value={form.insuranceExpiry}
          example={ph(t, "insuranceExpiry")}
          clearable
          onChange={(v) => patchForm({ insuranceExpiry: v })}
        />
      </Field>
      <Field label={t("cars.inspection")}>
        <DateInput
          value={form.inspectionExpiry}
          example={ph(t, "inspectionExpiry")}
          clearable
          onChange={(v) => patchForm({ inspectionExpiry: v })}
        />
      </Field>
      <Field label={t("cars.notes")}>
        <TextInput value={form.notes} placeholder={ph(t, "notes")} onChange={(v) => patchForm({ notes: v })} />
      </Field>
      <Field label={t("cars.purchaseDate")}>
        <DateInput
          value={form.purchaseDate}
          example={ph(t, "purchaseDate")}
          clearable
          onChange={(v) => patchForm({ purchaseDate: v })}
        />
      </Field>
      <Field label={t("cars.purchasePrice")}>
        <MoneyNumberInput
          value={form.purchasePrice}
          placeholder={ph(t, "purchasePrice")}
          onChange={(v) => patchForm({ purchasePrice: v })}
        />
      </Field>
      {!isEdit ? <p className="crm-field-hint">{t("cars.purchasePriceHint")}</p> : null}

      <div className="crm-form-optional-block">
        <button
          type="button"
          className="crm-link-btn"
          onClick={() => {
            setForm((prev) => {
              if (prev.showTires) {
                return {
                  ...prev,
                  showTires: false,
                  tireBrand: "",
                  tireSize: "",
                  tireSeason: "",
                  tireInstalledAt: "",
                  tireNotes: "",
                };
              }
              return { ...prev, showTires: true };
            });
          }}
        >
          {form.showTires ? t("cars.hideTires") : t("cars.addTires")}
        </button>
        {form.showTires ? (
          <>
            <Field label={t("cars.tireBrand")}>
              <TextInput
                value={form.tireBrand}
                placeholder={ph(t, "tireBrand")}
                onChange={(v) => patchForm({ tireBrand: v })}
              />
            </Field>
            <Field label={t("cars.tireSize")}>
              <TextInput
                value={form.tireSize}
                placeholder={ph(t, "tireSize")}
                onChange={(v) => patchForm({ tireSize: v })}
              />
            </Field>
            <Field label={t("cars.tireSeasonField")}>
              <SelectInput
                value={form.tireSeason}
                onChange={(v) => patchForm({ tireSeason: v })}
                options={[
                  { value: "", label: "—" },
                  ...Object.values(TireSeason).map((s) => ({
                    value: s,
                    label: t(`cars.tireSeason.${s}`),
                  })),
                ]}
              />
            </Field>
            <Field label={t("cars.tireInstalledAt")}>
              <DateInput
                value={form.tireInstalledAt}
                example={ph(t, "tireInstalledAt")}
                clearable
                onChange={(v) => patchForm({ tireInstalledAt: v })}
              />
            </Field>
            <Field label={t("cars.tireNotes")}>
              <TextInput
                value={form.tireNotes}
                placeholder={ph(t, "tireNotes")}
                onChange={(v) => patchForm({ tireNotes: v })}
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="crm-form-section-label">{t("cars.trackerTitle")}</div>
      <Field label={t("cars.trackerLogin")}>
        <TextInput
          value={form.trackerLogin}
          placeholder={ph(t, "trackerLogin")}
          onChange={(v) => patchForm({ trackerLogin: v })}
        />
      </Field>
      <Field label={t("cars.trackerPassword")}>
        <PasswordInput
          value={form.trackerPassword}
          placeholder={ph(t, "trackerPassword")}
          onChange={(v) => patchForm({ trackerPassword: v })}
        />
      </Field>
      <Field label={t("cars.trackerUrl")}>
        <TextInput
          value={form.trackerUrl}
          placeholder={ph(t, "trackerUrl")}
          onChange={(v) => patchForm({ trackerUrl: v })}
        />
      </Field>
      <Field label={t("cars.trackerNotes")}>
        <TextInput
          value={form.trackerNotes}
          placeholder={ph(t, "trackerNotes")}
          onChange={(v) => patchForm({ trackerNotes: v })}
        />
      </Field>

      <div className="crm-form-section-label">{t("tracking.documentsTitle")}</div>
      {isEdit ? (
        <CarDocumentsSection carId={props.car!.id} embedded />
      ) : (
        <p className="crm-form-hint">{t("cars.documentsHintCreate")}</p>
      )}

      <div className="crm-form-section-label">{t("cars.carPhotosTitle")}</div>
      <p className="crm-form-hint">{t("cars.carPhotosHint")}</p>
      {!isEdit ? (
        <CarPhotoPicker
          photos={pendingPhotos}
          coverKey={coverKey}
          onPhotosChange={setPendingPhotos}
          onCoverKeyChange={setCoverKey}
          hideLabel
        />
      ) : (
        <CarPhotosSection
          carId={props.car!.id}
          coverDocumentId={props.car!.coverDocumentId}
          embedded
        />
      )}
    </Modal>
  );
}
