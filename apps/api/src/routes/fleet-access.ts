import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/plugin.js";
import { deriveLocale } from "../auth/telegram.js";
import { prisma } from "../prisma.js";
import { parse, jsonSafe } from "./helpers.js";

function requesterTelegramId(req: Parameters<typeof authenticate>[0]): bigint | null {
  return req.owner?.telegramUserId ?? req.telegramUser?.id ?? null;
}

/** Onboarding: register as a fleet business owner (super-admin approval required). */
export async function fleetAccessRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.post("/auth/register-owner", async (req, reply) => {
    const tgId = requesterTelegramId(req);
    if (!tgId) return reply.code(401).send({ error: "unauthenticated" });

    if (req.isSuperAdmin) {
      return reply.code(400).send({ error: "already_registered" });
    }

    if (req.owner?.status === "ACTIVE") {
      return reply.code(400).send({ error: "already_owner" });
    }

    const existingMember = await prisma.fleetMember.findFirst({
      where: { telegramUserId: tgId },
    });
    if (existingMember) {
      return reply.code(400).send({ error: "already_investor" });
    }

    if (req.owner?.status === "PENDING") {
      return jsonSafe(req.owner);
    }

    const name = req.telegramUser?.name ?? null;
    const username = req.telegramUser?.username ?? null;
    const locale = deriveLocale(req.telegramUser?.languageCode);

    const created = await prisma.owner.create({
      data: {
        telegramUserId: tgId,
        name,
        username,
        locale,
        status: "PENDING",
      },
    });
    return jsonSafe(created);
  });

  /** Investor self-registration: request read-only access to a fleet by owner Telegram ID. */
  app.post("/fleet-access/request", async (req, reply) => {
    if (req.isViewer) {
      return reply.code(400).send({ error: "already_viewer" });
    }

    const tgId = requesterTelegramId(req);
    if (!tgId) return reply.code(401).send({ error: "unauthenticated" });

    if (req.owner?.status === "ACTIVE") {
      return reply.code(400).send({ error: "already_owner" });
    }

    const body = parse(
      z.object({ ownerTelegramId: z.string().trim().regex(/^\d+$/) }),
      req.body,
      reply,
    );
    if (!body) return;

    const fleetOwnerId = BigInt(body.ownerTelegramId);
    if (fleetOwnerId === tgId) {
      return reply.code(400).send({ error: "cannot_request_self" });
    }

    const fleet = await prisma.owner.findUnique({ where: { telegramUserId: fleetOwnerId } });
    if (!fleet) return reply.code(404).send({ error: "owner_not_found" });

    const name = req.owner?.name ?? req.telegramUser?.name ?? null;
    const username = req.owner?.username ?? req.telegramUser?.username ?? null;
    const locale = deriveLocale(req.telegramUser?.languageCode);

    try {
      const member = await prisma.$transaction(async (tx) => {
        const created = await tx.fleetMember.create({
          data: {
            fleetOwnerId: fleet.id,
            telegramUserId: tgId,
            name,
            username,
            locale,
            status: "PENDING",
          },
        });
        if (req.owner?.status === "PENDING") {
          await tx.owner.delete({ where: { id: req.owner.id } });
        }
        return created;
      });
      return jsonSafe(member);
    } catch {
      return reply.code(409).send({ error: "already_requested" });
    }
  });
}
