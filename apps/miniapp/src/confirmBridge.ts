export type ConfirmRequest = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (ok: boolean) => void;
};

let pending: ConfirmRequest | null = null;
const listeners = new Set<() => void>();

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingConfirm(): ConfirmRequest | null {
  return pending;
}

export function requestInAppConfirm(
  message: string,
  confirmLabel: string,
  cancelLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { message, confirmLabel, cancelLabel, resolve };
    listeners.forEach((listener) => listener());
  });
}

export function answerConfirm(ok: boolean): void {
  const current = pending;
  pending = null;
  current?.resolve(ok);
  listeners.forEach((listener) => listener());
}
