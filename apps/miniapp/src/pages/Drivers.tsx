import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AgreementStatus,
  DriverStatus,
  RentPeriod,
  driverFormFieldErrors,
  type DriverFormField,
} from "@taxi/shared";
import {
  useDrivers,
  useCars,
  useBalances,
  useSaveDriver,
  useDeleteDriver,
  useDriver,
  useAgreements,
  useCreateAgreement,
  useEndAgreement,
  useShifts,
} from "../hooks";
import type { Agreement, Driver } from "../types";
import {
  Modal,
  type ModalHandle,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  SearchableSelect,
  FormActions,
  formatMoney,
  formatDate,
  MoneyNumberInput,
  todayInput,
} from "../components/ui";
import { Documents } from "../components/Documents";
import { AppHeader, Icon } from "../components/crm";
import { DriverCard, DriversEmptyState } from "../components/DriverCard";
import { DriverBalanceBreakdownModal } from "../components/DriverBalanceBreakdownModal";
import { SwipeToDelete } from "../components/SwipeToDelete";
import { useReadOnly } from "../readOnly";
import { confirmAction, showAlert } from "../telegram";
import { findAgreementDateConflict } from "../agreementOverlap";
import { ApiError } from "../api";

const ph = (t: (k: string) => string, key: string) => t(`drivers.placeholder.${key}`);

interface DriverForm {
  firstName: string;
  lastName: string;
  phone: string;
  telegramUsername: string;
  pesel: string;
  passportNumber: string;
  addressCity: string;
  addressPostalCode: string;
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
  addressPostalCode: "",
  addressStreet: "",
  addressHouse: "",
  addressFlat: "",
  fatherName: "",
  motherName: "",
  status: DriverStatus.ACTIVE,
  notes: "",
};

type DriverListFilter = "ALL" | "WITH_CAR" | "WITHOUT_CAR";
type NameSort = "AZ" | "ZA";

/** True when the driver is currently assigned under an ACTIVE rental agreement. */
function driverHasActiveCar(d: Driver): boolean {
  return (d.agreements ?? []).some((a) => a.status === AgreementStatus.ACTIVE);
}

function driverToForm(d: Driver): DriverForm {
  return {
    firstName: d.firstName ?? d.fullName.split(/\s+/)[0] ?? "",
    lastName: d.lastName ?? d.fullName.split(/\s+/).slice(1).join(" ") ?? "",
    phone: d.phone ?? "",
    telegramUsername: d.telegramUsername ?? "",
    pesel: d.pesel ?? "",
    passportNumber: d.passportNumber ?? "",
    addressCity: d.addressCity ?? "",
    addressPostalCode: d.addressPostalCode ?? "",
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
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const drivers = useDrivers();
  const cars = useCars();
  const balances = useBalances();
  const shifts = useShifts();
  const allAgreements = useAgreements();
  const save = useSaveDriver();
  const del = useDeleteDriver();

  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverListFilter>("ALL");
  const [nameSort, setNameSort] = useState<NameSort>("AZ");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Set<DriverFormField>>(new Set());
  const [balanceModal, setBalanceModal] = useState<{ driverId: string; driverName: string } | null>(null);
  const modalRef = useRef<ModalHandle>(null);

  const detail = useDriver(open && editId ? editId : undefined);
  const requiredMsg = t("common.requiredField");

  useEffect(() => {
    if (detail.data && editId === detail.data.id) {
      setForm(driverToForm(detail.data));
    }
  }, [detail.data, editId]);

  useEffect(() => {
    const viewId = searchParams.get("view");
    if (!viewId || drivers.isLoading) return;
    const driver = drivers.data?.find((d) => d.id === viewId);
    if (driver) {
      setEditId(driver.id);
      setViewOnly(true);
      setForm(driverToForm(driver));
      setFieldErrors(new Set());
      setOpen(true);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, drivers.data, drivers.isLoading, setSearchParams]);

  const balanceById = new Map((balances.data ?? []).map((b) => [b.driverId, b]));
  const tripsByDriver = useMemo(() => tripsThisMonthByDriver(shifts.data), [shifts.data]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (drivers.data ?? []).filter((d) => {
      if (statusFilter === "WITH_CAR" && !driverHasActiveCar(d)) return false;
      if (statusFilter === "WITHOUT_CAR" && driverHasActiveCar(d)) return false;
      if (!q) return true;
      const hay = [
        d.fullName,
        d.firstName,
        d.lastName,
        d.phone,
        d.pesel,
        d.passportNumber,
        d.addressCity,
        d.addressPostalCode,
        d.addressStreet,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return [...list].sort((a, b) => {
      const cmp = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      return nameSort === "AZ" ? cmp : -cmp;
    });
  }, [drivers.data, search, statusFilter, nameSort]);

  function openCreate() {
    setEditId(null);
    setViewOnly(false);
    setForm(emptyForm);
    setFieldErrors(new Set());
    setOpen(true);
  }

  function openView(d: Driver) {
    setEditId(d.id);
    setViewOnly(true);
    setForm(driverToForm(d));
    setFieldErrors(new Set());
    setOpen(true);
  }

  function openEdit(d: Driver) {
    setEditId(d.id);
    setViewOnly(false);
    setForm(driverToForm(d));
    setFieldErrors(new Set());
    setOpen(true);
  }

  function switchToEdit() {
    setViewOnly(false);
  }

  function closeModal() {
    setOpen(false);
    setViewOnly(false);
  }

  function handleModalClosed() {
    closeModal();
  }

  function requestCloseModal() {
    modalRef.current?.dismiss();
  }

  function patchForm(patch: Partial<DriverForm>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (fieldErrors.size > 0) {
        const nextErrors = new Set(fieldErrors);
        for (const key of Object.keys(patch) as DriverFormField[]) {
          nextErrors.delete(key);
        }
        if ("pesel" in patch || "passportNumber" in patch) {
          const pesel = String(patch.pesel ?? next.pesel).trim();
          const passport = String(patch.passportNumber ?? next.passportNumber).trim();
          if (pesel || passport) {
            nextErrors.delete("pesel");
            nextErrors.delete("passportNumber");
          }
        }
        setFieldErrors(nextErrors);
      }
      return next;
    });
  }

  function fieldInvalid(name: DriverFormField): boolean {
    return fieldErrors.has(name);
  }

  function fieldErrorMessage(name: DriverFormField): string | undefined {
    if (!fieldErrors.has(name)) return undefined;
    const pesel = form.pesel.trim();
    const passport = form.passportNumber.trim();
    if (name === "pesel") {
      if (pesel && !/^\d{11}$/.test(pesel)) return t("drivers.invalidPesel");
      if (!pesel && !passport) return t("drivers.needIdDocument");
    }
    if (name === "passportNumber" && !pesel && !passport) {
      return t("drivers.needIdDocument");
    }
    return requiredMsg;
  }

  function submit() {
    const errors = driverFormFieldErrors(form);
    if (errors.size > 0) {
      setFieldErrors(errors);
      return;
    }

    const data: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone || null,
      telegramUsername: form.telegramUsername || null,
      pesel: form.pesel || null,
      passportNumber: form.passportNumber || null,
      addressCity: form.addressCity || null,
      addressPostalCode: form.addressPostalCode || null,
      addressStreet: form.addressStreet || null,
      addressHouse: form.addressHouse || null,
      addressFlat: form.addressFlat || null,
      fatherName: form.fatherName || null,
      motherName: form.motherName || null,
      status: form.status,
      notes: form.notes || null,
    };
    save.mutate({ id: editId ?? undefined, data }, { onSuccess: () => requestCloseModal() });
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
        {!readOnly ? (
          <button type="button" className="crm-btn-primary" onClick={openCreate}>
            <Icon name="add-01" size={18} color="#fff" />
            <span>{t("drivers.addDriver")}</span>
          </button>
        ) : null}
      </div>

      <div className="crm-search-row">
        <label className="crm-search-input">
          <Icon name="search-01" size={20} color="rgba(255,255,255,0.45)" />
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
            className={`crm-filter-btn${statusFilter !== "ALL" || nameSort !== "AZ" ? " crm-filter-btn--active" : ""}`}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Icon name="filter" size={20} color="rgba(255,255,255,0.7)" />
            <span className="crm-filter-btn__label">{t("drivers.filter")}</span>
          </button>

          {filterOpen ? (
            <div className="crm-filter-menu">
              <div className="crm-filter-menu__heading">{t("drivers.filterStatus")}</div>
              {(["ALL", "WITH_CAR", "WITHOUT_CAR"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`crm-filter-menu__item${statusFilter === value ? " crm-filter-menu__item--active" : ""}`}
                  onClick={() => setStatusFilter(value)}
                >
                  {value === "ALL"
                    ? t("common.all")
                    : value === "WITH_CAR"
                      ? t("drivers.filterWithCar")
                      : t("drivers.filterWithoutCar")}
                </button>
              ))}
              <div className="crm-filter-menu__divider" />
              <div className="crm-filter-menu__heading">{t("drivers.sort")}</div>
              {(["AZ", "ZA"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`crm-filter-menu__item${nameSort === value ? " crm-filter-menu__item--active" : ""}`}
                  onClick={() => setNameSort(value)}
                >
                  {value === "AZ" ? t("drivers.sortAZ") : t("drivers.sortZA")}
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

      {!drivers.isLoading && (drivers.data?.length ?? 0) === 0 && !readOnly && (
        <DriversEmptyState onAdd={openCreate} />
      )}

      {!drivers.isLoading && (drivers.data?.length ?? 0) > 0 && filteredDrivers.length === 0 && (
        <div className="crm-empty-box">
          <p className="crm-empty-box__title">{t("drivers.noResults")}</p>
        </div>
      )}

      {filteredDrivers.length > 0 && (
        <div className="crm-driver-list">
          {filteredDrivers.map((d) => (
            <SwipeToDelete
              key={d.id}
              className="crm-swipe-row--driver"
              actionWidth={68}
              iconSize={18}
              readOnly={readOnly}
              onPress={() => openView(d)}
              onEdit={readOnly ? undefined : () => openEdit(d)}
              onDelete={() => {
                del.mutate(d.id, {
                  onSuccess: () => {
                    if (editId === d.id) requestCloseModal();
                  },
                });
              }}
            >
              <DriverCard
                driver={d}
                balance={balanceById.get(d.id)}
                tripsThisMonth={tripsByDriver.get(d.id) ?? 0}
                onBalanceClick={(e) => {
                  e.stopPropagation();
                  setBalanceModal({ driverId: d.id, driverName: d.fullName });
                }}
              />
            </SwipeToDelete>
          ))}
        </div>
      )}

      <Modal
        ref={modalRef}
        open={open}
        title={
          viewOnly ? t("drivers.viewDriver") : editId ? t("drivers.editDriver") : t("drivers.addDriver")
        }
        onClose={handleModalClosed}
        backLabel={t("common.back")}
        footer={
          viewOnly ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="crm-btn-primary crm-btn-icon-only"
                onClick={switchToEdit}
                aria-label={t("common.edit")}
                title={t("common.edit")}
              >
                <Icon name="edit-02" size={22} color="currentColor" />
              </button>
              <button type="button" className="crm-btn-outline" onClick={requestCloseModal}>
                {t("common.back")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FormActions onCancel={requestCloseModal} onSave={submit} saving={save.isPending} />
              {editId && (
                <button
                  type="button"
                  className="crm-btn-outline"
                  onClick={async () => {
                    const ok = await confirmAction(
                      t("common.confirmDelete"),
                      t("common.delete"),
                      t("common.cancel"),
                    );
                    if (ok) del.mutate(editId, { onSuccess: () => requestCloseModal() });
                  }}
                >
                  {t("common.delete")}
                </button>
              )}
            </div>
          )
        }
      >
        {viewOnly ? (
          <DriverViewPanel
            form={form}
            driver={detail.data}
            balance={editId ? balanceById.get(editId) : undefined}
            tripsThisMonth={editId ? (tripsByDriver.get(editId) ?? 0) : 0}
          />
        ) : (
          <>
        <Field
          label={t("drivers.firstName")}
          invalid={fieldInvalid("firstName")}
          errorMessage={fieldErrorMessage("firstName")}
        >
          <TextInput
            value={form.firstName}
            placeholder={ph(t, "firstName")}
            invalid={fieldInvalid("firstName")}
            onChange={(v) => patchForm({ firstName: v })}
          />
        </Field>
        <Field
          label={t("drivers.lastName")}
          invalid={fieldInvalid("lastName")}
          errorMessage={fieldErrorMessage("lastName")}
        >
          <TextInput
            value={form.lastName}
            placeholder={ph(t, "lastName")}
            invalid={fieldInvalid("lastName")}
            onChange={(v) => patchForm({ lastName: v })}
          />
        </Field>
        <Field label={t("drivers.phone")}>
          <TextInput
            value={form.phone}
            placeholder={ph(t, "phone")}
            onChange={(v) => patchForm({ phone: v })}
          />
        </Field>
        <Field label={t("drivers.telegram")}>
          <TextInput
            value={form.telegramUsername}
            placeholder={ph(t, "telegram")}
            onChange={(v) => patchForm({ telegramUsername: v })}
          />
        </Field>
        <p className="crm-form-hint">{t("drivers.idDocumentHint")}</p>
        <Field label={t("drivers.pesel")} invalid={fieldInvalid("pesel")} errorMessage={fieldErrorMessage("pesel")}>
          <TextInput
            value={form.pesel}
            placeholder={ph(t, "pesel")}
            invalid={fieldInvalid("pesel")}
            onChange={(v) => patchForm({ pesel: v })}
          />
        </Field>
        <Field
          label={t("drivers.passportNumber")}
          invalid={fieldInvalid("passportNumber")}
          errorMessage={fieldErrorMessage("passportNumber")}
        >
          <TextInput
            value={form.passportNumber}
            placeholder={ph(t, "passportNumber")}
            invalid={fieldInvalid("passportNumber")}
            onChange={(v) => patchForm({ passportNumber: v })}
          />
        </Field>
        <Field label={t("drivers.fatherName")}>
          <TextInput
            value={form.fatherName}
            placeholder={ph(t, "fatherName")}
            onChange={(v) => patchForm({ fatherName: v })}
          />
        </Field>
        <Field label={t("drivers.motherName")}>
          <TextInput
            value={form.motherName}
            placeholder={ph(t, "motherName")}
            onChange={(v) => patchForm({ motherName: v })}
          />
        </Field>
        <Field
          label={t("drivers.addressCity")}
          invalid={fieldInvalid("addressCity")}
          errorMessage={fieldErrorMessage("addressCity")}
        >
          <TextInput
            value={form.addressCity}
            placeholder={ph(t, "addressCity")}
            invalid={fieldInvalid("addressCity")}
            onChange={(v) => patchForm({ addressCity: v })}
          />
        </Field>
        <Field
          label={t("drivers.addressPostalCode")}
          invalid={fieldInvalid("addressPostalCode")}
          errorMessage={fieldErrorMessage("addressPostalCode")}
        >
          <TextInput
            value={form.addressPostalCode}
            placeholder={ph(t, "addressPostalCode")}
            invalid={fieldInvalid("addressPostalCode")}
            onChange={(v) => patchForm({ addressPostalCode: v })}
          />
        </Field>
        <Field
          label={t("drivers.addressStreet")}
          invalid={fieldInvalid("addressStreet")}
          errorMessage={fieldErrorMessage("addressStreet")}
        >
          <TextInput
            value={form.addressStreet}
            placeholder={ph(t, "addressStreet")}
            invalid={fieldInvalid("addressStreet")}
            onChange={(v) => patchForm({ addressStreet: v })}
          />
        </Field>
        <Field
          label={t("drivers.addressHouse")}
          invalid={fieldInvalid("addressHouse")}
          errorMessage={fieldErrorMessage("addressHouse")}
        >
          <TextInput
            value={form.addressHouse}
            placeholder={ph(t, "addressHouse")}
            invalid={fieldInvalid("addressHouse")}
            onChange={(v) => patchForm({ addressHouse: v })}
          />
        </Field>
        <Field label={t("drivers.addressFlat")}>
          <TextInput
            value={form.addressFlat}
            placeholder={ph(t, "addressFlat")}
            onChange={(v) => patchForm({ addressFlat: v })}
          />
        </Field>
        <Field label={t("drivers.status")}>
          <SelectInput
            value={form.status}
            onChange={(v) => patchForm({ status: v })}
            options={Object.values(DriverStatus).map((s) => ({ value: s, label: t(`drivers.${s}`) }))}
          />
        </Field>
        <Field label={t("drivers.notes")}>
          <TextInput
            value={form.notes}
            placeholder={ph(t, "notes")}
            onChange={(v) => patchForm({ notes: v })}
          />
        </Field>

        {editId && (
          <AgreementSection
            driverId={editId}
            agreements={detail.data?.agreements ?? []}
            carOptions={(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate }))}
          />
        )}
        {editId && <Documents relatedType="DRIVER" relatedId={editId} />}
          </>
        )}
      </Modal>

      <DriverBalanceBreakdownModal
        open={balanceModal != null}
        driverId={balanceModal?.driverId ?? null}
        driverName={balanceModal?.driverName ?? ""}
        onClose={() => setBalanceModal(null)}
        onGiveDiscount={
          // Discounts are no longer a separate modal — they're entered
          // inline on a RENT payment in the Finance tab. Sending the
          // owner to Finance → Add payment with this driver preselected
          // (and the active car, when there is one) gets them to the
          // discount field in a single tap.
          !readOnly && balanceModal
            ? () => {
                const params = new URLSearchParams({
                  addPayment: "1",
                  driverId: balanceModal.driverId,
                });
                navigate(`/finance?${params.toString()}`);
                setBalanceModal(null);
              }
            : undefined
        }
      />
    </div>
  );
}

function DriverViewPanel(props: {
  form: DriverForm;
  driver?: Driver;
  balance?: { balance: number; depositHeld: number };
  tripsThisMonth: number;
}) {
  const { t } = useTranslation();
  const name = [props.form.firstName, props.form.lastName].filter(Boolean).join(" ") || "—";
  const address = [
    props.form.addressCity,
    props.form.addressPostalCode,
    props.form.addressStreet,
    props.form.addressHouse,
    props.form.addressFlat,
  ]
    .filter(Boolean)
    .join(", ");

  const activeAgreements = (props.driver?.agreements ?? []).filter((a) => a.status === "ACTIVE");

  return (
    <div className="crm-driver-view">
      <div className="crm-driver-view__name">{name}</div>
      <div className="crm-driver-view__grid">
        <DriverViewRow label={t("drivers.phone")} value={props.form.phone || "—"} />
        <DriverViewRow label={t("drivers.telegram")} value={props.form.telegramUsername || "—"} />
        <DriverViewRow label={t("drivers.status")} value={t(`drivers.${props.form.status}`)} />
        <DriverViewRow label={t("drivers.tripsMonth")} value={String(props.tripsThisMonth)} />
        <DriverViewRow label={t("drivers.balance")} value={formatMoney(props.balance?.balance ?? 0)} />
        <DriverViewRow label={t("drivers.deposit")} value={formatMoney(props.balance?.depositHeld ?? 0)} />
        {props.form.pesel ? <DriverViewRow label={t("drivers.pesel")} value={props.form.pesel} /> : null}
        {props.form.passportNumber ? (
          <DriverViewRow label={t("drivers.passportNumber")} value={props.form.passportNumber} />
        ) : null}
        {address ? <DriverViewRow label={t("drivers.addressCity")} value={address} /> : null}
      </div>
      {activeAgreements.length > 0 ? (
        <div className="crm-driver-view__section">
          <div className="crm-driver-view__section-title">{t("drivers.rentAgreement")}</div>
          {activeAgreements.map((a) => (
            <div key={a.id} className="crm-driver-view__agreement">
              {a.car?.plate ?? "—"} · {formatMoney(a.rentAmount)} / {t(`drivers.${a.period}`)}
            </div>
          ))}
        </div>
      ) : (
        <p className="crm-driver-view__hint">{t("drivers.noAgreement")}</p>
      )}
      {props.form.notes ? (
        <div className="crm-driver-view__section">
          <div className="crm-driver-view__section-title">{t("drivers.notes")}</div>
          <p className="crm-driver-view__notes">{props.form.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function DriverViewRow(props: { label: string; value: string }) {
  return (
    <div className="crm-driver-view__row">
      <div className="crm-driver-view__label">{props.label}</div>
      <div className="crm-driver-view__value">{props.value}</div>
    </div>
  );
}

function AgreementSection(props: {
  driverId: string;
  agreements: Agreement[];
  carOptions: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  const allAgreements = useAgreements();
  const create = useCreateAgreement();
  const end = useEndAgreement();
  const [carId, setCarId] = useState("");
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [period, setPeriod] = useState<RentPeriod>(RentPeriod.DAILY);
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState("");

  const active = props.agreements.filter((a) => a.status === AgreementStatus.ACTIVE);
  const activeCarIds = useMemo(
    () =>
      new Set(
        (allAgreements.data ?? [])
          .filter((a) => a.status === AgreementStatus.ACTIVE)
          .map((a) => a.carId),
      ),
    [allAgreements.data],
  );
  const isHistorical = Boolean(endDate.trim());
  const selectableCarOptions = useMemo(() => {
    const list = isHistorical
      ? props.carOptions
      : props.carOptions.filter((o) => !activeCarIds.has(o.value));
    if (carId && !list.some((o) => o.value === carId)) {
      const selected = props.carOptions.find((o) => o.value === carId);
      if (selected) return [...list, selected];
    }
    return list;
  }, [isHistorical, props.carOptions, activeCarIds, carId]);

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
        <SearchableSelect
          value={carId}
          onChange={setCarId}
          options={[{ value: "", label: t("common.none") }, ...selectableCarOptions]}
          placeholder={t("common.searchToFilter")}
        />
      </Field>
      <Field label={t("drivers.rentAmount")}>
        <MoneyNumberInput
          value={rentAmount}
          placeholder={ph(t, "rentAmount")}
          onChange={setRentAmount}
        />
      </Field>
      <Field label={t("drivers.deposit")}>
        <MoneyNumberInput
          value={depositAmount}
          placeholder={ph(t, "depositAmount")}
          onChange={setDepositAmount}
        />
      </Field>
      <Field label={t("drivers.period")}>
        <SelectInput
          value={period}
          onChange={setPeriod}
          options={Object.values(RentPeriod).map((p) => ({ value: p, label: t(`drivers.${p}`) }))}
        />
      </Field>
      <Field label={t("drivers.startDate")}>
        <DateInput value={startDate} example={ph(t, "startDate")} onChange={setStartDate} />
      </Field>
      <Field label={t("drivers.endDate")}>
        <DateInput value={endDate} clearable onChange={setEndDate} />
      </Field>
      <p className="crm-form-hint">{t("fleet.endDateHint")}</p>
      <button
        type="button"
        className="crm-btn-primary"
        disabled={!carId || rentAmount === "" || create.isPending}
        onClick={() => {
          const end = endDate.trim();
          if (end && startDate && end < startDate) {
            showAlert(t("fleet.endBeforeStart"));
            return;
          }
          if (!end && activeCarIds.has(carId)) {
            showAlert(t("fleet.noAvailableCars"));
            return;
          }
          const status = end ? AgreementStatus.ENDED : AgreementStatus.ACTIVE;
          const conflict = findAgreementDateConflict(
            {
              carId,
              startDate,
              endDate: end || null,
              status,
            },
            allAgreements.data ?? [],
          );
          if (conflict) {
            showAlert(t("fleet.rentalOverlap"));
            return;
          }
          create.mutate(
            {
              driverId: props.driverId,
              carId,
              rentAmount: rentAmount === "" ? 0 : rentAmount,
              depositAmount: depositAmount === "" ? 0 : depositAmount,
              period,
              startDate,
              ...(end ? { endDate: end, status: AgreementStatus.ENDED } : {}),
            },
            {
              onSuccess: () => {
                setCarId("");
                setRentAmount("");
                setDepositAmount("");
                setStartDate(todayInput());
                setEndDate("");
              },
              onError: (err) => {
                if (err instanceof ApiError && err.code === "rental_overlap") {
                  showAlert(t("fleet.rentalOverlap"));
                }
              },
            },
          );
        }}
      >
        + {t("drivers.rentAgreement")}
      </button>
    </div>
  );
}
