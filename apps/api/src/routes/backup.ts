import type { FastifyInstance } from "fastify";
import { deliverOwnerBackup } from "../services/fleet-backup.js";

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  app.post("/backup", async (req, reply) => {
    const owner = req.owner;
    if (!owner) return reply.code(401).send({ error: "unauthenticated" });
    try {
      await deliverOwnerBackup({
        id: owner.id,
        telegramUserId: owner.telegramUserId,
        locale: owner.locale,
      });
      return { ok: true };
    } catch (err) {
      req.log.error({ err }, "manual fleet backup failed");
      return reply.code(502).send({ error: "backup_failed" });
    }
  });
}
