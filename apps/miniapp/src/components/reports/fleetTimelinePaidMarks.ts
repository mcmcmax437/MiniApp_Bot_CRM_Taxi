export type PaidMarks = Record<string, true>;

export type PaidMarksStorage = Pick<Storage, "getItem" | "setItem">;

export const PAID_MARKS_STORAGE_KEY = "reports-fleet-timeline-paid";

export function paidMarkId(from: string, to: string, agreementId: string): string {
  return `${from}|${to}|${agreementId}`;
}

export function parsePaidMarks(raw: string | null): PaidMarks {
  try {
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PaidMarks = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value) out[key] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadPaidMarks(storage: Pick<PaidMarksStorage, "getItem">): PaidMarks {
  try {
    return parsePaidMarks(storage.getItem(PAID_MARKS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function savePaidMarks(storage: Pick<PaidMarksStorage, "setItem">, marks: PaidMarks): void {
  storage.setItem(PAID_MARKS_STORAGE_KEY, JSON.stringify(marks));
}

export function togglePaidMark(marks: PaidMarks, id: string): PaidMarks {
  const next = { ...marks };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
}
