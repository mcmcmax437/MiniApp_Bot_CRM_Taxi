import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { carCreateSchema, carUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function carsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cars", async (req) => {
    return prisma.car.findMany({
      where: { ownerId: ownerId(req) },
      orderBy: { createdAt: "desc" },
      include: {
        agreements: {
          where: { status: "ACTIVE" },
          include: { driver: { select: { id: true, fullName: true } } },
        },
      },
    });
  });

  app.get("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const car = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!car) return reply.code(404).send({ error: "not_found" });
    return car;
  });

  app.post("/cars", async (req, reply) => {
    const body = parse(carCreateSchema, req.body, reply);
    if (!body) return;
    const data = toDates(body, ["insuranceExpiry", "inspectionExpiry"]);
    return prisma.car.create({ data: { ...data, ownerId: ownerId(req) } });
  });

  app.patch("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(carUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["insuranceExpiry", "inspectionExpiry"]);
    return prisma.car.update({ where: { id }, data });
  });

  app.delete("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.car.delete({ where: { id } });
    return { ok: true };
  });
}
