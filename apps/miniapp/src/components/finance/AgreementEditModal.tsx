import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AgreementStatus,
  RentPeriod,
  agreementIsTemporaryDriver,
} from "@taxi/shared";
import { useAgreements, useDrivers, useUpdateAgreement } from "../../hooks";
import { findAgreementDateConflict } from "../../agreementOverlap";
import { ApiError } from "../../api";
import { showAlert } from "../../telegram";
import type { Agreement } from "../../types";
import {
  Modal,
  Field,
  DateInput,
  SelectInput,
  SearchableSelect,
  TextInput,
  FormActions,
  MoneyNumberInput,
  isoDateOnly,
} from "../ui";

export function AgreementEditModal(props: {
  agreement: Agreement | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const drivers = useDrivers();
  const agreements = useAgreements();
  const update = useUpdateAgreement();

  const [useTemporaryDriver, setUseTemporaryDriver] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [temporaryDriverName, setTemporaryDriverName] = useState("");
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [period, setPeriod] = useState<RentPeriod>(RentPeriod.DAILY);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const a = props.agreement;
    if (!a) return;
    const isTemp = agreementIsTemporaryDriver(a);
    setUseTemporaryDriver(isTemp);
    setDriverId(a.driverId ?? "");
    setTemporaryDriverName(a.temporaryDriverName ?? "");
    setRentAmount(a.rentAmount);
    setDepositAmount(a.depositAmount);
    setPeriod(a.period);
    setStartDate(isoDateOnly(a.startDate));
    setEndDate(a.endDate ? isoDateOnly(a.endDate) : "");
  }, [props.agreement]);

  function submit() {
    if (!props.agreement || rentAmount === "" || !startDate) return;
    const hasDriver = !useTemporaryDriver && Boolean(driverId);
    const hasTemp = useTemporaryDriver && Boolean(temporaryDriverName.trim());
    if (!hasDriver && !hasTemp) return;

    const end = endDate.trim();
    if (end && end < startDate) {
      showAlert(t("fleet.endBeforeStart"));
      return;
    }

    // A future or current endDate keeps the agreement ACTIVE; only a past
    // endDate marks it ENDED. This matches the create-form logic so that
    // scheduling a future hand-off doesn't accidentally end the rental.
    const today = startDate.slice(0, 10);
    const endIsPast = !!end && end < today;
    const inferredStatus: AgreementStatus | undefined =
      end && endIsPast ? AgreementStatus.ENDED : undefined;

    const body: Record<string, unknown> = {
      ...(hasTemp
        ? { temporaryDriverName: temporaryDriverName.trim(), driverId: null }
        : { driverId, temporaryDriverName: null }),
      rentAmount,
      depositAmount: depositAmount === "" ? 0 : depositAmount,
      period,
      startDate,
      endDate: end || null,
    };

    // Preserve ACTIVE when only an endDate in the future is being set;
    // flip to ENDED only when the user explicitly picks a past endDate.
    if (inferredStatus) {
      body.status = inferredStatus;
    } else if (
      props.agreement.status === AgreementStatus.ACTIVE &&
      end &&
      !endIsPast
    ) {
      body.status = AgreementStatus.ACTIVE;
    }

    const nextStatus =
      (body.status as AgreementStatus | undefined) ?? props.agreement.status;
    const conflict = findAgreementDateConflict(
      {
        id: props.agreement.id,
        carId: props.agreement.carId,
        startDate,
        endDate: end || null,
        status: nextStatus,
      },
      agreements.data ?? [],
    );
    if (conflict) {
      showAlert(t("fleet.rentalOverlap"));
      return;
    }

    update.mutate(
      { id: props.agreement.id, body },
      {
        onSuccess: () => props.onClose(),
        onError: (err) => {
          if (err instanceof ApiError && err.code === "rental_overlap") {
            showAlert(t("fleet.rentalOverlap"));
          }
        },
      },
    );
  }

  return (
    <Modal
      open={props.open}
      title={t("fleet.editRentalTitle")}
      onClose={props.onClose}
      footer={
        <FormActions onCancel={props.onClose} onSave={submit} saving={update.isPending} />
      }
    >
      <Field label={t("finance.driver")}>
        <div className="crm-fleet-driver-mode">
          <button
            type="button"
            className={`crm-fleet-driver-mode__btn${!useTemporaryDriver ? " crm-fleet-driver-mode__btn--active" : ""}`}
            onClick={() => setUseTemporaryDriver(false)}
          >
            {t("fleet.registeredDriver")}
          </button>
          <button
            type="button"
            className={`crm-fleet-driver-mode__btn${useTemporaryDriver ? " crm-fleet-driver-mode__btn--active" : ""}`}
            onClick={() => {
              setUseTemporaryDriver(true);
              setDriverId("");
            }}
          >
            {t("fleet.temporaryDriver")}
          </button>
        </div>
        {useTemporaryDriver ? (
          <>
            <TextInput
              value={temporaryDriverName}
              placeholder={t("fleet.temporaryDriverPlaceholder")}
              onChange={setTemporaryDriverName}
            />
            <p className="crm-form-hint">{t("fleet.temporaryDriverHint")}</p>
          </>
        ) : (drivers.data?.length ?? 0) > 0 ? (
          <SearchableSelect
            value={driverId}
            onChange={setDriverId}
            options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
            placeholder={t("common.searchToFilter")}
          />
        ) : (
          <p className="crm-form-hint">{t("fleet.noDriversUseTemporary")}</p>
        )}
      </Field>
      <Field label={t("drivers.startDate")}>
        <DateInput value={startDate} onChange={setStartDate} />
      </Field>
      <Field label={t("drivers.endDate")}>
        <DateInput value={endDate} clearable min={startDate} onChange={setEndDate} />
      </Field>
      <p className="crm-form-hint">{t("fleet.endDateHint")}</p>
      <Field label={t("drivers.rentAmount")}>
        <MoneyNumberInput value={rentAmount} onChange={setRentAmount} />
      </Field>
      <Field label={t("drivers.deposit")}>
        <MoneyNumberInput value={depositAmount} onChange={setDepositAmount} />
      </Field>
      <Field label={t("drivers.period")}>
        <SelectInput
          value={period}
          onChange={setPeriod}
          options={Object.values(RentPeriod).map((p) => ({ value: p, label: t(`drivers.${p}`) }))}
        />
      </Field>
    </Modal>
  );
}
