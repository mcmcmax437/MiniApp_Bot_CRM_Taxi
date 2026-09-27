import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Currency, type CarPurchasePartInput } from "@taxi/shared";
import {
  CURRENCY_META,
  CURRENCY_OPTIONS,
  formatMoney,
  getAppCurrency,
  getCurrencySymbol,
  useAppCurrency,
} from "../currency";
import { Field, MoneyNumberInput, NumberInput, SelectInput, TextInput } from "./ui";
import { IconActionButton } from "./crm";

export type PurchasePartDraft = {
  key: string;
  amount: number | "";
  currency: Currency;
  /** Fleet-currency units per 1 unit of `currency` (1 when same currency). */
  rate: number | "";
  fleetAmount: number | "";
  note: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function deriveRate(amount: number, fleetAmount: number): number {
  if (amount <= 0) return 1;
  return round2(fleetAmount / amount);
}

function deriveFleet(amount: number, rate: number): number {
  return round2(amount * rate);
}

export function emptyPurchasePart(currency: Currency = getAppCurrency()): PurchasePartDraft {
  return {
    key: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount: "",
    currency,
    rate: 1,
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
  return parts.map((p, i) => {
    const currency = (Object.values(Currency).includes(p.currency as Currency)
      ? p.currency
      : getAppCurrency()) as Currency;
    return {
      key: `existing-${i}`,
      amount: p.amount,
      currency,
      rate: deriveRate(p.amount, p.fleetAmount),
      fleetAmount: p.fleetAmount,
      note: p.note ?? "",
    };
  });
}

/** Valid API payload, or null if any row is incomplete. */
export function serializePurchaseParts(parts: PurchasePartDraft[]): CarPurchasePartInput[] | null {
  if (parts.length === 0) return [];
  const out: CarPurchasePartInput[] = [];
  for (const p of parts) {
    if (p.amount === "" || p.fleetAmount === "") return null;
    if (p.amount <= 0 || p.fleetAmount <= 0) return null;
    const rate =
      p.rate === "" || p.rate <= 0 ? deriveRate(p.amount, p.fleetAmount) : p.rate;
    const fleetAmount =
      p.currency === getAppCurrency() ? p.amount : deriveFleet(p.amount, rate);
    out.push({
      amount: p.amount,
      currency: p.currency,
      fleetAmount,
      note: p.note.trim() || null,
    });
  }
  return out;
}

export function sumFleetParts(parts: PurchasePartDraft[]): number {
  return round2(
    parts.reduce((s, p) => {
      if (typeof p.fleetAmount === "number") return s + p.fleetAmount;
      if (typeof p.amount === "number" && typeof p.rate === "number") {
        return s + deriveFleet(p.amount, p.rate);
      }
      return s;
    }, 0),
  );
}

/**
 * Editable list of how a car purchase was paid — supports mixed currencies.
 * Foreign-currency rows use an explicit conversion rate so the fleet total
 * stays correct (amount × rate = fleet amount).
 */
export function PurchasePartsEditor(props: {
  parts: PurchasePartDraft[];
  onChange: (parts: PurchasePartDraft[]) => void;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const fleetCurrency = useAppCurrency();
  const fleetSymbol = getCurrencySymbol(fleetCurrency);
  const total = useMemo(() => sumFleetParts(props.parts), [props.parts]);

  function patch(key: string, nextPatch: Partial<PurchasePartDraft>) {
    props.onChange(
      props.parts.map((p) => {
        if (p.key !== key) return p;
        const next: PurchasePartDraft = { ...p, ...nextPatch };

        // Switching to fleet currency: rate is always 1, fleet mirrors amount.
        if (nextPatch.currency !== undefined) {
          if (next.currency === fleetCurrency) {
            next.rate = 1;
            if (next.amount !== "") next.fleetAmount = next.amount;
          } else if (p.currency === fleetCurrency) {
            // Left fleet currency — clear stale 1:1 fleet amount / keep rate empty for user.
            next.rate = "";
            next.fleetAmount = "";
          }
        }

        if (next.currency === fleetCurrency) {
          if (nextPatch.amount !== undefined && next.amount !== "") {
            next.rate = 1;
            next.fleetAmount = next.amount;
          }
          return next;
        }

        // Foreign currency: keep amount × rate = fleetAmount in sync.
        if (nextPatch.amount !== undefined || nextPatch.rate !== undefined) {
          if (next.amount !== "" && next.rate !== "" && next.rate > 0) {
            next.fleetAmount = deriveFleet(next.amount, next.rate);
          }
        } else if (nextPatch.fleetAmount !== undefined) {
          if (next.amount !== "" && next.amount > 0 && next.fleetAmount !== "") {
            next.rate = deriveRate(next.amount, next.fleetAmount);
          }
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
        const rateLabel = t("cars.purchasePartRate", {
          fleet: fleetSymbol,
          foreign: symbol,
        });
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
              <>
                <Field label={rateLabel}>
                  <NumberInput
                    value={part.rate}
                    placeholder="0.00"
                    onChange={(v) => patch(part.key, { rate: v })}
                  />
                </Field>
                <Field label={t("cars.purchasePartFleetAmount", { currency: fleetCurrency })}>
                  <MoneyNumberInput
                    value={part.fleetAmount}
                    onChange={(v) => patch(part.key, { fleetAmount: v })}
                  />
                </Field>
                {part.amount !== "" && part.rate !== "" && part.fleetAmount !== "" ? (
                  <p className="crm-form-hint crm-purchase-part__rate-hint">
                    {t("cars.purchasePartRateHint", {
                      amount: formatMoney(part.amount, part.currency),
                      rate: part.rate,
                      fleet: formatMoney(part.fleetAmount, fleetCurrency),
                      fleetSymbol,
                      foreignSymbol: symbol,
                    })}
                  </p>
                ) : null}
              </>
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
