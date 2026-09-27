import { useEffect, useMemo, useRef, useState } from "react";
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
import { apiFetch, ApiError } from "../api";
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
  /** True when rate came from the live FX feed (not a manual override). */
  rateFromMarket?: boolean;
};

type FxRateResponse = {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: string;
};

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Keep enough decimals for FX mid-market rates (e.g. 4.3735). */
function roundRate(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function deriveRate(amount: number, fleetAmount: number): number {
  if (amount <= 0) return 1;
  return roundRate(fleetAmount / amount);
}

function deriveFleet(amount: number, rate: number): number {
  return roundMoney(amount * rate);
}

export function emptyPurchasePart(currency: Currency = getAppCurrency()): PurchasePartDraft {
  return {
    key: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount: "",
    currency,
    rate: 1,
    fleetAmount: "",
    note: "",
    rateFromMarket: currency === getAppCurrency(),
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
      rateFromMarket: false,
    };
  });
}

/** Valid API payload, or null if any row is incomplete. */
export function serializePurchaseParts(parts: PurchasePartDraft[]): CarPurchasePartInput[] | null {
  if (parts.length === 0) return [];
  const fleet = getAppCurrency();
  const out: CarPurchasePartInput[] = [];
  for (const p of parts) {
    if (p.amount === "" || p.amount <= 0) return null;
    if (p.currency === fleet) {
      out.push({
        amount: p.amount,
        currency: p.currency,
        fleetAmount: p.amount,
        note: p.note.trim() || null,
      });
      continue;
    }
    if (p.rate === "" || p.rate <= 0) return null;
    const fleetAmount = deriveFleet(p.amount, p.rate);
    if (fleetAmount <= 0) return null;
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
  const fleet = getAppCurrency();
  return roundMoney(
    parts.reduce((s, p) => {
      if (p.amount === "") return s;
      if (p.currency === fleet) return s + p.amount;
      if (typeof p.rate === "number" && p.rate > 0) return s + deriveFleet(p.amount, p.rate);
      if (typeof p.fleetAmount === "number") return s + p.fleetAmount;
      return s;
    }, 0),
  );
}

async function fetchMarketRate(from: Currency, to: Currency): Promise<FxRateResponse> {
  return apiFetch<FxRateResponse>("/fx/rate", { query: { from, to } });
}

/**
 * Editable list of how a car purchase was paid — supports mixed currencies.
 * Foreign rows auto-load a live mid-market rate (editable override).
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
  const [fxMeta, setFxMeta] = useState<Record<string, { date: string; source: string }>>({});
  const [fxLoading, setFxLoading] = useState<Record<string, boolean>>({});
  const [fxError, setFxError] = useState<Record<string, string>>({});
  const partsRef = useRef(props.parts);
  partsRef.current = props.parts;

  function replacePart(key: string, updater: (p: PurchasePartDraft) => PurchasePartDraft) {
    props.onChange(partsRef.current.map((p) => (p.key === key ? updater(p) : p)));
  }

  async function applyMarketRate(key: string, currency: Currency, amount: number | "") {
    if (currency === fleetCurrency) return;
    setFxLoading((m) => ({ ...m, [key]: true }));
    setFxError((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
    try {
      const res = await fetchMarketRate(currency, fleetCurrency);
      const rate = roundRate(res.rate);
      setFxMeta((m) => ({ ...m, [key]: { date: res.date, source: res.source } }));
      replacePart(key, (p) => ({
        ...p,
        rate,
        rateFromMarket: true,
        fleetAmount: amount === "" ? p.fleetAmount : deriveFleet(amount, rate),
      }));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? t("cars.purchasePartRateFetchFailed")
          : t("cars.purchasePartRateFetchFailed");
      setFxError((m) => ({ ...m, [key]: msg }));
    } finally {
      setFxLoading((m) => {
        const next = { ...m };
        delete next[key];
        return next;
      });
    }
  }

  // Auto-fetch when a foreign currency is chosen and rate is still empty / unset.
  useEffect(() => {
    for (const part of props.parts) {
      if (part.currency === fleetCurrency) continue;
      if (part.rate !== "" && part.rate > 0) continue;
      if (fxLoading[part.key] || fxError[part.key]) continue;
      void applyMarketRate(part.key, part.currency, part.amount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to currency/rate gaps
  }, [props.parts.map((p) => `${p.key}:${p.currency}:${p.rate === ""}`).join("|"), fleetCurrency]);

  function patch(key: string, nextPatch: Partial<PurchasePartDraft>) {
    props.onChange(
      props.parts.map((p) => {
        if (p.key !== key) return p;
        const next: PurchasePartDraft = { ...p, ...nextPatch };

        if (nextPatch.currency !== undefined) {
          if (next.currency === fleetCurrency) {
            next.rate = 1;
            next.rateFromMarket = true;
            if (next.amount !== "") next.fleetAmount = next.amount;
          } else if (p.currency !== next.currency) {
            // New foreign currency — clear so the effect / explicit fetch fills live rate.
            next.rate = "";
            next.fleetAmount = "";
            next.rateFromMarket = true;
          }
        }

        if (next.currency === fleetCurrency) {
          if (nextPatch.amount !== undefined && next.amount !== "") {
            next.rate = 1;
            next.fleetAmount = next.amount;
          }
          return next;
        }

        if (nextPatch.rate !== undefined) {
          next.rateFromMarket = false;
        }

        if (nextPatch.amount !== undefined || nextPatch.rate !== undefined) {
          if (next.amount !== "" && next.rate !== "" && next.rate > 0) {
            next.fleetAmount = deriveFleet(next.amount, next.rate);
          }
        } else if (nextPatch.fleetAmount !== undefined) {
          next.rateFromMarket = false;
          if (next.amount !== "" && next.amount > 0 && next.fleetAmount !== "") {
            next.rate = deriveRate(next.amount, next.fleetAmount);
          }
        }

        return next;
      }),
    );

    // Kick off live fetch immediately after a currency change to foreign.
    if (nextPatch.currency && nextPatch.currency !== fleetCurrency) {
      const amount = props.parts.find((p) => p.key === key)?.amount ?? "";
      void applyMarketRate(key, nextPatch.currency, amount);
    }
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
        const meta = fxMeta[part.key];
        const loading = Boolean(fxLoading[part.key]);
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
                  <div className="crm-purchase-part__rate-row">
                    <NumberInput
                      value={part.rate}
                      placeholder="0.0000"
                      onChange={(v) => patch(part.key, { rate: v })}
                    />
                    <IconActionButton
                      icon="refresh-01"
                      label={t("cars.purchasePartRateRefresh")}
                      onClick={() => void applyMarketRate(part.key, part.currency, part.amount)}
                      disabled={loading}
                      spinning={loading}
                    />
                  </div>
                </Field>
                <Field label={t("cars.purchasePartFleetAmount", { currency: fleetCurrency })}>
                  <MoneyNumberInput
                    value={part.fleetAmount}
                    onChange={(v) => patch(part.key, { fleetAmount: v })}
                  />
                </Field>
                {loading ? (
                  <p className="crm-form-hint">{t("cars.purchasePartRateLoading")}</p>
                ) : fxError[part.key] ? (
                  <p className="crm-form-hint crm-purchase-part__rate-error">{fxError[part.key]}</p>
                ) : part.amount !== "" && part.rate !== "" && part.fleetAmount !== "" ? (
                  <p className="crm-form-hint crm-purchase-part__rate-hint">
                    {t("cars.purchasePartRateHint", {
                      amount: formatMoney(part.amount, part.currency),
                      rate: part.rate,
                      fleet: formatMoney(part.fleetAmount, fleetCurrency),
                      fleetSymbol,
                      foreignSymbol: symbol,
                    })}
                    {meta
                      ? ` · ${t("cars.purchasePartRateSource", {
                          date: meta.date,
                          source: meta.source,
                        })}`
                      : part.rateFromMarket
                        ? ""
                        : ` · ${t("cars.purchasePartRateManual")}`}
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
