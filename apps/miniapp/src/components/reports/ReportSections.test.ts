import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readReportSectionOpen,
  reportSectionStorageKey,
  writeReportSectionOpen,
} from "./ReportSections.tsx";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  get(key: string): string | undefined {
    return this.values.get(key);
  }
}

test("reportSectionStorageKey namespaces persisted collapse state", () => {
  assert.equal(reportSectionStorageKey("reports-summary"), "crm-report-section-reports-summary");
});

test("readReportSectionOpen restores saved open and collapsed states", () => {
  const storage = new MemoryStorage();

  storage.setItem(reportSectionStorageKey("reports-summary"), "1");
  storage.setItem(reportSectionStorageKey("reports-by-car"), "0");

  assert.equal(readReportSectionOpen("reports-summary", false, storage), true);
  assert.equal(readReportSectionOpen("reports-by-car", true, storage), false);
});

test("readReportSectionOpen falls back to the requested default when storage is empty", () => {
  const storage = new MemoryStorage();

  assert.equal(readReportSectionOpen("reports-summary", true, storage), true);
  assert.equal(readReportSectionOpen("reports-summary", false, storage), false);
});

test("readReportSectionOpen treats unknown persisted values as collapsed", () => {
  const storage = new MemoryStorage();

  storage.setItem(reportSectionStorageKey("reports-summary"), "unexpected");

  assert.equal(readReportSectionOpen("reports-summary", true, storage), false);
});

test("readReportSectionOpen falls back to the default when storage reads fail", () => {
  const storage: Pick<Storage, "getItem"> = {
    getItem() {
      throw new Error("storage unavailable");
    },
  };

  assert.equal(readReportSectionOpen("reports-summary", true, storage), true);
  assert.equal(readReportSectionOpen("reports-summary", false, storage), false);
});

test("writeReportSectionOpen stores the same values consumed by the reader", () => {
  const storage = new MemoryStorage();

  writeReportSectionOpen("reports-summary", true, storage);
  assert.equal(storage.get(reportSectionStorageKey("reports-summary")), "1");
  assert.equal(readReportSectionOpen("reports-summary", false, storage), true);

  writeReportSectionOpen("reports-summary", false, storage);
  assert.equal(storage.get(reportSectionStorageKey("reports-summary")), "0");
  assert.equal(readReportSectionOpen("reports-summary", true, storage), false);
});

test("writeReportSectionOpen ignores storage write failures", () => {
  const storage: Pick<Storage, "setItem"> = {
    setItem() {
      throw new Error("quota exceeded");
    },
  };

  assert.doesNotThrow(() => writeReportSectionOpen("reports-summary", false, storage));
});
