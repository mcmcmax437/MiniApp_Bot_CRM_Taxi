import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSavePayment } from "../hooks";
import { Modal, formatMoney, DateInput, Field, MoneyNumberInput, SearchableSelect, TextInput } from "./ui";
import { Icon } from "./crm";
import type { Agreement, PaymentType } from "@taxi/shared";
import { todayInput } from "../dates";

/**
 * Modal for giving a driver a one-off discount. The discount is recorded
 * internally as a `Payment` row with `type = DISCOUNT` so the balance
 * calculation picks it up, but the UI here treats it as a distinct concept:
 *
 * - No "Received by partner" toggle (a discount is not income).
 * - No payment type selector (it's always a discount).
 * - No method selector (irrelevant for a discount).
 *
 * This keeps the income/payment list free of discount noise while still
 * letting the owner note things like "Wednesday car was in the shop,
 * discounted the day".
 */
export function GiveDiscountModal(props: {
  open: boolean;
  driverId: string;
  driverName: string;
  cars: { id: string; plate: string }[];
  agreements: Agreement[];
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const save = useSavePayment();

  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(todayInput());
  const [carId, setCarId] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ amount?: boolean; date?: boolean }>({});

  // Suggest the active car first (if any), then the most recent past car.
  const carOptions = useMemo(() => {
    const active = props.agreements
      .filter((a) => a.status === "ACTIVE" && a.driverId === props.driverId)
      .map((a) => a.car?.plate)
      .filter(Boolean) as string[];
    const past = props.agreements
      .filter((a) => a.status !== "ACTIVE" && a.driverId === props.driverId)
      .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
      .map((a) => a.car?.plate)
      .filter(Boolean) as string[];
    const ordered: string[] = [];
    for (const p of [...active, ...past]) if (!ordered.includes(p)) ordered.push(p);
    const carByPlate = new Map(props.cars.map((c) => [c.plate, c.id]));
    return [
      { value: "", label: t("common.none") },
      ...ordered
        .map((plate) => {
          const id = carByPlate.get(plate);
          return id ? { value: id, label: plate } : null;
        })
        .filter((c): c is { value: string; label: string } => Boolean(c)),
    ];
  }, [props.agreements, props.cars, props.driverId, t]);

  function reset() {
    setAmount("");
    setDate(todayInput());
    setCarId("");
    setNote("");
    setFieldErrors({});
  }

  function submit() {
    const errors = { amount: amount === "", date: !date.trim() };
    setFieldErrors(errors);
    if (errors.amount || errors.date) return;
    save.mutate(
      {
        data: {
          driverId: props.driverId,
          carId: carId || null,
          amount,
          date,
          type: "DISCOUNT" as PaymentType,
          method: "CASH" as const,
          note: note.trim() || null,
          receivedByPartner: false,
          partnerSettled: false,
        },
      },
      {
        onSuccess: () => {
          reset();
          props.onSaved();
          props.onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={props.open}
      title={t("discount.title", { driver: props.driverName })}
      onClose={() => {
        reset();
        props.onClose();
      }}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="crm-btn-outline"
            onClick={() => {
              reset();
              props.onClose();
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={submit}
            disabled={save.isPending}
          >
            {save.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <div className="crm-discount-hero">
        <Icon name="receipt-dollar" size={20} color="#ffc107" />
        <div>
          <div className="crm-discount-hero__title">{t("discount.heroTitle")}</div>
          <div className="crm-discount-hero__subtitle">{t("discount.heroSubtitle")}</div>
        </div>
      </div>

      <Field
        label={t("discount.amount")}
        invalid={fieldErrors.amount}
        errorMessage={fieldErrors.amount ? t("common.requiredField") : undefined}
      >
        <MoneyNumberInput
          value={amount}
          invalid={fieldErrors.amount}
          onChange={(v) => {
            setAmount(v);
            if (v !== "") setFieldErrors((e) => ({ ...e, amount: false }));
          }}
        />
      </Field>
      <p className="crm-field-hint">{t("discount.amountHint")}</p>

      <Field
        label={t("discount.date")}
        invalid={fieldErrors.date}
        errorMessage={fieldErrors.date ? t("common.requiredField") : undefined}
      >
        <DateInput
          value={date}
          invalid={fieldErrors.date}
          onChange={(v) => {
            setDate(v);
            if (v.trim()) setFieldErrors((e) => ({ ...e, date: false }));
          }}
        />
      </Field>

      <Field label={t("discount.car")}>
        <SearchableSelect value={carId} onChange={setCarId} options={carOptions} />
      </Field>

      <Field label={t("discount.reason")}>
        <TextInput value={note} onChange={setNote} placeholder={t("discount.reasonPlaceholder")} />
      </Field>
      <p className="crm-field-hint">{t("discount.reasonHint")}</p>

      {amount !== "" && amount > 0 ? (
        <div className="crm-discount-preview">
          <span>{t("discount.willReduce")}</span>
          <strong>{formatMoney(amount)}</strong>
        </div>
      ) : null}
    </Modal>
  );
}
