import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
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

  const [driverId, setDriverId] = useState("");
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [period, setPeriod] = useState<RentPeriod>(RentPeriod.DAILY);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const a = props.agreement;
    if (!a) return;
    setDriverId(a.driverId);
    setRentAmount(a.rentAmount);
    setDepositAmount(a.depositAmount);
    setPeriod(a.period);
    setStartDate(isoDateOnly(a.startDate));
    setEndDate(a.endDate ? isoDateOnly(a.endDate) : "");
  }, [props.agreement]);

  function submit() {
    if (!props.agreement || rentAmount === "" || !driverId || !startDate) return;
    const end = endDate.trim();
    if (end && end < startDate) {
      showAlert(t("fleet.endBeforeStart"));
      return;
    }

    const body: Record<string, unknown> = {
      driverId,
      rentAmount,
      depositAmount: depositAmount === "" ? 0 : depositAmount,
      period,
      startDate,
      endDate: end || null,
    };

    if (props.agreement.status === AgreementStatus.ACTIVE && end) {
      body.status = AgreementStatus.ENDED;
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
        <SearchableSelect
          value={driverId}
          onChange={setDriverId}
          options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
          placeholder={t("common.searchToFilter")}
        />
      </Field>
      <Field label={t("drivers.startDate")}>
        <DateInput value={startDate} onChange={setStartDate} />
      </Field>
      <Field label={t("drivers.endDate")}>
        <DateInput value={endDate} clearable onChange={setEndDate} />
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
