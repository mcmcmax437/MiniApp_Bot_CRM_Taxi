import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
import { useAgreements, useCars, useDrivers, useCreateAgreement, useEndAgreement } from "../../hooks";
import {
  Modal,
  Field,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
  formatMoney,
  formatDate,
  todayInput,
} from "../ui";
import { Icon } from "../crm";
import {
  FinanceAddButton,
  FinanceStatCard,
  FinanceStatsRow,
  FinanceEmptyState,
  FinanceList,
  FinanceListItem,
} from "./FinanceUi";

export function FleetTab() {
  const { t } = useTranslation();
  const agreements = useAgreements();
  const cars = useCars();
  const drivers = useDrivers();
  const create = useCreateAgreement();
  const end = useEndAgreement();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    driverId: "",
    carId: "",
    startDate: todayInput(),
    rentAmount: "" as number | "",
    depositAmount: "" as number | "",
    period: RentPeriod.DAILY as RentPeriod,
  });

  const active = useMemo(
    () => (agreements.data ?? []).filter((a) => a.status === AgreementStatus.ACTIVE),
    [agreements.data],
  );

  const activeByCarId = useMemo(() => new Map(active.map((a) => [a.carId, a])), [active]);

  const availableCars = useMemo(
    () => (cars.data ?? []).filter((c) => !activeByCarId.has(c.id)),
    [cars.data, activeByCarId],
  );

  const fleetRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cars.data ?? [])
      .map((car) => ({ car, agreement: activeByCarId.get(car.id) }))
      .filter(({ car, agreement }) => {
        if (!q) return true;
        const hay = [
          car.plate,
          car.make,
          car.model,
          agreement?.driver?.fullName,
          agreement ? formatDate(agreement.startDate) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (a.agreement && !b.agreement) return -1;
        if (!a.agreement && b.agreement) return 1;
        return a.car.plate.localeCompare(b.car.plate);
      });
  }, [cars.data, activeByCarId, search]);

  function openAssign(carId = "") {
    setForm({
      driverId: drivers.data?.[0]?.id ?? "",
      carId: carId || (availableCars[0]?.id ?? ""),
      startDate: todayInput(),
      rentAmount: "",
      depositAmount: "",
      period: RentPeriod.DAILY,
    });
    setOpen(true);
  }

  function submit() {
    if (!form.driverId || !form.carId || form.rentAmount === "") return;
    create.mutate(
      {
        driverId: form.driverId,
        carId: form.carId,
        rentAmount: form.rentAmount,
        depositAmount: form.depositAmount === "" ? 0 : form.depositAmount,
        period: form.period,
        startDate: form.startDate,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  const canAssign = availableCars.length > 0 && (drivers.data?.length ?? 0) > 0;

  return (
    <>
      <FinanceAddButton
        label={t("fleet.assignCar")}
        onClick={() => openAssign()}
        disabled={!canAssign}
      />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("fleet.activeRentals")}
          value={String(active.length)}
          subtitle={t("fleet.onTheRoad")}
          tone="green"
          icon={
            <Icon stroke="#69f0ae" fill="none" width="22" height="22">
              <path
                d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c.83 0 1.5-.67 1.5-1.5S7.33 13 6.5 13 5 13.67 5 14.5 6.67 16 6.5 16zm11 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("fleet.availableCars")}
          value={String(availableCars.length)}
          subtitle={t("fleet.readyToAssign")}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <path d="M5 6h14v12H5z" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M8 10h8" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
        />
      </FinanceStatsRow>

      <div className="crm-search-row crm-fleet-search">
        <label className="crm-search-input">
          <Icon stroke="rgba(255,255,255,0.45)" fill="none" width="20" height="20">
            <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" strokeWidth="1.8" strokeLinecap="round" />
          </Icon>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("fleet.searchPlaceholder")}
          />
        </label>
      </div>

      <h3 className="crm-fleet-section-title">{t("fleet.allCarsTitle")}</h3>
      <p className="crm-fleet-section-hint">{t("fleet.allCarsHint")}</p>

      {!cars.isLoading && fleetRows.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("fleet.emptyDesc")}
          actionLabel={canAssign ? t("fleet.assignCar") : undefined}
          onAction={canAssign ? () => openAssign() : undefined}
        />
      ) : (
        <FinanceList loading={cars.isLoading || agreements.isLoading}>
          {fleetRows.map(({ car, agreement }) =>
            agreement ? (
              <div key={car.id} className="crm-fleet-row">
                <FinanceListItem
                  title={car.plate}
                  subtitle={`${agreement.driver?.fullName ?? "—"} • ${t("fleet.since")} ${formatDate(agreement.startDate)}`}
                  amount={`${formatMoney(agreement.rentAmount)} / ${t(`drivers.${agreement.period}`)}`}
                  amountTone="income"
                />
                <button
                  type="button"
                  className="crm-btn-outline crm-fleet-row__action"
                  disabled={end.isPending}
                  onClick={() => {
                    if (confirm(t("fleet.endConfirm"))) end.mutate(agreement.id);
                  }}
                >
                  {t("fleet.returnCar")}
                </button>
              </div>
            ) : (
              <div key={car.id} className="crm-fleet-row">
                <FinanceListItem
                  title={car.plate}
                  subtitle={[car.make, car.model].filter(Boolean).join(" ") || t("fleet.available")}
                  amount={t(`cars.${car.status}`)}
                  amountTone="neutral"
                />
                <button
                  type="button"
                  className="crm-btn-primary crm-fleet-row__action"
                  disabled={!canAssign}
                  onClick={() => openAssign(car.id)}
                >
                  {t("fleet.assignCar")}
                </button>
              </div>
            ),
          )}
        </FinanceList>
      )}

      <Modal
        open={open}
        title={t("fleet.assignCar")}
        onClose={() => setOpen(false)}
        footer={<FormActions onCancel={() => setOpen(false)} onSave={submit} saving={create.isPending} />}
      >
        <Field label={t("finance.driver")}>
          <SelectInput
            value={form.driverId}
            onChange={(v) => setForm({ ...form, driverId: v })}
            options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
          />
        </Field>
        <Field label={t("finance.car")}>
          <SelectInput
            value={form.carId}
            onChange={(v) => setForm({ ...form, carId: v })}
            options={availableCars.map((c) => ({ value: c.id, label: c.plate }))}
          />
        </Field>
        <Field label={t("drivers.startDate")}>
          <DateInput value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        </Field>
        <Field label={t("drivers.rentAmount")}>
          <NumberInput value={form.rentAmount} onChange={(v) => setForm({ ...form, rentAmount: v })} />
        </Field>
        <Field label={t("drivers.deposit")}>
          <NumberInput value={form.depositAmount} onChange={(v) => setForm({ ...form, depositAmount: v })} />
        </Field>
        <Field label={t("drivers.period")}>
          <SelectInput
            value={form.period}
            onChange={(v) => setForm({ ...form, period: v })}
            options={Object.values(RentPeriod).map((p) => ({ value: p, label: t(`drivers.${p}`) }))}
          />
        </Field>
      </Modal>
    </>
  );
}
