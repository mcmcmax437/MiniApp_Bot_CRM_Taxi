/** Tracker timestamps arrive as `YYYY-MM-DD HH:mm:ss`. Show the date as `DD:MM:YYYY`. */
export function formatTrackerFixTime(raw: string | null | undefined): string {
  const text = raw?.trim() ?? "";
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (!match) return text;
  const date = `${match[3]}:${match[2]}:${match[1]}`;
  return match[4] ? `${date} ${match[4]}` : date;
}
