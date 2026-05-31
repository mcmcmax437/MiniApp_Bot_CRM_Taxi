import type { FastifyInstance } from "fastify";
import { authenticate, requireSuperAdmin } from "../auth/plugin.js";
import { prisma } from "../prisma.js";
import { parse } from "./helpers.js";
import { ownerUpdateSchema } from "@taxi/shared";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireSuperAdmin);

  // List all owners (tenants) with quick stats.
  app.get("/admin/owners", async () => {
    const owners = await prisma.owner.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { cars: true, drivers: true } } },
    });
    return owners.map((o) => ({
      id: o.id,
      telegramUserId: o.telegramUserId.toString(),
      name: o.name,
      username: o.username,
      status: o.status,
      locale: o.locale,
      subscriptionExpiresAt: o.subscriptionExpiresAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      cars: o._count.cars,
      drivers: o._count.drivers,
    }));
  });

  app.post("/admin/owners/:id/activate", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { subscriptionExpiresAt?: string | null };
    return prisma.owner.update({
      where: { id },
      data: {
        status: "ACTIVE",
        subscriptionExpiresAt: body.subscriptionExpiresAt
          ? new Date(body.subscriptionExpiresAt)
          : undefined,
      },
    });
  });

  app.post("/admin/owners/:id/suspend", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.owner.update({ where: { id }, data: { status: "SUSPENDED" } });
  });

  app.patch("/admin/owners/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(ownerUpdateSchema, req.body, reply);
    if (!body) return;
    return prisma.owner.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.subscriptionExpiresAt !== undefined
          ? { subscriptionExpiresAt: body.subscriptionExpiresAt ? new Date(body.subscriptionExpiresAt) : null }
          : {}),
      },
    });
  });

  app.get("/admin/ping", async () => ({ ok: true }));
}
