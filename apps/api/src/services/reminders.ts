import { prisma } from "../prisma.js";
import { env } from "../env.js";
import type { ReminderItem } from "@taxi/shared";
import { computeDriverBalances } from "./balance.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function carLabel(c: { plate: string; make: string | null; model: string | null }): string {
  const m = [c.make, c.model].filter(Boolean).join(" ");
  return m ? `${c.plate} (${m})` : c.plate;
}

/** Build the reminder list for a single owner. */
export async function buildReminders(
  ownerId: string,
  daysBefore = env.reminderDaysBefore,
): Promise<ReminderItem[]> {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysBefore * DAY_MS);
  const items: ReminderItem[] = [];

  const cars = await prisma.car.findMany({
    where: {
      ownerId,
      OR: [
        { insuranceExpiry: { lte: threshold } },
        { inspectionExpiry: { lte: threshold } },
      ],
    },
  });

  for (const c of cars) {
    if (c.insuranceExpiry && c.insuranceExpiry.getTime() <= threshold.getTime()) {
      items.push({
        kind: "INSURANCE",
        refId: c.id,
        label: carLabel(c),
        dueDate: c.insuranceExpiry.toISOString(),
      });
    }
    if (c.inspectionExpiry && c.inspectionExpiry.getTime() <= threshold.getTime()) {
      items.push({
        kind: "INSPECTION",
        refId: c.id,
        label: carLabel(c),
        dueDate: c.inspectionExpiry.toISOString(),
      });
    }
  }

  const balances = await computeDriverBalances(ownerId);
  for (const b of balances) {
    if (b.balance > 0) {
      items.push({
        kind: "OVERDUE_PAYMENT",
        refId: b.driverId,
        label: b.driverName,
        dueDate: null,
        amount: b.balance,
      });
    }
  }

  items.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });

  return items;
}

function formatReminderLine(item: ReminderItem): string {
  const date = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : "";
  switch (item.kind) {
    case "INSURANCE":
      return `🛡️ Insurance expiring: <b>${item.label}</b> — ${date}`;
    case "INSPECTION":
      return `🔧 Inspection expiring: <b>${item.label}</b> — ${date}`;
    case "OVERDUE_PAYMENT":
      return `💸 Outstanding balance: <b>${item.label}</b> — ${item.amount?.toFixed(2)}`;
    default:
      return item.label;
  }
}

/** Build reminders for every active owner and push them a Telegram summary. */
export async function runReminderJob(
  sendMessage: (chatId: bigint, text: string) => Promise<void>,
  log: (msg: string, meta?: unknown) => void = () => {},
): Promise<void> {
  const owners = await prisma.owner.findMany({ where: { status: "ACTIVE" } });
  for (const owner of owners) {
    try {
      const items = await buildReminders(owner.id);
      if (items.length === 0) continue;
      const lines = items.slice(0, 30).map(formatReminderLine);
      const text = [`<b>Daily reminders</b>`, "", ...lines].join("\n");
      await sendMessage(owner.telegramUserId, text);
      log(`Sent ${items.length} reminders to owner ${owner.id}`);
    } catch (err) {
      log(`Failed to send reminders to owner ${owner.id}`, err);
    }
  }
}
