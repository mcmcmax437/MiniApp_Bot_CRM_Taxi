import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { driverCreateSchema, driverUpdateSchema } from "@taxi/shared";
import { ownerId, parse } from "./helpers.js";
import { computeDriverBalances } from "../services/balance.js";

export async function driversRoutes(app: FastifyInstance): Promise<void> {
  app.get("/drivers", async (req) => {
    return prisma.driver.findMany({
      where: { ownerId: ownerId(req) },
      orderBy: { fullName: "asc" },
      include: { assignedCar: { select: { id: true, plate: true } } },
    });
  });

  app.get("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const driver = await prisma.driver.findFirst({
      where: { id, ownerId: ownerId(req) },
      include: {
        assignedCar: true,
        agreements: { orderBy: { startDate: "desc" } },
      },
    });
    if (!driver) return reply.code(404).send({ error: "not_found" });
    return driver;
  });

  app.post("/drivers", async (req, reply) => {
    const body = parse(driverCreateSchema, req.body, reply);
    if (!body) return;
    if (body.assignedCarId) {
      const car = await prisma.car.findFirst({
        where: { id: body.assignedCarId, ownerId: ownerId(req) },
      });
      if (!car) return reply.code(400).send({ error: "invalid_car" });
    }
    return prisma.driver.create({ data: { ...body, ownerId: ownerId(req) } });
  });

  app.patch("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(driverUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.driver.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    if (body.assignedCarId) {
      const car = await prisma.car.findFirst({
        where: { id: body.assignedCarId, ownerId: ownerId(req) },
      });
      if (!car) return reply.code(400).send({ error: "invalid_car" });
    }
    return prisma.driver.update({ where: { id }, data: body });
  });

  app.delete("/drivers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.driver.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.driver.delete({ where: { id } });
    return { ok: true };
  });

  // All driver balances ("who owes what").
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
}
