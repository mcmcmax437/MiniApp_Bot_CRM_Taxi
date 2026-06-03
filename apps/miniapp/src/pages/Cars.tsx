import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus, carFormFieldErrors, type CarFormField } from "@taxi/shared";
import { useCars, useCarCoverPhotos, useDeleteCar, useSaveCar, useUploadDocument } from "../hooks";
import type { Car } from "../types";
import {
  Modal,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
} from "../components/ui";
import { CarPhotoPicker, type PendingCarPhoto } from "../components/CarPhotoPicker";
import { CarPhotosSection } from "../components/CarPhotosSection";
import { AppHeader, Icon } from "../components/crm";
import { CarCard } from "../components/CarCard";

interface CarForm {
  plate: string;
  make: string;
  model: string;
  year: number | "";
  status: CarStatus;
  insuranceExpiry: string;
  inspectionExpiry: string;
  notes: string;
}

const emptyForm: CarForm = {
  plate: "",
  make: "",
  model: "",
  year: "",
  status: CarStatus.AVAILABLE,
  insuranceExpiry: "",
  inspectionExpiry: "",
  notes: "",
};

export function CarsPage() {
  const { t } = useTranslation();
  const cars = useCars();
  const covers = useCarCoverPhotos();
  const save = useSaveCar();
  const upload = useUploadDocument();
  const del = useDeleteCar();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CarForm>(emptyForm);
  const [pendingPhotos, setPendingPhotos] = useState<PendingCarPhoto[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<CarFormField>>(new Set());

  const requiredMsg = t("common.requiredField");

  function patchForm(patch: Partial<CarForm>) {
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

  function clearPendingPhotos(photos: PendingCarPhoto[]) {
    for (const p of photos) URL.revokeObjectURL(p.previewUrl);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    clearPendingPhotos(pendingPhotos);
    setPendingPhotos([]);
    setCoverKey(null);
    setFieldErrors(new Set());
    setOpen(true);
  }

  function openEdit(car: Car) {
    setFieldErrors(new Set());
    setEditId(car.id);
    setForm({
      plate: car.plate,
      make: car.make ?? "",
      model: car.model ?? "",
      year: car.year ?? "",
      status: car.status,
      insuranceExpiry: car.insuranceExpiry ? car.insuranceExpiry.slice(0, 10) : "",
      inspectionExpiry: car.inspectionExpiry ? car.inspectionExpiry.slice(0, 10) : "",
      notes: car.notes ?? "",
    });
    setOpen(true);
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
      { id: editId ?? undefined, data },
      {
        onSuccess: async (car) => {
          const close = () => {
            clearPendingPhotos(pendingPhotos);
            setPendingPhotos([]);
            setCoverKey(null);
            setOpen(false);
          };

          if (!editId && pendingPhotos.length > 0 && car.id) {
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
                await save.mutateAsync({ id: car.id, data: { coverDocumentId: coverDoc.id } });
              }
            } finally {
              close();
            }
          } else {
            close();
          }
        },
      },
    );
  }

  const editingCar = editId ? cars.data?.find((c) => c.id === editId) : undefined;

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <div className="crm-page-head">
        <div className="crm-page-head__titles">
          <h2 className="crm-page-head__title">{t("cars.pageTitle")}</h2>
          <p className="crm-page-head__subtitle">{t("cars.pageSubtitle")}</p>
        </div>
        <button type="button" className="crm-btn-primary" onClick={openCreate}>
          <Icon width="18" height="18" stroke="#fff" fill="none">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </Icon>
          <span>{t("cars.addCar")}</span>
        </button>
      </div>

      {cars.isLoading && (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      )}

      {!cars.isLoading && cars.data?.length === 0 && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("common.empty")}</p>
        </div>
      )}

      <div className="crm-car-list">
        {cars.data?.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            coverDocumentId={covers.data?.get(car.id)}
            onClick={() => openEdit(car)}
          />
        ))}
      </div>

      <Modal
        open={open}
        title={editId ? t("cars.editCar") : t("cars.addCar")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions
              onCancel={() => setOpen(false)}
              onSave={submit}
              saving={save.isPending || upload.isPending}
            />
            {editId && (
              <button
                type="button"
                className="crm-btn-outline"
                onClick={() => {
                  if (confirm(t("common.confirmDelete"))) {
                    del.mutate(editId, { onSuccess: () => setOpen(false) });
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
            invalid={fieldInvalid("plate")}
            onChange={(v) => patchForm({ plate: v })}
          />
        </Field>
        <Field label={t("cars.make")} invalid={fieldInvalid("make")} errorMessage={requiredMsg}>
          <TextInput value={form.make} invalid={fieldInvalid("make")} onChange={(v) => patchForm({ make: v })} />
        </Field>
        <Field label={t("cars.model")} invalid={fieldInvalid("model")} errorMessage={requiredMsg}>
          <TextInput value={form.model} invalid={fieldInvalid("model")} onChange={(v) => patchForm({ model: v })} />
        </Field>
        <Field label={t("cars.year")} invalid={fieldInvalid("year")} errorMessage={requiredMsg}>
          <NumberInput value={form.year} invalid={fieldInvalid("year")} onChange={(v) => patchForm({ year: v })} />
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
            invalid={fieldInvalid("insuranceExpiry")}
            onChange={(v) => patchForm({ insuranceExpiry: v })}
          />
        </Field>
        <Field label={t("cars.inspection")} invalid={fieldInvalid("inspectionExpiry")} errorMessage={requiredMsg}>
          <DateInput
            value={form.inspectionExpiry}
            invalid={fieldInvalid("inspectionExpiry")}
            onChange={(v) => patchForm({ inspectionExpiry: v })}
          />
        </Field>
        <Field label={t("cars.notes")}>
          <TextInput value={form.notes} onChange={(v) => patchForm({ notes: v })} />
        </Field>
        {!editId ? (
          <CarPhotoPicker
            photos={pendingPhotos}
            coverKey={coverKey}
            onPhotosChange={(next) => {
              const removed = pendingPhotos.filter((p) => !next.some((n) => n.key === p.key));
              clearPendingPhotos(removed);
              setPendingPhotos(next);
            }}
            onCoverKeyChange={setCoverKey}
          />
        ) : (
          <CarPhotosSection carId={editId} coverDocumentId={editingCar?.coverDocumentId} />
        )}
      </Modal>
    </div>
  );
}
