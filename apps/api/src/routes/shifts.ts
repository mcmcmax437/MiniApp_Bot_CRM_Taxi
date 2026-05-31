import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { shiftCreateSchema, shiftUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function shiftsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/shifts", async (req) => {
    const { driverId, carId } = req.query as { driverId?: string; carId?: string };
    return prisma.shift.findMany({
      where: {
        ownerId: ownerId(req),
        ...(driverId ? { driverId } : {}),
        ...(carId ? { carId } : {}),
      },
      orderBy: { date: "desc" },
      include: {
        driver: { select: { id: true, fullName: true } },
        car: { select: { id: true, plate: true } },
      },
    });
  });

  app.post("/shifts", async (req, reply) => {
    const body = parse(shiftCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const [car, driver] = await Promise.all([
      prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } }),
      prisma.driver.findFirst({ where: { id: body.driverId, ownerId: oid } }),
    ]);
    if (!car || !driver) return reply.code(400).send({ error: "invalid_car_or_driver" });
    const data = toDates(body, ["date"]);
    return prisma.shift.create({ data: { ...data, ownerId: oid } });
  });

  app.patch("/shifts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(shiftUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.shift.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["date"]);
    return prisma.shift.update({ where: { id }, data });
  });

  app.delete("/shifts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.shift.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.shift.delete({ where: { id } });
    return { ok: true };
  });
}
