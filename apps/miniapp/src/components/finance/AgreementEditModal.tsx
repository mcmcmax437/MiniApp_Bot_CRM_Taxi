import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AgreementStatus,
  RentPeriod,
  agreementIsTemporaryDriver,
  inferAgreementStatus,
  validateAgreementDates,
} from "@taxi/shared";
import { useAgreements, useDrivers, useUpdateAgreement } from "../../hooks";
import { findAgreementDateConflict, rentalOverlapMessage, agreementDateValidationMessage, agreementApiErrorMessage } from "../../agreementOverlap";
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
  formatDate,
  todayInput,
} from "../ui";
import { collectEditFormErrors, type EditFormField } from "./financeFormValidation";

function scrollToFirstFieldError() {
  requestAnimationFrame(() => {
    document.querySelector(".crm-field--error")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}

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
  const [fieldErrors, setFieldErrors] = useState<Set<EditFormField>>(new Set());

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
    setFieldErrors(new Set());
  }, [props.agreement]);

  function clearError(name: EditFormField) {
    if (!fieldErrors.has(name)) return;
    setFieldErrors((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  function fieldInvalid(name: EditFormField): boolean {
    return fieldErrors.has(name);
  }

  function submit() {
    if (!props.agreement) return;
    const errors = collectEditFormErrors({
      useTemporaryDriver,
      driverId,
      temporaryDriverName,
      rentAmount,
      startDate,
    });
    if (errors.size > 0) {
      setFieldErrors(errors);
      scrollToFirstFieldError();
      return;
    }

    const end = endDate.trim();
    const asOf = todayInput();
    const requireEnd =
      props.agreement.status === AgreementStatus.ENDED ||
      (!!end && inferAgreementStatus(end, asOf) === AgreementStatus.ENDED);
    const dateCheck = validateAgreementDates(startDate, end || null, {
      requireEndDate: requireEnd,
      asOf,
    });
    if (!dateCheck.ok) {
      showAlert(agreementDateValidationMessage(dateCheck, t));
      return;
    }

    const inferredStatus = inferAgreementStatus(end || null, asOf);

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
    if (inferredStatus === AgreementStatus.ENDED) {
      body.status = inferredStatus;
    } else if (
      props.agreement.status === AgreementStatus.ACTIVE &&
      end
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
      showAlert(rentalOverlapMessage(conflict, t, formatDate));
      return;
    }

    update.mutate(
      { id: props.agreement.id, body },
      {
        onSuccess: () => props.onClose(),
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.code === "rental_overlap") {
              showAlert(t("fleet.rentalOverlap"));
            } else {
              showAlert(agreementApiErrorMessage(err.code, t));
            }
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
      <Field
        label={t("finance.driver")}
        invalid={fieldInvalid("driver")}
        errorMessage={fieldInvalid("driver") ? t("fleet.driverOrTempRequired") : undefined}
      >
        <div className="crm-fleet-driver-mode">
          <button
            type="button"
            className={`crm-fleet-driver-mode__btn${!useTemporaryDriver ? " crm-fleet-driver-mode__btn--active" : ""}`}
            onClick={() => {
              setUseTemporaryDriver(false);
              clearError("driver");
            }}
          >
            {t("fleet.registeredDriver")}
          </button>
          <button
            type="button"
            className={`crm-fleet-driver-mode__btn${useTemporaryDriver ? " crm-fleet-driver-mode__btn--active" : ""}`}
            onClick={() => {
              setUseTemporaryDriver(true);
              setDriverId("");
              clearError("driver");
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
              invalid={fieldInvalid("driver")}
              onChange={(v) => {
                setTemporaryDriverName(v);
                clearError("driver");
              }}
            />
            <p className="crm-form-hint">{t("fleet.temporaryDriverHint")}</p>
          </>
        ) : (drivers.data?.length ?? 0) > 0 ? (
          <SearchableSelect
            value={driverId}
            onChange={(v) => {
              setDriverId(v);
              clearError("driver");
            }}
            options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
            placeholder={t("common.searchToFilter")}
            invalid={fieldInvalid("driver")}
          />
        ) : (
          <p className="crm-form-hint">{t("fleet.noDriversUseTemporary")}</p>
        )}
      </Field>
      <Field
        label={t("drivers.startDate")}
        invalid={fieldInvalid("startDate")}
        errorMessage={fieldInvalid("startDate") ? t("common.requiredField") : undefined}
      >
        <DateInput
          value={startDate}
          invalid={fieldInvalid("startDate")}
          onChange={(v) => {
            setStartDate(v);
            clearError("startDate");
          }}
        />
      </Field>
      <Field label={t("drivers.endDate")}>
        <DateInput value={endDate} clearable min={startDate} onChange={setEndDate} />
      </Field>
      <p className="crm-form-hint">{t("fleet.endDateHint")}</p>
      <Field
        label={t("drivers.rentAmount")}
        invalid={fieldInvalid("rentAmount")}
        errorMessage={fieldInvalid("rentAmount") ? t("common.requiredField") : undefined}
      >
        <MoneyNumberInput
          value={rentAmount}
          invalid={fieldInvalid("rentAmount")}
          onChange={(v) => {
            setRentAmount(v);
            clearError("rentAmount");
          }}
        />
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
