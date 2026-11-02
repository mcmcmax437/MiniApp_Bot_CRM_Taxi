import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PaymentBank, PaymentMethod, PAYMENT_BANKS } from "@taxi/shared";
import { ApiError } from "../api";
import { formatMoney } from "../currency";
import { useSellCar, useUpdateCarSale } from "../hooks";
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

export type SalePartDraft = {
  key: string;
  amount: number | "";
  date: string;
  method: PaymentMethod;
  bank: PaymentBank;
  note: string;
};

function partNoteForForm(note: string | null, shared: string | null): string {
  const value = note?.trim() ?? "";
  const base = shared?.trim() ?? "";
  if (!value) return "";
  if (base && (value === base || value.startsWith(`${base} (`))) return "";
  return value;
}

export function salePartsFromPayments(
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    bank?: PaymentBank | null;
    note: string | null;
  }>,
  sharedNote: string | null,
): SalePartDraft[] {
  return [...payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((payment) => ({
      key: payment.id,
      amount: payment.amount,
      date: payment.date.slice(0, 10),
      method: payment.method,
      bank: payment.bank ?? PaymentBank.NONE,
      note: partNoteForForm(payment.note, sharedNote),
    }));
}

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
  mode?: "create" | "edit";
  initialParts?: SalePartDraft[];
  initialNote?: string;
  loading?: boolean;
  onClose: () => void;
  onSold: () => void;
}) {
  const { t } = useTranslation();
  const mode = props.mode ?? "create";
  const sell = useSellCar();
  const update = useUpdateCarSale();
  const pending = sell.isPending || update.isPending;
  const [parts, setParts] = useState<SalePartDraft[]>(() => [newPart()]);
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setInvalid(false);
    if (mode === "edit") {
      setParts(props.initialParts && props.initialParts.length > 0 ? props.initialParts : [newPart()]);
      setNote(props.initialNote ?? "");
      return;
    }
    setParts([newPart()]);
    setNote("");
  }, [props.open, mode, props.initialParts, props.initialNote]);

  const total = parts.reduce((sum, part) => sum + (typeof part.amount === "number" ? part.amount : 0), 0);

  function close() {
    if (pending) return;
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
    const payload = {
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
    };
    const request = mode === "edit" ? update : sell;
    request.mutate(payload, {
      onSuccess: () => {
        props.onSold();
        props.onClose();
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "already_sold") {
          showAlert(t("cars.alreadySold"));
          return;
        }
        if (code === "not_sold") {
          showAlert(t("cars.editSaleFailed"));
          return;
        }
        showAlert(mode === "edit" ? t("cars.editSaleFailed") : t("cars.sellFailed"));
      },
    });
  }

  return (
    <Modal
      open={props.open}
      title={mode === "edit" ? t("cars.editSaleTitle") : t("cars.sellTitle")}
      onClose={close}
      footer={
        <div className="crm-form-actions">
          <button type="button" className="crm-btn-outline" onClick={close} disabled={pending}>
            {t("common.cancel")}
          </button>
          <button type="button" className="crm-btn-primary" onClick={submit} disabled={pending || props.loading}>
            {pending ? <span className="crm-spinner crm-form-actions__spinner" aria-hidden /> : null}
            <span>{mode === "edit" ? t("common.save") : t("cars.sellConfirm")}</span>
          </button>
        </div>
      }
    >
      <p className="crm-form-hint">{mode === "edit" ? t("cars.editSaleHint") : t("cars.sellHint")}</p>
      {props.loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
        </div>
      ) : (
      <>
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
      </>
      )}
    </Modal>
  );
}
