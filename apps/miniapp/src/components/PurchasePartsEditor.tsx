import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Currency, type CarPurchasePartInput } from "@taxi/shared";
import {
  CURRENCY_META,
  CURRENCY_OPTIONS,
  formatMoney,
  getAppCurrency,
  useAppCurrency,
} from "../currency";
import { Field, MoneyNumberInput, NumberInput, SelectInput, TextInput } from "./ui";
import { IconActionButton } from "./crm";

export type PurchasePartDraft = {
  key: string;
  amount: number | "";
  currency: Currency;
  fleetAmount: number | "";
  note: string;
};

export function emptyPurchasePart(currency: Currency = getAppCurrency()): PurchasePartDraft {
  return {
    key: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount: "",
    currency,
    fleetAmount: "",
    note: "",
  };
}

export function partsFromCar(
  parts:
    | Array<{
        amount: number;
        currency: string;
        fleetAmount: number;
        note?: string | null;
      }>
    | undefined,
): PurchasePartDraft[] {
  if (!parts || parts.length === 0) return [];
  return parts.map((p, i) => ({
    key: `existing-${i}`,
    amount: p.amount,
    currency: (Object.values(Currency).includes(p.currency as Currency)
      ? p.currency
      : getAppCurrency()) as Currency,
    fleetAmount: p.fleetAmount,
    note: p.note ?? "",
  }));
}

/** Valid API payload, or null if any row is incomplete. */
export function serializePurchaseParts(parts: PurchasePartDraft[]): CarPurchasePartInput[] | null {
  if (parts.length === 0) return [];
  const out: CarPurchasePartInput[] = [];
  for (const p of parts) {
    if (p.amount === "" || p.fleetAmount === "") return null;
    if (p.amount <= 0 || p.fleetAmount <= 0) return null;
    out.push({
      amount: p.amount,
      currency: p.currency,
      fleetAmount: p.fleetAmount,
      note: p.note.trim() || null,
    });
  }
  return out;
}

export function sumFleetParts(parts: PurchasePartDraft[]): number {
  return parts.reduce((s, p) => s + (typeof p.fleetAmount === "number" ? p.fleetAmount : 0), 0);
}

/**
 * Editable list of how a car purchase was paid — supports mixed currencies.
 * Foreign-currency rows require a separate "in fleet currency" amount.
 */
export function PurchasePartsEditor(props: {
  parts: PurchasePartDraft[];
  onChange: (parts: PurchasePartDraft[]) => void;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const fleetCurrency = useAppCurrency();
  const total = useMemo(() => sumFleetParts(props.parts), [props.parts]);

  function patch(key: string, nextPatch: Partial<PurchasePartDraft>) {
    props.onChange(
      props.parts.map((p) => {
        if (p.key !== key) return p;
        const next = { ...p, ...nextPatch };
        if (nextPatch.amount !== undefined && next.currency === fleetCurrency) {
          next.fleetAmount = nextPatch.amount;
        }
        if (
          nextPatch.currency !== undefined &&
          nextPatch.currency === fleetCurrency &&
          next.amount !== ""
        ) {
          next.fleetAmount = next.amount;
        }
        return next;
      }),
    );
  }

  return (
    <div className={`crm-purchase-parts${props.invalid ? " crm-purchase-parts--invalid" : ""}`}>
      <p className="crm-form-hint">{t("cars.purchasePartsHint")}</p>
      {props.parts.map((part, index) => {
        const foreign = part.currency !== fleetCurrency;
        const symbol = CURRENCY_META[part.currency]?.symbol ?? part.currency;
        return (
          <div key={part.key} className="crm-purchase-part">
            <div className="crm-purchase-part__head">
              <span className="crm-purchase-part__title">
                {t("cars.purchasePartN", { n: index + 1 })}
              </span>
              <IconActionButton
                icon="delete-02"
                label={t("common.delete")}
                onClick={() => props.onChange(props.parts.filter((p) => p.key !== part.key))}
              />
            </div>
            <div className="crm-purchase-part__row">
              <Field label={t("finance.amount")}>
                <div className="crm-money-input">
                  <NumberInput
                    value={part.amount}
                    onChange={(v) => patch(part.key, { amount: v })}
                  />
                  <span className="crm-money-input__symbol" aria-hidden>
                    {symbol}
                  </span>
                </div>
              </Field>
              <Field label={t("cars.purchasePartCurrency")}>
                <SelectInput
                  value={part.currency}
                  onChange={(v) => patch(part.key, { currency: v as Currency })}
                  options={CURRENCY_OPTIONS.map((c) => ({
                    value: c.value,
                    label: `${c.symbol} ${c.value}`,
                  }))}
                />
              </Field>
            </div>
            {foreign ? (
              <Field label={t("cars.purchasePartFleetAmount", { currency: fleetCurrency })}>
                <MoneyNumberInput
                  value={part.fleetAmount}
                  onChange={(v) => patch(part.key, { fleetAmount: v })}
                />
              </Field>
            ) : null}
            <Field label={t("finance.note")}>
              <TextInput
                value={part.note}
                placeholder={t("cars.placeholder.purchasePartNote")}
                onChange={(v) => patch(part.key, { note: v })}
              />
            </Field>
          </div>
        );
      })}
      <IconActionButton
        icon="add-01"
        label={t("cars.addPurchasePart")}
        onClick={() => props.onChange([...props.parts, emptyPurchasePart(fleetCurrency)])}
      />
      {props.parts.length > 0 ? (
        <div className="crm-purchase-parts__total">
          {t("cars.purchasePartsTotal")}: <strong>{formatMoney(total, fleetCurrency)}</strong>
        </div>
      ) : null}
    </div>
  );
}
