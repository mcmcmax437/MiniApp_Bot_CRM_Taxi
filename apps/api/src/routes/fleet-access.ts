import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/plugin.js";
import { prisma } from "../prisma.js";
import { parse, jsonSafe } from "./helpers.js";

/** Investor self-registration: request read-only access to a fleet by owner Telegram ID. */
export async function fleetAccessRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.post("/fleet-access/request", async (req, reply) => {
    if (req.isViewer) {
      return reply.code(400).send({ error: "already_viewer" });
    }
    const owner = req.owner;
    if (!owner) return reply.code(401).send({ error: "unauthenticated" });

    const body = parse(
      z.object({ ownerTelegramId: z.string().trim().regex(/^\d+$/) }),
      req.body,
      reply,
    );
    if (!body) return;

    const fleetOwnerId = BigInt(body.ownerTelegramId);
    if (fleetOwnerId === owner.telegramUserId) {
      return reply.code(400).send({ error: "cannot_request_self" });
    }

    const fleet = await prisma.owner.findUnique({ where: { telegramUserId: fleetOwnerId } });
    if (!fleet) return reply.code(404).send({ error: "owner_not_found" });

    try {
      const member = await prisma.fleetMember.create({
        data: {
          fleetOwnerId: fleet.id,
          telegramUserId: owner.telegramUserId,
          name: owner.name,
          username: owner.username,
          status: "PENDING",
        },
      });
      return jsonSafe(member);
    } catch {
      return reply.code(409).send({ error: "already_requested" });
    }
  });
}
