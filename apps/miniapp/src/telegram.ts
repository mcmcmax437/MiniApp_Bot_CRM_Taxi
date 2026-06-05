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
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  showPopup?: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{ id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text: string }>;
    },
    callback?: (buttonId: string) => void,
  ) => void;
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
    syncSafeAreaInsets();
  } catch {
    /* noop */
  }
}

function syncSafeAreaInsets(): void {
  if (!tg) return;
  const content = tg.contentSafeAreaInset ?? tg.safeAreaInset;
  const top = Math.max(content?.top ?? 0, 0);
  const bottom = Math.max(content?.bottom ?? 0, 0);
  document.documentElement.style.setProperty("--tg-safe-top", `${top}px`);
  document.documentElement.style.setProperty("--tg-safe-bottom", `${bottom}px`);
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

/** Works in Telegram WebView where `window.confirm` is often blocked. */
export function confirmAction(message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (tg?.showPopup) {
    return new Promise((resolve) => {
      tg.showPopup!(
        {
          message,
          buttons: [
            { id: "confirm", type: "destructive", text: confirmLabel },
            { id: "cancel", type: "cancel", text: cancelLabel },
          ],
        },
        (buttonId) => resolve(buttonId === "confirm"),
      );
    });
  }
  return Promise.resolve(window.confirm(message));
}
