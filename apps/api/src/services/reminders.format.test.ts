import { describe, expect, it } from "vitest";
import type { ReminderItem } from "@taxi/shared";
import {
  formatDailyReminderMessage,
  formatTelegramReminderBullet,
} from "./reminders.js";

function item(partial: Partial<ReminderItem> & Pick<ReminderItem, "kind" | "refId" | "label">): ReminderItem {
  return {
    dueDate: null,
    ...partial,
  };
}

describe("formatTelegramReminderBullet", () => {
  it("formats date reminders with date and days left", () => {
    expect(
      formatTelegramReminderBullet(
        item({
          kind: "INSURANCE",
          refId: "c1",
          label: "OP8645U (Toyota Corolla)",
          dueDate: "2026-10-06T00:00:00.000Z",
          daysUntil: 19,
        }),
      ),
    ).toBe("• <b>OP8645U (Toyota Corolla)</b> — 2026-10-06 · 19d");
  });

  it("formats mileage as a simple plate line", () => {
    expect(
      formatTelegramReminderBullet(
        item({
          kind: "MILEAGE_REPORT",
          refId: "c2",
          label: "PY5132F (Toyota Auris)",
          detail: "weekly",
        }),
      ),
    ).toBe("• <b>PY5132F (Toyota Auris)</b>");
  });
});

describe("formatDailyReminderMessage", () => {
  it("returns null when there is nothing to send", () => {
    expect(formatDailyReminderMessage([])).toBeNull();
  });

  it("omits outstanding balances from the Telegram digest", () => {
    const text = formatDailyReminderMessage([
      item({
        kind: "OVERDUE_PAYMENT",
        refId: "d1",
        label: "Horobets — AA1111",
        amount: 92.86,
      }),
    ]);
    expect(text).toBeNull();
  });

  it("groups reminders by section and skips outstanding balances", () => {
    const text = formatDailyReminderMessage([
      item({
        kind: "INSPECTION",
        refId: "c1",
        label: "OP8645U (Toyota Corolla)",
        dueDate: "2026-09-27T00:00:00.000Z",
        daysUntil: 10,
      }),
      item({
        kind: "INSURANCE",
        refId: "c1",
        label: "OP8645U (Toyota Corolla)",
        dueDate: "2026-10-06T00:00:00.000Z",
        daysUntil: 19,
      }),
      item({
        kind: "MILEAGE_REPORT",
        refId: "c2",
        label: "PY5132F (Toyota Auris)",
        detail: "weekly",
      }),
      item({
        kind: "MILEAGE_REPORT",
        refId: "c3",
        label: "BE8531CE (Toyota Corolla)",
        detail: "weekly",
      }),
      item({
        kind: "OVERDUE_PAYMENT",
        refId: "d1",
        label: "Horobets — AA1111",
        amount: 92.86,
      }),
    ]);

    expect(text).toBe(
      [
        "<b>Daily reminders</b>",
        "",
        "<b>🔧 Inspection</b>",
        "• <b>OP8645U (Toyota Corolla)</b> — 2026-09-27 · 10d",
        "",
        "<b>🛡️ Insurance</b>",
        "• <b>OP8645U (Toyota Corolla)</b> — 2026-10-06 · 19d",
        "",
        "<b>📊 Mileage update needed</b>",
        "• <b>PY5132F (Toyota Auris)</b>",
        "• <b>BE8531CE (Toyota Corolla)</b>",
      ].join("\n"),
    );
    expect(text).not.toContain("Outstanding balance");
    expect(text).not.toContain("92.86");
  });

  it("returns null when only outstanding balances exist", () => {
    expect(
      formatDailyReminderMessage([
        item({
          kind: "OVERDUE_PAYMENT",
          refId: "d1",
          label: "Driver A",
          amount: 10,
        }),
        item({
          kind: "OVERDUE_PAYMENT",
          refId: "d2",
          label: "Driver B",
          amount: 20,
        }),
      ]),
    ).toBeNull();
  });
});
