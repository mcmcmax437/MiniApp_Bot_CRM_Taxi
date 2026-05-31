import { useState } from "react";
import { List, Section, Cell, Button, Spinner, Badge } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { DriverStatus, RentPeriod } from "@taxi/shared";
import {
  useDrivers,
  useCars,
  useBalances,
  useSaveDriver,
  useDeleteDriver,
  useDriver,
  useCreateAgreement,
  useEndAgreement,
} from "../hooks";
import type { Driver } from "../types";
import {
  Modal,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
  formatMoney,
  formatDate,
  todayInput,
} from "../components/ui";
import { Documents } from "../components/Documents";

interface DriverForm {
  fullName: string;
  phone: string;
  telegramUsername: string;
  assignedCarId: string;
  depositAmount: number | "";
  status: DriverStatus;
  notes: string;
}

const emptyForm: DriverForm = {
  fullName: "",
  phone: "",
  telegramUsername: "",
  assignedCarId: "",
  depositAmount: 0,
  status: DriverStatus.ACTIVE,
  notes: "",
};

export function DriversPage() {
  const { t } = useTranslation();
  const drivers = useDrivers();
  const cars = useCars();
  const balances = useBalances();
  const save = useSaveDriver();
  const del = useDeleteDriver();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);

  const detail = useDriver(open && editId ? editId : undefined);
  const activeAgreement = detail.data?.agreements?.find((a) => a.status === "ACTIVE");

  const balanceById = new Map((balances.data ?? []).map((b) => [b.driverId, b]));

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Driver) {
    setEditId(d.id);
    setForm({
      fullName: d.fullName,
      phone: d.phone ?? "",
      telegramUsername: d.telegramUsername ?? "",
      assignedCarId: d.assignedCarId ?? "",
      depositAmount: d.depositAmount,
      status: d.status,
      notes: d.notes ?? "",
    });
    setOpen(true);
  }

  function submit() {
    const data: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      phone: form.phone || null,
      telegramUsername: form.telegramUsername || null,
      assignedCarId: form.assignedCarId || null,
      depositAmount: form.depositAmount === "" ? 0 : form.depositAmount,
      status: form.status,
      notes: form.notes || null,
    };
    save.mutate({ id: editId ?? undefined, data }, { onSuccess: () => setOpen(false) });
  }

  return (
    <List>
      <div className="row-actions">
        <Button stretched onClick={openCreate}>
          + {t("drivers.addDriver")}
        </Button>
      </div>

      <Section>
        {drivers.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {drivers.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {drivers.data?.map((d) => {
          const bal = balanceById.get(d.id);
          return (
            <Cell
              key={d.id}
              subtitle={d.assignedCar ? d.assignedCar.plate : t("drivers.noAgreement")}
              onClick={() => openEdit(d)}
              after={
                bal ? (
                  <span className={bal.balance > 0 ? "amount-pos" : "amount-neg"}>
                    {formatMoney(bal.balance)}
                  </span>
                ) : null
              }
            >
              {d.fullName}{" "}
              {d.status === DriverStatus.INACTIVE && (
                <Badge type="dot" mode="secondary" />
              )}
            </Cell>
          );
        })}
      </Section>

      <Modal
        open={open}
        title={editId ? t("drivers.editDriver") : t("drivers.addDriver")}
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
        <Field label={t("drivers.name")}>
          <TextInput value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
        </Field>
        <Field label={t("drivers.phone")}>
          <TextInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        </Field>
        <Field label={t("drivers.telegram")}>
          <TextInput
            value={form.telegramUsername}
            onChange={(v) => setForm({ ...form, telegramUsername: v })}
          />
        </Field>
        <Field label={t("drivers.assignedCar")}>
          <SelectInput
            value={form.assignedCarId}
            onChange={(v) => setForm({ ...form, assignedCarId: v })}
            options={[
              { value: "", label: t("common.none") },
              ...(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate })),
            ]}
          />
        </Field>
        <Field label={t("drivers.deposit")}>
          <NumberInput
            value={form.depositAmount}
            onChange={(v) => setForm({ ...form, depositAmount: v })}
          />
        </Field>
        <Field label={t("drivers.status")}>
          <SelectInput
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={Object.values(DriverStatus).map((s) => ({ value: s, label: t(`drivers.${s}`) }))}
          />
        </Field>
        <Field label={t("drivers.notes")}>
          <TextInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </Field>

        {editId && (
          <AgreementSection
            driverId={editId}
            active={activeAgreement}
            carOptions={(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate }))}
            defaultCarId={form.assignedCarId}
          />
        )}
        {editId && <Documents relatedType="DRIVER" relatedId={editId} />}
      </Modal>
    </List>
  );
}

function AgreementSection(props: {
  driverId: string;
  active?: { id: string; rentAmount: number; period: RentPeriod; startDate: string; car?: { plate: string } };
  carOptions: { value: string; label: string }[];
  defaultCarId: string;
}) {
  const { t } = useTranslation();
  const create = useCreateAgreement();
  const end = useEndAgreement();
  const [carId, setCarId] = useState(props.defaultCarId);
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [period, setPeriod] = useState<RentPeriod>(RentPeriod.DAILY);
  const [startDate, setStartDate] = useState(todayInput());

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--tgui--outline,#d1d1d6)", paddingTop: 12 }}>
      <strong>{t("drivers.rentAgreement")}</strong>
      {props.active ? (
        <div style={{ marginTop: 8 }}>
          <Cell
            subtitle={`${formatMoney(props.active.rentAmount)} / ${t(`drivers.${props.active.period}`)} • ${formatDate(props.active.startDate)}`}
          >
            {props.active.car?.plate ?? ""}
          </Cell>
          <Button mode="outline" stretched onClick={() => end.mutate(props.active!.id)} loading={end.isPending}>
            {t("drivers.endAgreement")}
          </Button>
        </div>
      ) : (
        <>
          <Field label={t("drivers.assignedCar")}>
            <SelectInput
              value={carId}
              onChange={setCarId}
              options={[{ value: "", label: t("common.none") }, ...props.carOptions]}
            />
          </Field>
          <Field label={t("drivers.rentAmount")}>
            <NumberInput value={rentAmount} onChange={setRentAmount} />
          </Field>
          <Field label={t("drivers.period")}>
            <SelectInput
              value={period}
              onChange={setPeriod}
              options={Object.values(RentPeriod).map((p) => ({ value: p, label: t(`drivers.${p}`) }))}
            />
          </Field>
          <Field label={t("drivers.startDate")}>
            <DateInput value={startDate} onChange={setStartDate} />
          </Field>
          <Button
            stretched
            disabled={!carId || rentAmount === ""}
            loading={create.isPending}
            onClick={() =>
              create.mutate({
                driverId: props.driverId,
                carId,
                rentAmount: rentAmount === "" ? 0 : rentAmount,
                period,
                startDate,
              })
            }
          >
            + {t("drivers.rentAgreement")}
          </Button>
        </>
      )}
    </div>
  );
}
