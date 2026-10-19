/** Previous Monday–Sunday in Europe/Warsaw, as the tracker portal expects it. */
export function previousWeekRange(now = new Date()): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  const thisMonday = addDays(year, month, day, -sinceMonday);
  const prevMonday = addDays(thisMonday.y, thisMonday.m, thisMonday.d, -7);
  return {
    start: ymd(prevMonday),
    end: ymd(thisMonday),
  };
}

function addDays(year: number, month: number, day: number, delta: number): { y: number; m: number; d: number } {
  const date = new Date(Date.UTC(year, month - 1, day + delta, 12));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function ymd(parts: { y: number; m: number; d: number }): string {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}
