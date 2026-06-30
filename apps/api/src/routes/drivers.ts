import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { driverCreateSchema, driverUpdateSchema, driverFullName } from "@taxi/shared";
import { ownerId, parse } from "./helpers.js";
import {
  computeDriverBalances,
  computeDriverBalanceBreakdown,
} from "../services/balance.js";

const driverInclude = {
  agreements: {
    where: { status: "ACTIVE" as const },
    include: { car: { select: { id: true, plate: true } } },
  },
};

function toDriverData(body: Record<string, unknown>): Record<string, unknown> {
  const firstName = body.firstName as string | undefined;
  const lastName = body.lastName as string | undefined;
  if (firstName !== undefined || lastName !== undefined) {
    return {
      ...body,
      fullName: driverFullName({
        firstName: firstName ?? "",
        lastName: lastName ?? "",
      }),
    };
  }
  return body;
}

export async function driversRoutes(app: FastifyInstance): Promise<void> {
  app.get("/drivers", async (req) => {
    return prisma.driver.findMany({
      where: { ownerId: ownerId(req) },
      orderBy: { fullName: "asc" },
      include: driverInclude,
    });
  });

  app.get("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const driver = await prisma.driver.findFirst({
      where: { id, ownerId: ownerId(req) },
      include: {
        agreements: {
          orderBy: { startDate: "desc" },
          include: { car: { select: { id: true, plate: true } } },
        },
      },
    });
    if (!driver) return reply.code(404).send({ error: "not_found" });
    return driver;
  });

  app.post("/drivers", async (req, reply) => {
    const body = parse(driverCreateSchema, req.body, reply);
    if (!body) return;
    return prisma.driver.create({
      data: { ...toDriverData(body), ownerId: ownerId(req) } as never,
    });
  });

  app.patch("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(driverUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.driver.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const merged = {
      firstName: body.firstName ?? existing.firstName,
      lastName: body.lastName ?? existing.lastName,
      ...body,
    };
    return prisma.driver.update({
      where: { id },
      data: toDriverData(merged) as never,
    });
  });

  app.delete("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.driver.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.driver.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/balances", async (req) => {
    return computeDriverBalances(ownerId(req));
  });

  app.get("/drivers/:id/balance", async (req, reply) => {
    const { id } = req.params as { id: string };
    const balances = await computeDriverBalances(ownerId(req));
    const found = balances.find((b) => b.driverId === id);
    if (!found) return reply.code(404).send({ error: "not_found" });
    return found;
  });

  // Detailed breakdown for the Driver Balance Breakdown modal. The
  // server is the single source of truth for the figure shown on the
  // drivers list (`/balances`) and the figures shown in the modal — if
  // we recomputed on the client, a stale cached `agreements`/`payments`
  // query could disagree with `/balances` (the modal opened and the
  // driver card could briefly show different numbers for the same
  // driver). Computing on the server avoids the divergence.
  app.get("/drivers/:id/balance/breakdown", async (req, reply) => {
    const { id } = req.params as { id: string };
    const breakdown = await computeDriverBalanceBreakdown(ownerId(req), id);
    if (!breakdown) return reply.code(404).send({ error: "not_found" });
    return breakdown;
  });
}
