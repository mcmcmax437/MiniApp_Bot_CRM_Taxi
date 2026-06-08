import { useEffect, useState, type ReactNode } from "react";
import i18n from "./i18n";
import type { Currency as CurrencyCode } from "@taxi/shared";
import { Currency as CurrencyEnum } from "@taxi/shared";

type SymbolPosition = "prefix" | "suffix";

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; nameKey: string; position: SymbolPosition }
> = {
  UAH: { symbol: "₴", nameKey: "currency.UAH", position: "suffix" },
  USD: { symbol: "$", nameKey: "currency.USD", position: "prefix" },
  EUR: { symbol: "€", nameKey: "currency.EUR", position: "prefix" },
  PLN: { symbol: "zł", nameKey: "currency.PLN", position: "suffix" },
  GBP: { symbol: "£", nameKey: "currency.GBP", position: "prefix" },
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

function numberLocale(): string {
  return i18n.language === "uk" ? "uk-UA" : i18n.language === "ru" ? "ru-RU" : "en-US";
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

/** Compact amount with symbol only — no ISO codes (UAH, PLN, etc.) in the UI. */
export function formatMoney(n: number, currency: CurrencyCode = getAppCurrency()): string {
  const meta = CURRENCY_META[currency];
  const symbol = meta?.symbol ?? currency;
  const amount = new Intl.NumberFormat(numberLocale(), {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);

  if (meta?.position === "prefix") {
    return `${symbol}${amount}`;
  }
  return `${amount} ${symbol}`;
}
