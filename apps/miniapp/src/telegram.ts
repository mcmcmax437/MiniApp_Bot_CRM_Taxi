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
  } catch {
    /* noop */
  }
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
