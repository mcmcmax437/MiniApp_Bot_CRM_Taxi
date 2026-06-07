// Lightweight wrapper around the Telegram WebApp global injected by
// telegram-web-app.js. Falls back to dev values when opened in a normal browser.

import { requestInAppConfirm } from "./confirmBridge";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; language_code?: string } };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  platform: string;
  viewportHeight?: number;
  viewportStableHeight?: number;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
  showPopup?: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{ id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text: string }>;
    },
    callback?: (buttonId: string) => void,
  ) => void;
}

const DESKTOP_PLATFORMS = new Set(["tdesktop", "macos", "web", "weba", "unigram", "unknown"]);

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
    syncViewportHeight();
    tg.onEvent?.("viewportChanged", syncViewportHeight);
  } catch {
    /* noop */
  }
}

function syncViewportHeight(): void {
  if (!tg) return;
  const height = tg.viewportStableHeight ?? tg.viewportHeight;
  if (height && height > 0) {
    document.documentElement.style.setProperty("--tg-viewport-height", `${height}px`);
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

function prefersInAppConfirm(): boolean {
  const platform = getPlatform().toLowerCase();
  return DESKTOP_PLATFORMS.has(platform) || !tg?.showPopup;
}

/** Works in Telegram WebView where native dialogs are often blocked or never callback on desktop. */
export function confirmAction(message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (prefersInAppConfirm()) {
    return requestInAppConfirm(message, confirmLabel, cancelLabel);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };

    const timer = window.setTimeout(() => {
      requestInAppConfirm(message, confirmLabel, cancelLabel).then(finish);
    }, 350);

    tg!.showPopup!(
      {
        message,
        buttons: [
          { id: "confirm", type: "destructive", text: confirmLabel },
          { id: "cancel", type: "cancel", text: cancelLabel },
        ],
      },
      (buttonId) => finish(buttonId === "confirm"),
    );
  });
}
