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
  showTires: boolean;
  trackerLogin: string;
  trackerPassword: string;
  trackerUrl: string;
  trackerSimNumber: string;
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
  tireFrontBrand: "",
  tireFrontSize: "",
  tireFrontSeason: "",
  tireFrontInstalledAt: "",
  tireFrontNotes: "",
  tireRearBrand: "",
  tireRearSize: "",
  tireRearSeason: "",
  tireRearInstalledAt: "",
  tireRearNotes: "",
  showTires: false,
  trackerLogin: "",
  trackerPassword: "",
  trackerUrl: "",
  trackerSimNumber: "",
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
    showTires: Boolean(
      car.tireFrontBrand ||
        car.tireFrontSize ||
        car.tireFrontSeason ||
        car.tireFrontInstalledAt ||
        car.tireFrontNotes ||
        car.tireRearBrand ||
        car.tireRearSize ||
        car.tireRearSeason ||
        car.tireRearInstalledAt ||
        car.tireRearNotes ||
        car.tireBrand ||
        car.tireSize ||
        car.tireSeason ||
        car.tireInstalledAt ||
        car.tireNotes,
    ),
    trackerLogin: car.trackerLogin ?? "",
    trackerPassword: car.trackerPassword ?? "",
    trackerUrl: car.trackerUrl ?? "",
    trackerSimNumber: car.trackerSimNumber ?? "",
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
      form.tireFrontBrand.trim() ||
      form.tireFrontSize.trim() ||
      form.tireFrontSeason ||
      form.tireFrontInstalledAt ||
      form.tireFrontNotes.trim() ||
      form.tireRearBrand.trim() ||
      form.tireRearSize.trim() ||
      form.tireRearSeason ||
      form.tireRearInstalledAt ||
      form.tireRearNotes.trim();

    if (!form.showTires && !hasTireInput) {
      return isEdit
        ? {
            tireBrand: null,
            tireSize: null,
            tireSeason: null,
            tireInstalledAt: null,
            tireNotes: null,
            tireFrontBrand: null,
            tireFrontSize: null,
            tireFrontSeason: null,
            tireFrontInstalledAt: null,
            tireFrontNotes: null,
            tireRearBrand: null,
            tireRearSize: null,
            tireRearSeason: null,
            tireRearInstalledAt: null,
            tireRearNotes: null,
          }
        : {};
    }

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
      trackerSimNumber: form.trackerSimNumber.trim() || null,
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
            setForm((prev) => ({
              ...prev,
              showTires: !prev.showTires,
            }));
          }}
        >
          {form.showTires ? t("cars.hideTires") : t("cars.addTires")}
        </button>
        {form.showTires ? (
          <>
            <div className="crm-form-section-label">{t("cars.tireFrontTitle")}</div>
            <TireAxleFields
              t={t}
              brand={form.tireFrontBrand}
              size={form.tireFrontSize}
              season={form.tireFrontSeason}
              installedAt={form.tireFrontInstalledAt}
              notes={form.tireFrontNotes}
              onBrand={(v) => patchForm({ tireFrontBrand: v })}
              onSize={(v) => patchForm({ tireFrontSize: v })}
              onSeason={(v) => patchForm({ tireFrontSeason: v })}
              onInstalledAt={(v) => patchForm({ tireFrontInstalledAt: v })}
              onNotes={(v) => patchForm({ tireFrontNotes: v })}
            />
            <div className="crm-form-section-label">{t("cars.tireRearTitle")}</div>
            <TireAxleFields
              t={t}
              brand={form.tireRearBrand}
              size={form.tireRearSize}
              season={form.tireRearSeason}
              installedAt={form.tireRearInstalledAt}
              notes={form.tireRearNotes}
              onBrand={(v) => patchForm({ tireRearBrand: v })}
              onSize={(v) => patchForm({ tireRearSize: v })}
              onSeason={(v) => patchForm({ tireRearSeason: v })}
              onInstalledAt={(v) => patchForm({ tireRearInstalledAt: v })}
              onNotes={(v) => patchForm({ tireRearNotes: v })}
            />
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
      <Field label={t("cars.trackerSimNumber")}>
        <TextInput
          value={form.trackerSimNumber}
          placeholder={ph(t, "trackerSimNumber")}
          onChange={(v) => patchForm({ trackerSimNumber: v })}
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
        <TextInput
          value={props.brand}
          placeholder={ph(props.t, "tireBrand")}
          onChange={props.onBrand}
        />
      </Field>
      <Field label={props.t("cars.tireSize")}>
        <TextInput
          value={props.size}
          placeholder={ph(props.t, "tireSize")}
          onChange={props.onSize}
        />
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
        <TextInput
          value={props.notes}
          placeholder={ph(props.t, "tireNotes")}
          onChange={props.onNotes}
        />
      </Field>
    </>
  );
}
