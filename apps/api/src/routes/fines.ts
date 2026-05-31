import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { fineCreateSchema, fineUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function finesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/fines", async (req) => {
    const { driverId, carId, status } = req.query as {
      driverId?: string;
      carId?: string;
      status?: string;
    };
    return prisma.fine.findMany({
      where: {
        ownerId: ownerId(req),
        ...(driverId ? { driverId } : {}),
        ...(carId ? { carId } : {}),
        ...(status ? { status: status as "UNPAID" | "PAID" } : {}),
      },
      orderBy: { date: "desc" },
      include: {
        driver: { select: { id: true, fullName: true } },
        car: { select: { id: true, plate: true } },
      },
    });
  });

  app.post("/fines", async (req, reply) => {
    const body = parse(fineCreateSchema, req.body, reply);
    if (!body) return;
    const data = toDates(body, ["date"]);
    return prisma.fine.create({ data: { ...data, ownerId: ownerId(req) } });
  });

  app.patch("/fines/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(fineUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.fine.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["date"]);
    return prisma.fine.update({ where: { id }, data });
  });

  app.delete("/fines/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.fine.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.fine.delete({ where: { id } });
    return { ok: true };
  });
}
