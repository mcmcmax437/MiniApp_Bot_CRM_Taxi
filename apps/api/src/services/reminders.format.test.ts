import { describe, expect, it } from "vitest";
import type { ReminderItem } from "@taxi/shared";
import {
  formatDailyReminderMessages,
  formatDisplayDate,
  formatDueDatesMessage,
  formatDueReminderBlock,
  formatMileageReminderLine,
  formatMileageReminderMessage,
  formatReminderTiming,
  splitCarLabel,
} from "./reminders.js";

function item(partial: Partial<ReminderItem> & Pick<ReminderItem, "kind" | "refId" | "label">): ReminderItem {
  return {
    dueDate: null,
    ...partial,
  };
}

describe("splitCarLabel", () => {
  it("splits plate and vehicle", () => {
    expect(splitCarLabel("OP8645U (Toyota Corolla)")).toEqual({
      plate: "OP8645U",
      vehicle: "Toyota Corolla",
    });
  });

  it("keeps plain plates intact", () => {
    expect(splitCarLabel("OP8645U")).toEqual({ plate: "OP8645U", vehicle: null });
  });
});

describe("formatDisplayDate / formatReminderTiming", () => {
  it("formats a readable UTC date", () => {
    expect(formatDisplayDate("2026-09-27T00:00:00.000Z")).toBe("27 Sep 2026");
  });

  it("labels urgency clearly", () => {
    expect(formatReminderTiming(item({ kind: "INSURANCE", refId: "1", label: "A", daysUntil: -2 }))).toBe(
      "⚠ 2d overdue",
    );
    expect(formatReminderTiming(item({ kind: "INSURANCE", refId: "1", label: "A", daysUntil: 0 }))).toBe(
      "⚠ due today",
    );
    expect(formatReminderTiming(item({ kind: "INSURANCE", refId: "1", label: "A", daysUntil: 2 }))).toBe(
      "⏰ 2d left",
    );
    expect(formatReminderTiming(item({ kind: "INSURANCE", refId: "1", label: "A", daysUntil: 19 }))).toBe(
      "19d left",
    );
  });
});

describe("formatDueReminderBlock / formatMileageReminderLine", () => {
  it("formats a due-date vehicle block", () => {
    expect(
      formatDueReminderBlock(
        item({
          kind: "INSURANCE",
          refId: "c1",
          label: "OP8645U (Toyota Corolla)",
          dueDate: "2026-10-06T00:00:00.000Z",
          daysUntil: 19,
        }),
      ),
    ).toBe("<b>OP8645U</b> · Toyota Corolla\n   6 Oct 2026 · 19d left");
  });

  it("formats a mileage plate line", () => {
    expect(
      formatMileageReminderLine(
        item({
          kind: "MILEAGE_REPORT",
          refId: "c2",
          label: "PY5132F (Toyota Auris)",
          detail: "weekly",
        }),
      ),
    ).toBe("• <b>PY5132F</b> · Toyota Auris");
  });
});

describe("formatDailyReminderMessages", () => {
  const sample = [
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
  ];

  it("returns no messages when empty", () => {
    expect(formatDailyReminderMessages([])).toEqual([]);
  });

  it("omits outstanding balances entirely", () => {
    expect(
      formatDailyReminderMessages([
        item({
          kind: "OVERDUE_PAYMENT",
          refId: "d1",
          label: "Horobets — AA1111",
          amount: 92.86,
        }),
      ]),
    ).toEqual([]);
  });

  it("sends due dates only — mileage is the weekly job", () => {
    const messages = formatDailyReminderMessages(sample);
    expect(messages).toHaveLength(1);

    expect(messages[0]).toBe(
      [
        "📅 <b>Fleet due dates</b>",
        "<i>Insurance · inspection · documents</i>",
        "",
        "🔧 <b>Inspection</b> · 1",
        "<b>OP8645U</b> · Toyota Corolla",
        "   27 Sep 2026 · 10d left",
        "",
        "🛡️ <b>Insurance</b> · 1",
        "<b>OP8645U</b> · Toyota Corolla",
        "   6 Oct 2026 · 19d left",
      ].join("\n"),
    );

    expect(messages.join("\n")).not.toContain("Weekly mileage report");
    expect(messages.join("\n")).not.toContain("Mileage check-in");
    expect(messages.join("\n")).not.toContain("Outstanding balance");
    expect(messages.join("\n")).not.toContain("92.86");
  });

  it("can send only a due-dates message", () => {
    const text = formatDueDatesMessage([
      item({
        kind: "INSURANCE",
        refId: "c1",
        label: "OP8645U (Toyota Corolla)",
        dueDate: "2026-10-06T00:00:00.000Z",
        daysUntil: 19,
      }),
    ]);
    expect(text).toContain("Fleet due dates");
    expect(text).not.toContain("Mileage");
  });

  it("can send only a mileage message", () => {
    const text = formatMileageReminderMessage([
      item({
        kind: "MILEAGE_REPORT",
        refId: "c2",
        label: "PY5132F (Toyota Auris)",
        detail: "weekly",
      }),
    ]);
    expect(text).toContain("Weekly mileage report");
    expect(text).toContain("One vehicle still needs an odometer update this week:");
    expect(text).not.toContain("Fleet due dates");
  });

  it("does not send mileage from the daily digest", () => {
    expect(
      formatDailyReminderMessages([
        item({
          kind: "MILEAGE_REPORT",
          refId: "c2",
          label: "PY5132F (Toyota Auris)",
          detail: "weekly",
        }),
      ]),
    ).toEqual([]);
  });
});
