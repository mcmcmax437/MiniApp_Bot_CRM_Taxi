function parseIsoDateParts(iso: string): { y: number; m: number; d: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

/** Display format: DD/MM/YY */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = parseIsoDateParts(iso);
  if (!parts) return "—";
  const yy = String(parts.y % 100).padStart(2, "0");
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${yy}`;
}

/** ISO date-only string for `<input type="date">` and API payloads. */
export function isoDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = parseIsoDateParts(iso);
  if (!parts) return "";
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function dateInputValue(date = new Date()): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function todayInput(): string {
  return dateInputValue();
}
