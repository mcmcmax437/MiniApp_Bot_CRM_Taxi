import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { expenseCreateSchema, expenseUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function expensesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/expenses", async (req) => {
    const { carId, category, from, to } = req.query as {
      carId?: string;
      category?: string;
      from?: string;
      to?: string;
    };
    return prisma.expense.findMany({
      where: {
        ownerId: ownerId(req),
        ...(carId ? { carId } : {}),
        ...(category ? { category: category as never } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }],
      include: { car: { select: { id: true, plate: true } } },
    });
  });

  app.post("/expenses", async (req, reply) => {
    const body = parse(expenseCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    if (body.carId) {
      const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
      if (!car) return reply.code(400).send({ error: "invalid_car" });
    }
    const data = toDates(body, ["date"]);
    return prisma.expense.create({ data: { ...data, ownerId: oid } });
  });

  app.patch("/expenses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(expenseUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.expense.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["date"]);
    return prisma.expense.update({ where: { id }, data });
  });

  app.delete("/expenses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.expense.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.expense.delete({ where: { id } });
    return { ok: true };
  });
}
