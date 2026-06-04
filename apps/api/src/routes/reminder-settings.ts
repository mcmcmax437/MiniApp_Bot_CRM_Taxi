import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { reminderSettingsUpdateSchema } from "@taxi/shared";
import { ensureReminderSettings } from "../services/reminder-settings.js";
import { ownerId, parse } from "./helpers.js";

export async function reminderSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reminder-settings", async (req) => {
    return ensureReminderSettings(ownerId(req));
  });

  app.patch("/reminder-settings", async (req, reply) => {
    const body = parse(reminderSettingsUpdateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    await ensureReminderSettings(oid);
    return prisma.ownerReminderSettings.update({
      where: { ownerId: oid },
      data: body,
    });
  });
}
