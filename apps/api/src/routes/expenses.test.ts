import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  car: { findFirst: vi.fn() },
  expense: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

import { expensesRoutes } from "./expenses.js";

const ownerId = "ckvowner000000000000000001";
const carId = "ckvcar0000000000000000001";
const expenseId = "ckvexp0000000000000000001";

async function buildApp() {
  const app = Fastify();
  app.addHook("preHandler", (req, _reply, done) => {
    req.owner = { id: ownerId } as typeof req.owner;
    done();
  });
  await app.register(expensesRoutes);
  return app;
}

describe("expensesRoutes car ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects updating an expense to point at a car outside the owner scope", async () => {
    prismaMock.expense.findFirst.mockResolvedValue({ id: expenseId, ownerId });
    prismaMock.car.findFirst.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: `/expenses/${expenseId}`,
      payload: { carId },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_car" });
    expect(prismaMock.car.findFirst).toHaveBeenCalledWith({ where: { id: carId, ownerId } });
    expect(prismaMock.expense.update).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows clearing an expense car association", async () => {
    prismaMock.expense.findFirst.mockResolvedValue({ id: expenseId, ownerId });
    prismaMock.expense.update.mockResolvedValue({ id: expenseId, carId: null });
    const app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: `/expenses/${expenseId}`,
      payload: { carId: null },
    });

    expect(res.statusCode).toBe(200);
    expect(prismaMock.car.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.expense.update).toHaveBeenCalledWith({
      where: { id: expenseId },
      data: { carId: null },
    });
    await app.close();
  });
});
