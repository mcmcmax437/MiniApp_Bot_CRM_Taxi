import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PaymentBank, PaymentMethod, PAYMENT_BANKS } from "@taxi/shared";
import { ApiError } from "../api";
import { formatMoney } from "../currency";
import { useSellCar } from "../hooks";
import { todayInput } from "../dates";
import { showAlert } from "../telegram";
import { Icon } from "./crm";
import {
  DateInput,
  Field,
  Modal,
  MoneyNumberInput,
  SelectInput,
  TextArea,
  TextInput,
} from "./ui";

type SalePartDraft = {
  key: string;
  amount: number | "";
  date: string;
  method: PaymentMethod;
  bank: PaymentBank;
  note: string;
};

function newPart(date = todayInput()): SalePartDraft {
  return {
    key: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount: "",
    date,
    method: PaymentMethod.CASH,
    bank: PaymentBank.NONE,
    note: "",
  };
}

export function CarSellModal(props: {
  open: boolean;
  carId: string;
  plate: string;
  onClose: () => void;
  onSold: () => void;
}) {
  const { t } = useTranslation();
  const sell = useSellCar();
  const [parts, setParts] = useState<SalePartDraft[]>(() => [newPart()]);
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);

  const total = parts.reduce((sum, part) => sum + (typeof part.amount === "number" ? part.amount : 0), 0);

  function reset() {
    setParts([newPart()]);
    setNote("");
    setInvalid(false);
  }

  function close() {
    if (sell.isPending) return;
    reset();
    props.onClose();
  }

  function patchPart(key: string, patch: Partial<SalePartDraft>) {
    setParts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function submit() {
    const incomplete = parts.some((part) => part.amount === "" || part.amount <= 0 || !part.date);
    if (incomplete || parts.length === 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const sharedNote = note.trim() || t("cars.saleNoteDefault", { plate: props.plate });
    sell.mutate(
      {
        id: props.carId,
        data: {
          note: sharedNote,
          parts: parts.map((part) => ({
            amount: part.amount,
            date: part.date,
            method: part.method,
            bank: part.method === PaymentMethod.BANK ? part.bank : PaymentBank.NONE,
            note: part.note.trim() || null,
          })),
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
      <div className="crm-sale-parts">
        {parts.map((part, index) => {
          const amountInvalid = invalid && (part.amount === "" || part.amount <= 0);
          return (
            <section key={part.key} className="crm-sale-part">
              <div className="crm-sale-part__head">
                <h4>{t("cars.salePartLabel", { n: index + 1 })}</h4>
                {parts.length > 1 ? (
                  <button
                    type="button"
                    className="crm-sale-part__remove"
                    onClick={() => setParts((rows) => rows.filter((row) => row.key !== part.key))}
                  >
                    {t("cars.removeSalePart")}
                  </button>
                ) : null}
              </div>
              <Field label={t("cars.salePrice")} invalid={amountInvalid}>
                <MoneyNumberInput value={part.amount} invalid={amountInvalid} onChange={(amount) => patchPart(part.key, { amount })} />
              </Field>
              <Field label={t("cars.saleDate")} invalid={invalid && !part.date}>
                <DateInput value={part.date} onChange={(date) => patchPart(part.key, { date })} />
              </Field>
              <Field label={t("finance.method")}>
                <SelectInput
                  value={part.method}
                  onChange={(method) => patchPart(part.key, { method })}
                  options={[
                    { value: PaymentMethod.CASH, label: t("finance.CASH") },
                    { value: PaymentMethod.BANK, label: t("finance.BANK") },
                  ]}
                />
              </Field>
              {part.method === PaymentMethod.BANK ? (
                <Field label={t("finance.bank")}>
                  <SelectInput
                    value={part.bank}
                    onChange={(bank) => patchPart(part.key, { bank })}
                    options={PAYMENT_BANKS.map((value) => ({
                      value,
                      label: t(`finance.bank_${value}`),
                    }))}
                  />
                </Field>
              ) : null}
              <Field label={t("cars.notes")}>
                <TextInput
                  value={part.note}
                  placeholder={t("cars.salePartNote")}
                  onChange={(value) => patchPart(part.key, { note: value })}
                />
              </Field>
            </section>
          );
        })}
      </div>
      <button
        type="button"
        className="crm-btn-outline crm-sale-parts__add"
        onClick={() => setParts((rows) => [...rows, newPart(rows[rows.length - 1]?.date)])}
      >
        <Icon name="add-01" size={16} color="currentColor" />
        <span>{t("cars.addSalePart")}</span>
      </button>
      <p className="crm-sale-parts__total">
        {t("cars.salePartsTotal")}: <strong>{formatMoney(total)}</strong>
      </p>
      <Field label={t("cars.saleNote")}>
        <TextArea value={note} onChange={setNote} rows={3} maxLength={2000} />
      </Field>
    </Modal>
  );
}
