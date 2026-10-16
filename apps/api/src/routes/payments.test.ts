import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  driver: { findFirst: vi.fn() },
  car: { findFirst: vi.fn() },
  payment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

import { paymentsRoutes } from "./payments.js";

const ownerId = "ckvowner000000000000000001";
const carId = "ckvcar0000000000000000001";
const paymentId = "ckvpay0000000000000000001";

async function buildApp() {
  const app = Fastify();
  app.addHook("preHandler", (req, _reply, done) => {
    req.owner = { id: ownerId } as typeof req.owner;
    done();
  });
  await app.register(paymentsRoutes);
  return app;
}

describe("paymentsRoutes car ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creating a payment for a car outside the owner scope", async () => {
    prismaMock.driver.findFirst.mockResolvedValue(null);
    prismaMock.car.findFirst.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/payments",
      payload: {
        carId,
        amount: 100,
        date: "2026-08-03",
        method: "BANK",
        type: "RENT",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_car" });
    expect(prismaMock.car.findFirst).toHaveBeenCalledWith({ where: { id: carId, ownerId } });
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects updating a payment to point at a car outside the owner scope", async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: paymentId, ownerId, method: "BANK" });
    prismaMock.car.findFirst.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({
      method: "PATCH",
      url: `/payments/${paymentId}`,
      payload: { carId },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_car" });
    expect(prismaMock.car.findFirst).toHaveBeenCalledWith({ where: { id: carId, ownerId } });
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    await app.close();
  });

  it("still forces cash payments to bank NONE after the car check passes", async () => {
    prismaMock.driver.findFirst.mockResolvedValue(null);
    prismaMock.car.findFirst.mockResolvedValue({ id: carId, ownerId });
    prismaMock.payment.create.mockResolvedValue({ id: paymentId });
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/payments",
      payload: {
        carId,
        amount: 100,
        date: "2026-08-03",
        method: "CASH",
        bank: "PKO",
        type: "RENT",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        carId,
        method: "CASH",
        bank: "NONE",
      }),
    });
    await app.close();
  });
});
