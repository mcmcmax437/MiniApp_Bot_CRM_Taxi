import { randomBytes } from "node:crypto";
import type { LedgerIntent } from "./intent.js";

export type PendingLedger = {
  telegramUserId: string;
  ownerId: string;
  intent: Exclude<LedgerIntent, { kind: "unknown" }>;
  date: string;
  carIds: string[];
  expiresAt: number;
};

const pending = new Map<string, PendingLedger>();
const TTL_MS = 15 * 60 * 1000;

function purge(): void {
  const now = Date.now();
  for (const [token, row] of pending) {
    if (row.expiresAt <= now) pending.delete(token);
  }
}

export function rememberPending(row: Omit<PendingLedger, "expiresAt">): string {
  purge();
  const token = randomBytes(6).toString("hex");
  pending.set(token, { ...row, expiresAt: Date.now() + TTL_MS });
  return token;
}

/** Remove the choice so a second tap cannot create a duplicate. */
export function takePending(token: string, telegramUserId: string): PendingLedger | null {
  purge();
  const row = pending.get(token);
  if (!row || row.telegramUserId !== telegramUserId) return null;
  pending.delete(token);
  return row;
}

export function restorePending(token: string, row: PendingLedger): void {
  pending.set(token, row);
}
