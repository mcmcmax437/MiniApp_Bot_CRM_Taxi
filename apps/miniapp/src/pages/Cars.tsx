import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useCars, useCarCoverPhotos, useDeleteCar, useSaveCar } from "../hooks";
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
import { Documents } from "../components/Documents";
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
  const del = useDeleteCar();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CarForm>(emptyForm);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(car: Car) {
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
    save.mutate({ id: editId ?? undefined, data }, { onSuccess: () => setOpen(false) });
  }

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
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
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
        <Field label={t("cars.plate")}>
          <TextInput value={form.plate} onChange={(v) => setForm({ ...form, plate: v })} />
        </Field>
        <Field label={t("cars.make")}>
          <TextInput value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
        </Field>
        <Field label={t("cars.model")}>
          <TextInput value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
        </Field>
        <Field label={t("cars.year")}>
          <NumberInput value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
        </Field>
        <Field label={t("cars.status")}>
          <SelectInput
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={Object.values(CarStatus).map((s) => ({ value: s, label: t(`cars.${s}`) }))}
          />
        </Field>
        <Field label={t("cars.insurance")}>
          <DateInput value={form.insuranceExpiry} onChange={(v) => setForm({ ...form, insuranceExpiry: v })} />
        </Field>
        <Field label={t("cars.inspection")}>
          <DateInput value={form.inspectionExpiry} onChange={(v) => setForm({ ...form, inspectionExpiry: v })} />
        </Field>
        <Field label={t("cars.notes")}>
          <TextInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </Field>
        {editId && <Documents relatedType="CAR" relatedId={editId} />}
      </Modal>
    </div>
  );
}
