import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../prisma.js";
import { expenseCreateSchema, expenseUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { repairStalePurchaseExpenses } from "../services/purchase-expenses.js";
import {
  carIdsFromExpenseBody,
  expenseCarInclude,
  presentExpense,
  replaceExpenseCarLinks,
} from "../services/expense-cars.js";

async function assertOwnerCars(
  oid: string,
  carIds: string[],
  reply: FastifyReply,
): Promise<boolean> {
  if (carIds.length === 0) return true;
  const found = await prisma.car.findMany({
    where: { ownerId: oid, id: { in: carIds } },
    select: { id: true },
  });
  if (found.length !== carIds.length) {
    reply.code(400).send({ error: "invalid_car" });
    return false;
  }
  return true;
}

export async function expensesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/expenses", async (req) => {
    const oid = ownerId(req);
    try {
      await repairStalePurchaseExpenses(oid);
    } catch (err) {
      req.log.warn({ err }, "failed to repair stale purchase expenses");
    }
    const { carId, category, from, to } = req.query as {
      carId?: string;
      category?: string;
      from?: string;
      to?: string;
    };
    const rows = await prisma.expense.findMany({
      where: {
        ownerId: oid,
        ...(carId
          ? { OR: [{ carId }, { carLinks: { some: { carId } } }] }
          : {}),
        ...(category ? { category: category as never } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }],
      include: expenseCarInclude,
    });
    return rows.map(presentExpense);
  });

  app.post("/expenses", async (req, reply) => {
    const body = parse(expenseCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const carIds = carIdsFromExpenseBody(body, true) ?? [];
    if (!(await assertOwnerCars(oid, carIds, reply))) return;
    const { carIds: _carIds, ...rest } = body;
    const data = toDates(rest, ["date"]);
    const created = await prisma.expense.create({
      data: { ...data, carId: carIds[0] ?? null, ownerId: oid },
    });
    await replaceExpenseCarLinks(prisma, created.id, carIds);
    const row = await prisma.expense.findUniqueOrThrow({
      where: { id: created.id },
      include: expenseCarInclude,
    });
    return presentExpense(row);
  });

  app.patch("/expenses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(expenseUpdateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const existing = await prisma.expense.findFirst({ where: { id, ownerId: oid } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const carIds = carIdsFromExpenseBody(body, false);
    if (carIds && !(await assertOwnerCars(oid, carIds, reply))) return;
    const { carIds: _carIds, ...rest } = body;
    const data = toDates(rest, ["date"]);
    if (carIds) data.carId = carIds[0] ?? null;
    await prisma.expense.update({ where: { id }, data });
    if (carIds) await replaceExpenseCarLinks(prisma, id, carIds);
    const row = await prisma.expense.findUniqueOrThrow({
      where: { id },
      include: expenseCarInclude,
    });
    return presentExpense(row);
  });

  app.delete("/expenses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.expense.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.expense.delete({ where: { id } });
    return { ok: true };
  });
}
