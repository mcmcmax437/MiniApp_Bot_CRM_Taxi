import { useEffect, useState, type ReactNode } from "react";
import i18n from "./i18n";
import type { Currency as CurrencyCode } from "@taxi/shared";
import { Currency as CurrencyEnum } from "@taxi/shared";

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; nameKey: string }
> = {
  UAH: { symbol: "₴", nameKey: "currency.UAH" },
  USD: { symbol: "$", nameKey: "currency.USD" },
  EUR: { symbol: "€", nameKey: "currency.EUR" },
  PLN: { symbol: "zł", nameKey: "currency.PLN" },
  GBP: { symbol: "£", nameKey: "currency.GBP" },
};

export const CURRENCY_OPTIONS = Object.values(CurrencyEnum).map((code) => ({
  value: code,
  ...CURRENCY_META[code],
}));

let appCurrency: CurrencyCode = "UAH";
const listeners = new Set<() => void>();

function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.values(CurrencyEnum).includes(value as CurrencyCode);
}

export function getAppCurrency(): CurrencyCode {
  return appCurrency;
}

export function setAppCurrency(currency: CurrencyCode): void {
  if (appCurrency === currency) return;
  appCurrency = currency;
  for (const listener of listeners) listener();
}

export function initCurrencyFromStorage(): void {
  const stored = localStorage.getItem("currency");
  if (stored && isCurrencyCode(stored)) appCurrency = stored;
}

function subscribeCurrency(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the subtree when the active currency changes. */
export function useAppCurrency(): CurrencyCode {
  const [currency, setCurrency] = useState(getAppCurrency);
  useEffect(() => subscribeCurrency(() => setCurrency(getAppCurrency())), []);
  return currency;
}

export function MoneyRefreshBoundary(props: { children: ReactNode }) {
  useAppCurrency();
  return props.children;
}

export function getCurrencySymbol(currency: CurrencyCode = getAppCurrency()): string {
  return CURRENCY_META[currency]?.symbol ?? currency;
}

export function formatMoney(n: number, currency: CurrencyCode = getAppCurrency()): string {
  const locale = i18n.language === "uk" ? "uk-UA" : i18n.language === "ru" ? "ru-RU" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)} ${getCurrencySymbol(currency)}`;
  }
}

export function moneyFieldLabel(baseLabel: string, currency: CurrencyCode = getAppCurrency()): string {
  const symbol = getCurrencySymbol(currency);
  return `${baseLabel} (${symbol})`;
}
