import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
import { confirmAction, showAlert } from "../../telegram";
import { useAgreements, useCars, useDrivers, useCreateAgreement, useEndAgreement } from "../../hooks";
import type { Agreement, Car } from "../../types";
import {
  Modal,
  Field,
  DateInput,
  SelectInput,
  FormActions,
  formatMoney,
  formatDate,
  MoneyNumberInput,
  todayInput,
} from "../ui";
import { Icon } from "../crm";
import {
  FinanceAddButton,
  FinanceStatCard,
  FinanceStatsRow,
  FinanceEmptyState,
  FinanceList,
} from "./FinanceUi";
import { CarDriverHistoryModal } from "./CarDriverHistoryModal";

export function FleetTab() {
  const { t } = useTranslation();
  const agreements = useAgreements();
  const cars = useCars();
  const drivers = useDrivers();
  const create = useCreateAgreement();
  const end = useEndAgreement();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [historyCar, setHistoryCar] = useState<Car | null>(null);
  const [form, setForm] = useState({
    driverId: "",
    carId: "",
    startDate: todayInput(),
    endDate: "",
    rentAmount: "" as number | "",
    depositAmount: "" as number | "",
    period: RentPeriod.DAILY as RentPeriod,
  });

  const active = useMemo(
    () => (agreements.data ?? []).filter((a) => a.status === AgreementStatus.ACTIVE),
    [agreements.data],
  );

  const activeByCarId = useMemo(() => new Map(active.map((a) => [a.carId, a])), [active]);

  const historyByCarId = useMemo(() => {
    const map = new Map<string, Agreement[]>();
    for (const agreement of agreements.data ?? []) {
      const list = map.get(agreement.carId) ?? [];
      list.push(agreement);
      map.set(agreement.carId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }
    return map;
  }, [agreements.data]);

  const availableCars = useMemo(
    () => (cars.data ?? []).filter((c) => !activeByCarId.has(c.id)),
    [cars.data, activeByCarId],
  );
  const isHistoricalAssign = Boolean(form.endDate.trim());
  const assignCarOptions = useMemo(() => {
    const list = isHistoricalAssign ? (cars.data ?? []) : availableCars;
    return list.map((c) => ({ value: c.id, label: c.plate }));
  }, [isHistoricalAssign, cars.data, availableCars]);

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
      carId: carId || (availableCars[0]?.id ?? cars.data?.[0]?.id ?? ""),
      startDate: todayInput(),
      endDate: "",
      rentAmount: "",
      depositAmount: "",
      period: RentPeriod.DAILY,
    });
    setOpen(true);
  }

  function submit() {
    if (!form.driverId || !form.carId || form.rentAmount === "") return;
    const endDate = form.endDate.trim();
    if (endDate && form.startDate && endDate < form.startDate) {
      showAlert(t("fleet.endBeforeStart"));
      return;
    }
    if (!endDate && activeByCarId.has(form.carId)) {
      showAlert(t("fleet.noAvailableCars"));
      return;
    }
    create.mutate(
      {
        driverId: form.driverId,
        carId: form.carId,
        rentAmount: form.rentAmount,
        depositAmount: form.depositAmount === "" ? 0 : form.depositAmount,
        period: form.period,
        startDate: form.startDate,
        ...(endDate ? { endDate, status: AgreementStatus.ENDED } : {}),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  const hasDrivers = (drivers.data?.length ?? 0) > 0;
  const hasAvailableCars = availableCars.length > 0;

  function assignBlockedReason(): string | undefined {
    if (!hasDrivers) return t("fleet.needDriverFirst");
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

  function carSubtitle(car: Car): string {
    return [car.make, car.model, car.year].filter(Boolean).join(" ");
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
          icon={<Icon name="car-01" size={16} color="#69f0ae" />}
        />
        <FinanceStatCard
          title={t("fleet.availableCars")}
          value={String(availableCars.length)}
          subtitle={t("fleet.readyToAssign")}
          tone="blue"
          icon={<Icon name="garage" size={16} color="#448aff" />}
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
        <FinanceList loading={cars.isLoading || agreements.isLoading} className="crm-fleet-list">
          {fleetRows.map(({ car, agreement }) =>
            agreement ? (
              <div key={car.id} className="crm-fleet-card">
                <button
                  type="button"
                  className="crm-fleet-card__body"
                  onClick={() => setHistoryCar(car)}
                >
                  <div className="crm-fleet-card__head">
                    <span className="crm-fleet-card__plate">{car.plate}</span>
                    <span className="crm-fleet-card__amount crm-fleet-card__amount--income">
                      {formatMoney(agreement.rentAmount)} / {t(`drivers.${agreement.period}`)}
                    </span>
                  </div>
                  <p className="crm-fleet-card__meta">
                    {agreement.driver?.fullName ?? "—"} · {t("fleet.since")}{" "}
                    {formatDate(agreement.startDate)}
                  </p>
                  <span className="crm-fleet-card__history-link">
                    {t("fleet.viewDriverHistory")}
                    <Icon name="arrow-right-01" size={14} color="rgba(255,255,255,0.45)" />
                  </span>
                </button>
                <button
                  type="button"
                  className="crm-btn-outline crm-fleet-card__action"
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
              <div key={car.id} className="crm-fleet-card">
                <button
                  type="button"
                  className="crm-fleet-card__body"
                  onClick={() => setHistoryCar(car)}
                >
                  <div className="crm-fleet-card__head">
                    <span className="crm-fleet-card__plate">{car.plate}</span>
                    <span className="crm-fleet-card__amount">{t(`cars.${car.status}`)}</span>
                  </div>
                  <p className="crm-fleet-card__meta">
                    {[car.make, car.model].filter(Boolean).join(" ") || t("fleet.available")}
                  </p>
                  <span className="crm-fleet-card__history-link">
                    {t("fleet.viewDriverHistory")}
                    <Icon name="arrow-right-01" size={14} color="rgba(255,255,255,0.45)" />
                  </span>
                </button>
                <button
                  type="button"
                  className="crm-btn-primary crm-fleet-card__action"
                  onClick={() => handleAssign(car.id)}
                >
                  {t("fleet.assignCar")}
                </button>
              </div>
            ),
          )}
        </FinanceList>
      )}

      <CarDriverHistoryModal
        open={historyCar != null}
        carPlate={historyCar?.plate ?? ""}
        carSubtitle={historyCar ? carSubtitle(historyCar) : undefined}
        history={historyCar ? (historyByCarId.get(historyCar.id) ?? []) : []}
        onClose={() => setHistoryCar(null)}
        onAddPast={
          historyCar
            ? () => {
                const carId = historyCar.id;
                setHistoryCar(null);
                openAssign(carId);
              }
            : undefined
        }
      />

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
            options={assignCarOptions}
          />
        </Field>
        <Field label={t("drivers.startDate")}>
          <DateInput value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
        </Field>
        <Field label={t("drivers.endDate")}>
          <DateInput
            value={form.endDate}
            clearable
            onChange={(v) => setForm({ ...form, endDate: v })}
          />
        </Field>
        <p className="crm-form-hint">{t("fleet.endDateHint")}</p>
        <Field label={t("drivers.rentAmount")}>
          <MoneyNumberInput value={form.rentAmount} onChange={(v) => setForm({ ...form, rentAmount: v })} />
        </Field>
        <Field label={t("drivers.deposit")}>
          <MoneyNumberInput value={form.depositAmount} onChange={(v) => setForm({ ...form, depositAmount: v })} />
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
