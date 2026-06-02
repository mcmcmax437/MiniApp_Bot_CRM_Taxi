// Lightweight wrapper around the Telegram WebApp global injected by
// telegram-web-app.js. Falls back to dev values when opened in a normal browser.

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; language_code?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  platform: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg: TelegramWebApp | undefined =
  typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

export function initTelegram(): void {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation?.();
    syncDocumentTheme();
  } catch {
    /* noop */
  }
}

/** Match html/body to Telegram theme so edges never show the light fallback. */
function syncDocumentTheme(): void {
  if (!tg) return;
  const secondary = "#08111F";
  const bg = "#08111F";

  document.documentElement.style.colorScheme = "dark";
  document.documentElement.style.backgroundColor = secondary;
  document.body.style.backgroundColor = secondary;

  tg.setHeaderColor?.(bg);
  tg.setBackgroundColor?.(secondary);
}

/** initData string used to authenticate API requests. */
export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getColorScheme(): "light" | "dark" {
  return tg?.colorScheme ?? "light";
}

export function getPlatform(): string {
  return tg?.platform ?? "base";
}

export function getTelegramLocale(): string | undefined {
  return tg?.initDataUnsafe?.user?.language_code;
}

export const isInsideTelegram = Boolean(tg && tg.initData);
