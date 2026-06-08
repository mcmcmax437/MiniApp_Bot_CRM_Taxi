import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
import { confirmAction, showAlert } from "../../telegram";
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

  const hasDrivers = (drivers.data?.length ?? 0) > 0;
  const hasAvailableCars = availableCars.length > 0;

  function assignBlockedReason(): string | undefined {
    if (!hasDrivers) return t("fleet.needDriverFirst");
    if (!hasAvailableCars) return t("fleet.noAvailableCars");
    return undefined;
  }

  function handleAssign(carId = "") {
    const blocked = assignBlockedReason();
    if (blocked) {
      showAlert(blocked);
      return;
    }
    openAssign(carId);
  }

  return (
    <>
      <FinanceAddButton
        label={t("fleet.assignCar")}
        onClick={() => openAssign()}
        blockedReason={assignBlockedReason()}
      />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("fleet.activeRentals")}
          value={String(active.length)}
          subtitle={t("fleet.onTheRoad")}
          tone="green"
          icon={<Icon name="car-01" size={22} color="#69f0ae" />}
        />
        <FinanceStatCard
          title={t("fleet.availableCars")}
          value={String(availableCars.length)}
          subtitle={t("fleet.readyToAssign")}
          tone="blue"
          icon={<Icon name="garage" size={22} color="#448aff" />}
        />
      </FinanceStatsRow>

      <div className="crm-search-row crm-fleet-search">
        <label className="crm-search-input">
          <Icon name="search-01" size={20} color="rgba(255,255,255,0.45)" />
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
          actionLabel={t("fleet.assignCar")}
          onAction={() => handleAssign()}
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
                    void confirmAction(t("fleet.endConfirm"), t("common.delete"), t("common.cancel")).then(
                      (ok) => {
                        if (ok) end.mutate(agreement.id);
                      },
                    );
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
                  onClick={() => handleAssign(car.id)}
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
