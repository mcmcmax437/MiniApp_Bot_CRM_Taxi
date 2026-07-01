type ReportSectionReadableStorage = Pick<Storage, "getItem">;
type ReportSectionWritableStorage = Pick<Storage, "setItem">;

export function reportSectionStorageKey(storageKey: string): string {
  return `crm-report-section-${storageKey}`;
}

export function readReportSectionOpen(
  storageKey: string,
  defaultOpen = true,
  storage?: ReportSectionReadableStorage,
): boolean {
  try {
    const saved = (storage ?? localStorage).getItem(reportSectionStorageKey(storageKey));
    if (saved !== null) return saved === "1";
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

export function writeReportSectionOpen(
  storageKey: string,
  open: boolean,
  storage?: ReportSectionWritableStorage,
): void {
  try {
    (storage ?? localStorage).setItem(reportSectionStorageKey(storageKey), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
