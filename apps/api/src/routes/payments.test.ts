import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentBank, PaymentMethod, PaymentType } from "@taxi/shared";

const prismaMock = vi.hoisted(() => ({
  driver: {
    findFirst: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../prisma.js", () => ({
  prisma: prismaMock,
}));

import { paymentsRoutes } from "./payments.js";

const ownerId = "owner-1";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook("preHandler", async (req) => {
    req.owner = { id: ownerId } as typeof req.owner;
  });
  await app.register(paymentsRoutes);
  return app;
}

describe("paymentsRoutes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forces cash payments to store bank NONE on create", async () => {
    const app = await buildApp();
    prismaMock.payment.create.mockImplementation(async ({ data }) => ({ id: "payment-1", ...data }));

    const response = await app.inject({
      method: "POST",
      url: "/payments",
      payload: {
        amount: 150,
        date: "2026-08-03",
        method: PaymentMethod.CASH,
        bank: PaymentBank.PKO,
        type: PaymentType.RENT,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        method: PaymentMethod.CASH,
        bank: PaymentBank.NONE,
      }),
    });

    await app.close();
  });

  it("preserves selected bank account for bank-transfer payments on create", async () => {
    const app = await buildApp();
    prismaMock.payment.create.mockImplementation(async ({ data }) => ({ id: "payment-1", ...data }));

    const response = await app.inject({
      method: "POST",
      url: "/payments",
      payload: {
        amount: 275,
        date: "2026-08-03",
        method: PaymentMethod.BANK,
        bank: PaymentBank.CA,
        type: PaymentType.RENT,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        method: PaymentMethod.BANK,
        bank: PaymentBank.CA,
      }),
    });

    await app.close();
  });

  it("forces existing cash payments back to bank NONE when patched without method", async () => {
    const app = await buildApp();
    prismaMock.payment.findFirst.mockResolvedValue({
      id: "payment-1",
      ownerId,
      method: PaymentMethod.CASH,
    });
    prismaMock.payment.update.mockImplementation(async ({ data }) => ({ id: "payment-1", ...data }));

    const response = await app.inject({
      method: "PATCH",
      url: "/payments/payment-1",
      payload: {
        bank: PaymentBank.PKO,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith({
      where: { id: "payment-1", ownerId },
    });
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        bank: PaymentBank.NONE,
      }),
    });

    await app.close();
  });
});
