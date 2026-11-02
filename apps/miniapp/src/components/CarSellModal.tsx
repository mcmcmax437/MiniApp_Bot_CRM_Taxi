import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PaymentBank, PaymentMethod, PAYMENT_BANKS } from "@taxi/shared";
import { ApiError } from "../api";
import { useSellCar } from "../hooks";
import { todayInput } from "../dates";
import { showAlert } from "../telegram";
import {
  DateInput,
  Field,
  Modal,
  MoneyNumberInput,
  SelectInput,
  TextArea,
} from "./ui";

export function CarSellModal(props: {
  open: boolean;
  carId: string;
  plate: string;
  onClose: () => void;
  onSold: () => void;
}) {
  const { t } = useTranslation();
  const sell = useSellCar();
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(todayInput());
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [bank, setBank] = useState<PaymentBank>(PaymentBank.NONE);
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);

  function reset() {
    setAmount("");
    setDate(todayInput());
    setMethod(PaymentMethod.CASH);
    setBank(PaymentBank.NONE);
    setNote("");
    setInvalid(false);
  }

  function close() {
    if (sell.isPending) return;
    reset();
    props.onClose();
  }

  function submit() {
    if (amount === "" || amount <= 0 || !date) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    sell.mutate(
      {
        id: props.carId,
        data: {
          amount,
          date,
          method,
          bank: method === PaymentMethod.BANK ? bank : PaymentBank.NONE,
          note: note.trim() || t("cars.saleNoteDefault", { plate: props.plate }),
        },
      },
      {
        onSuccess: () => {
          reset();
          props.onSold();
          props.onClose();
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : undefined;
          if (code === "already_sold") {
            showAlert(t("cars.alreadySold"));
            return;
          }
          showAlert(t("cars.sellFailed"));
        },
      },
    );
  }

  return (
    <Modal
      open={props.open}
      title={t("cars.sellTitle")}
      onClose={close}
      footer={
        <div className="crm-form-actions">
          <button type="button" className="crm-btn-outline" onClick={close} disabled={sell.isPending}>
            {t("common.cancel")}
          </button>
          <button type="button" className="crm-btn-primary" onClick={submit} disabled={sell.isPending}>
            {sell.isPending ? <span className="crm-spinner crm-form-actions__spinner" aria-hidden /> : null}
            <span>{t("cars.sellConfirm")}</span>
          </button>
        </div>
      }
    >
      <p className="crm-form-hint">{t("cars.sellHint")}</p>
      <Field label={t("cars.salePrice")} invalid={invalid && (amount === "" || amount <= 0)}>
        <MoneyNumberInput
          value={amount}
          invalid={invalid && (amount === "" || amount <= 0)}
          onChange={setAmount}
        />
      </Field>
      <Field label={t("cars.saleDate")} invalid={invalid && !date}>
        <DateInput value={date} onChange={setDate} />
      </Field>
      <Field label={t("finance.method")}>
        <SelectInput
          value={method}
          onChange={setMethod}
          options={[
            { value: PaymentMethod.CASH, label: t("finance.CASH") },
            { value: PaymentMethod.BANK, label: t("finance.BANK") },
          ]}
        />
      </Field>
      {method === PaymentMethod.BANK ? (
        <Field label={t("finance.bank")}>
          <SelectInput
            value={bank}
            onChange={setBank}
            options={PAYMENT_BANKS.map((value) => ({
              value,
              label: t(`finance.bank_${value}`),
            }))}
          />
        </Field>
      ) : null}
      <Field label={t("cars.notes")}>
        <TextArea value={note} onChange={setNote} rows={3} maxLength={2000} />
      </Field>
    </Modal>
  );
}
