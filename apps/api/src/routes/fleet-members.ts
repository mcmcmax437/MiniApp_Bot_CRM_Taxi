import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { ownerId, parse, jsonSafe } from "./helpers.js";

export async function fleetMembersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (req, reply) => {
    if (req.isViewer) {
      return reply.code(403).send({ error: "read_only" });
    }
  });

  app.get("/fleet-members", async (req) => {
    const members = await prisma.fleetMember.findMany({
      where: { fleetOwnerId: ownerId(req) },
      orderBy: { createdAt: "desc" },
    });
    return jsonSafe(members);
  });

  app.post("/fleet-members", async (req, reply) => {
    const body = parse(
      z.object({
        telegramUserId: z.string().trim().regex(/^\d+$/),
        name: z.string().trim().max(120).optional(),
      }),
      req.body,
      reply,
    );
    if (!body) return;

    const telegramUserId = BigInt(body.telegramUserId);
    const existingOwner = await prisma.owner.findUnique({ where: { telegramUserId } });
    if (existingOwner?.id === ownerId(req)) {
      return reply.code(400).send({ error: "cannot_add_self" });
    }

    try {
      const member = await prisma.fleetMember.create({
        data: {
          fleetOwnerId: ownerId(req),
          telegramUserId,
          name: body.name ?? null,
          status: "PENDING",
        },
      });
      return jsonSafe(member);
    } catch {
      return reply.code(409).send({ error: "already_invited" });
    }
  });

  app.patch("/fleet-members/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(
      z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]) }),
      req.body,
      reply,
    );
    if (!body) return;

    const member = await prisma.fleetMember.findFirst({
      where: { id, fleetOwnerId: ownerId(req) },
    });
    if (!member) return reply.code(404).send({ error: "not_found" });

    const updated = await prisma.fleetMember.update({
      where: { id },
      data: { status: body.status },
    });
    return jsonSafe(updated);
  });

  app.delete("/fleet-members/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await prisma.fleetMember.findFirst({
      where: { id, fleetOwnerId: ownerId(req) },
    });
    if (!member) return reply.code(404).send({ error: "not_found" });
    await prisma.fleetMember.delete({ where: { id } });
    return { ok: true };
  });
}
