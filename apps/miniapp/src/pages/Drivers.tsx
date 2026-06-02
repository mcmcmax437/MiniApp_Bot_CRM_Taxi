import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, DriverStatus, RentPeriod } from "@taxi/shared";
import {
  useDrivers,
  useCars,
  useBalances,
  useSaveDriver,
  useDeleteDriver,
  useDriver,
  useCreateAgreement,
  useEndAgreement,
  useShifts,
} from "../hooks";
import type { Agreement, Driver } from "../types";
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
import { AppHeader, Icon } from "../components/crm";
import { DriverCard, DriversEmptyState } from "../components/DriverCard";

interface DriverForm {
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  pesel: string;
  passportNumber: string;
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
  addressFlat: string;
  fatherName: string;
  motherName: string;
  status: DriverStatus;
  notes: string;
}

const emptyForm: DriverForm = {
  firstName: "",
  lastName: "",
  phone: "",
  telegramUsername: "",
  pesel: "",
  passportNumber: "",
  addressCity: "",
  addressStreet: "",
  addressHouse: "",
  addressFlat: "",
  fatherName: "",
  motherName: "",
  status: DriverStatus.ACTIVE,
  notes: "",
};

type StatusFilter = "ALL" | DriverStatus;

function driverToForm(d: Driver): DriverForm {
  return {
    firstName: d.firstName ?? d.fullName.split(/\s+/)[0] ?? "",
    lastName: d.lastName ?? d.fullName.split(/\s+/).slice(1).join(" ") ?? "",
    phone: d.phone ?? "",
    telegramUsername: d.telegramUsername ?? "",
    pesel: d.pesel ?? "",
    passportNumber: d.passportNumber ?? "",
    addressCity: d.addressCity ?? "",
    addressStreet: d.addressStreet ?? "",
    addressHouse: d.addressHouse ?? "",
    addressFlat: d.addressFlat ?? "",
    fatherName: d.fatherName ?? "",
    motherName: d.motherName ?? "",
    status: d.status,
    notes: d.notes ?? "",
  };
}

function tripsThisMonthByDriver(shifts: { driverId: string; date: string }[] | undefined): Map<string, number> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const map = new Map<string, number>();
  for (const shift of shifts ?? []) {
    const d = new Date(shift.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      map.set(shift.driverId, (map.get(shift.driverId) ?? 0) + 1);
    }
  }
  return map;
}

export function DriversPage() {
  const { t } = useTranslation();
  const drivers = useDrivers();
  const cars = useCars();
  const balances = useBalances();
  const shifts = useShifts();
  const save = useSaveDriver();
  const del = useDeleteDriver();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);

  const detail = useDriver(open && editId ? editId : undefined);

  useEffect(() => {
    if (detail.data && editId === detail.data.id) {
      setForm(driverToForm(detail.data));
    }
  }, [detail.data, editId]);

  const balanceById = new Map((balances.data ?? []).map((b) => [b.driverId, b]));
  const tripsByDriver = useMemo(() => tripsThisMonthByDriver(shifts.data), [shifts.data]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (drivers.data ?? []).filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        d.fullName,
        d.firstName,
        d.lastName,
        d.phone,
        d.pesel,
        d.passportNumber,
        d.addressCity,
        d.addressStreet,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [drivers.data, search, statusFilter]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Driver) {
    setEditId(d.id);
    setForm(driverToForm(d));
    setOpen(true);
  }

  function submit() {
    const data: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone || null,
      telegramUsername: form.telegramUsername || null,
      pesel: form.pesel || null,
      passportNumber: form.passportNumber || null,
      addressCity: form.addressCity || null,
      addressStreet: form.addressStreet || null,
      addressHouse: form.addressHouse || null,
      addressFlat: form.addressFlat || null,
      fatherName: form.fatherName || null,
      motherName: form.motherName || null,
      status: form.status,
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
          <h2 className="crm-page-head__title">{t("drivers.pageTitle")}</h2>
          <p className="crm-page-head__subtitle">{t("drivers.pageSubtitle")}</p>
        </div>
        <button type="button" className="crm-btn-primary" onClick={openCreate}>
          <Icon width="18" height="18" stroke="#fff" fill="none">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </Icon>
          <span>{t("drivers.addDriver")}</span>
        </button>
      </div>

      <div className="crm-search-row">
        <label className="crm-search-input">
          <Icon stroke="rgba(255,255,255,0.45)" fill="none" width="20" height="20">
            <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" strokeWidth="1.8" strokeLinecap="round" />
          </Icon>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("drivers.searchPlaceholder")}
          />
        </label>

        <div className="crm-filter-wrap">
          <button
            type="button"
            className={`crm-filter-btn${statusFilter !== "ALL" ? " crm-filter-btn--active" : ""}`}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Icon stroke="rgba(255,255,255,0.7)" fill="none" width="20" height="20">
              <path d="M4 6h16M7 12h10M10 18h4" strokeWidth="1.8" strokeLinecap="round" />
            </Icon>
            <span>{t("drivers.filter")}</span>
          </button>

          {filterOpen ? (
            <div className="crm-filter-menu">
              {(["ALL", DriverStatus.ACTIVE, DriverStatus.INACTIVE] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`crm-filter-menu__item${statusFilter === value ? " crm-filter-menu__item--active" : ""}`}
                  onClick={() => {
                    setStatusFilter(value);
                    setFilterOpen(false);
                  }}
                >
                  {value === "ALL" ? t("common.all") : t(`drivers.${value}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {drivers.isLoading && (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      )}

      {!drivers.isLoading && (drivers.data?.length ?? 0) === 0 && (
        <DriversEmptyState onAdd={openCreate} />
      )}

      {!drivers.isLoading && (drivers.data?.length ?? 0) > 0 && filteredDrivers.length === 0 && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("drivers.noResults")}</p>
        </div>
      )}

      <div className="crm-driver-list">
        {filteredDrivers.map((d) => (
          <DriverCard
            key={d.id}
            driver={d}
            balance={balanceById.get(d.id)}
            tripsThisMonth={tripsByDriver.get(d.id) ?? 0}
            onClick={() => openEdit(d)}
          />
        ))}
      </div>

      <Modal
        open={open}
        title={editId ? t("drivers.editDriver") : t("drivers.addDriver")}
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
        <Field label={t("drivers.firstName")}>
          <TextInput value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
        </Field>
        <Field label={t("drivers.lastName")}>
          <TextInput value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
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
        <Field label={t("drivers.pesel")}>
          <TextInput value={form.pesel} onChange={(v) => setForm({ ...form, pesel: v })} />
        </Field>
        <Field label={t("drivers.passportNumber")}>
          <TextInput value={form.passportNumber} onChange={(v) => setForm({ ...form, passportNumber: v })} />
        </Field>
        <Field label={t("drivers.fatherName")}>
          <TextInput value={form.fatherName} onChange={(v) => setForm({ ...form, fatherName: v })} />
        </Field>
        <Field label={t("drivers.motherName")}>
          <TextInput value={form.motherName} onChange={(v) => setForm({ ...form, motherName: v })} />
        </Field>
        <Field label={t("drivers.addressCity")}>
          <TextInput value={form.addressCity} onChange={(v) => setForm({ ...form, addressCity: v })} />
        </Field>
        <Field label={t("drivers.addressStreet")}>
          <TextInput value={form.addressStreet} onChange={(v) => setForm({ ...form, addressStreet: v })} />
        </Field>
        <Field label={t("drivers.addressHouse")}>
          <TextInput value={form.addressHouse} onChange={(v) => setForm({ ...form, addressHouse: v })} />
        </Field>
        <Field label={t("drivers.addressFlat")}>
          <TextInput value={form.addressFlat} onChange={(v) => setForm({ ...form, addressFlat: v })} />
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
            agreements={detail.data?.agreements ?? []}
            carOptions={(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate }))}
          />
        )}
        {editId && <Documents relatedType="DRIVER" relatedId={editId} />}
      </Modal>
    </div>
  );
}

function AgreementSection(props: {
  driverId: string;
  agreements: Agreement[];
  carOptions: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  const create = useCreateAgreement();
  const end = useEndAgreement();
  const [carId, setCarId] = useState("");
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [period, setPeriod] = useState<RentPeriod>(RentPeriod.DAILY);
  const [startDate, setStartDate] = useState(todayInput());

  const active = props.agreements.filter((a) => a.status === AgreementStatus.ACTIVE);

  return (
    <div className="crm-agreement-section">
      <strong>{t("drivers.rentAgreement")}</strong>

      {active.length > 0 ? (
        <div className="crm-agreement-list">
          {active.map((a) => (
            <div key={a.id} className="crm-agreement-section__active">
              <div className="crm-agreement-section__summary">
                <div>{a.car?.plate ?? "—"}</div>
                <div className="crm-agreement-section__meta">
                  {formatMoney(a.rentAmount)} / {t(`drivers.${a.period}`)} • {t("drivers.deposit")}:{" "}
                  {formatMoney(a.depositAmount)} • {formatDate(a.startDate)}
                </div>
              </div>
              <button
                type="button"
                className="crm-btn-outline"
                onClick={() => end.mutate(a.id)}
                disabled={end.isPending}
              >
                {t("drivers.endAgreement")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="crm-agreement-section__hint">{t("drivers.noAgreement")}</p>
      )}

      <p className="crm-agreement-section__hint">{t("drivers.addAgreementHint")}</p>

      <Field label={t("drivers.agreementCar")}>
        <SelectInput
          value={carId}
          onChange={setCarId}
          options={[{ value: "", label: t("common.none") }, ...props.carOptions]}
        />
      </Field>
      <Field label={t("drivers.rentAmount")}>
        <NumberInput value={rentAmount} onChange={setRentAmount} />
      </Field>
      <Field label={t("drivers.deposit")}>
        <NumberInput value={depositAmount} onChange={setDepositAmount} />
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
      <button
        type="button"
        className="crm-btn-primary"
        disabled={!carId || rentAmount === "" || create.isPending}
        onClick={() =>
          create.mutate(
            {
              driverId: props.driverId,
              carId,
              rentAmount: rentAmount === "" ? 0 : rentAmount,
              depositAmount: depositAmount === "" ? 0 : depositAmount,
              period,
              startDate,
            },
            {
              onSuccess: () => {
                setCarId("");
                setRentAmount("");
                setDepositAmount("");
                setStartDate(todayInput());
              },
            },
          )
        }
      >
        + {t("drivers.rentAgreement")}
      </button>
    </div>
  );
}
