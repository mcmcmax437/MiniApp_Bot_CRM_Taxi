import { useState } from "react";
import { List, Section, Cell, Button, Spinner, Badge } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { CarStatus } from "@taxi/shared";
import { useCars, useDeleteCar, useSaveCar } from "../hooks";
import type { Car } from "../types";
import {
  Modal,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
  formatDate,
} from "../components/ui";
import { Documents } from "../components/Documents";

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
    save.mutate(
      { id: editId ?? undefined, data },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <List>
      <div className="row-actions">
        <Button stretched onClick={openCreate}>
          + {t("cars.addCar")}
        </Button>
      </div>

      <Section>
        {cars.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {cars.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {cars.data?.map((car) => (
          <Cell
            key={car.id}
            subtitle={[car.make, car.model, car.year].filter(Boolean).join(" ")}
            after={<Badge type="number" mode={badgeMode(car.status)}>{t(`cars.${car.status}`)}</Badge>}
            onClick={() => openEdit(car)}
            description={insuranceLine(car, t)}
          >
            {car.plate}
          </Cell>
        ))}
      </Section>

      <Modal
        open={open}
        title={editId ? t("cars.editCar") : t("cars.addCar")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <Button
                mode="outline"
                stretched
                onClick={() => {
                  if (confirm(t("common.confirmDelete"))) {
                    del.mutate(editId, { onSuccess: () => setOpen(false) });
                  }
                }}
              >
                {t("common.delete")}
              </Button>
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
    </List>
  );
}

function badgeMode(status: CarStatus): "primary" | "critical" | "secondary" {
  if (status === CarStatus.RENTED) return "primary";
  if (status === CarStatus.MAINTENANCE) return "critical";
  return "secondary";
}

function insuranceLine(car: Car, t: (k: string) => string): string {
  const parts: string[] = [];
  if (car.insuranceExpiry) parts.push(`${t("cars.insurance")}: ${formatDate(car.insuranceExpiry)}`);
  if (car.inspectionExpiry) parts.push(`${t("cars.inspection")}: ${formatDate(car.inspectionExpiry)}`);
  return parts.join("  •  ");
}
