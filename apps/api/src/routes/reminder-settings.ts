import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { reminderSettingsUpdateSchema } from "@taxi/shared";
import { ensureReminderSettings } from "../services/reminder-settings.js";
import {
  isWeeklyMileageSkipped,
  skipWeeklyMileageReport,
  unskipWeeklyMileageReport,
} from "../services/reminders.js";
import { ownerId, parse } from "./helpers.js";

function serializeReminderSettings(
  row: Awaited<ReturnType<typeof ensureReminderSettings>>,
) {
  const now = new Date();
  return {
    insuranceDaysBefore: row.insuranceDaysBefore,
    inspectionDaysBefore: row.inspectionDaysBefore,
    documentDaysBefore: row.documentDaysBefore,
    inspectionMileageIntervalKm: row.inspectionMileageIntervalKm,
    weeklyMileageEnabled: row.weeklyMileageEnabled,
    weeklyMileageWeekday: row.weeklyMileageWeekday,
    weeklyMileageSkippedWeekStart: row.weeklyMileageSkippedWeekStart?.toISOString() ?? null,
    weeklyMileageSkippedThisWeek: isWeeklyMileageSkipped(row, now),
  };
}

export async function reminderSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reminder-settings", async (req) => {
    const row = await ensureReminderSettings(ownerId(req));
    return serializeReminderSettings(row);
  });

  app.patch("/reminder-settings", async (req, reply) => {
    const body = parse(reminderSettingsUpdateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    await ensureReminderSettings(oid);
    const row = await prisma.ownerReminderSettings.update({
      where: { ownerId: oid },
      data: body,
    });
    return serializeReminderSettings(row);
  });

  app.post("/reminder-settings/skip-weekly-mileage", async (req) => {
    const oid = ownerId(req);
    await skipWeeklyMileageReport(oid);
    const row = await ensureReminderSettings(oid);
    return serializeReminderSettings(row);
  });

  app.post("/reminder-settings/unskip-weekly-mileage", async (req) => {
    const oid = ownerId(req);
    await unskipWeeklyMileageReport(oid);
    const row = await ensureReminderSettings(oid);
    return serializeReminderSettings(row);
  });
}
