const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiryUrgency = "unknown" | "ok" | "soon" | "warning" | "overdue";

type RGB = [number, number, number];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Days from today until the expiry date (negative = overdue). */
export function daysUntilExpiry(
  isoDate: string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00.000Z` : isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = startOfDay(asOf);
  const target = startOfDay(parsed);
  return Math.floor((target.getTime() - today.getTime()) / DAY_MS);
}

export function expiryUrgency(isoDate: string | null | undefined, asOf?: Date): ExpiryUrgency {
  const days = daysUntilExpiry(isoDate, asOf);
  if (days == null) return "unknown";
  if (days < 0) return "overdue";
  if (days <= 14) return "warning";
  if (days <= 45) return "soon";
  return "ok";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(from: RGB, to: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return [lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k)];
}

function rgb([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Warm sand — just distinct from the muted grey start-date text. */
const FAR: RGB = [196, 178, 118];
const SOON: RGB = [255, 193, 7];
const WARN: RGB = [255, 145, 0];
const DUE: RGB = [255, 82, 82];

/**
 * Text color for a fleet contract end date: sand when far out, then amber →
 * orange → red as the end day approaches.
 */
export function contractEndTextColor(isoDate: string, asOf: Date = new Date()): string {
  const days = daysUntilExpiry(isoDate, asOf);
  if (days == null) return "rgba(255, 255, 255, 0.52)";
  if (days <= 0) return rgb(DUE);
  if (days >= 60) return rgb(FAR);
  if (days >= 21) return rgb(mix(FAR, SOON, (60 - days) / (60 - 21)));
  if (days >= 7) return rgb(mix(SOON, WARN, (21 - days) / (21 - 7)));
  return rgb(mix(WARN, DUE, (7 - days) / 7));
}

