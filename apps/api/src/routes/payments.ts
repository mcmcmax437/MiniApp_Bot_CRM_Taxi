import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { paymentCreateSchema, paymentUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { restoreMisfiledSalePayments, syncSoldCarFromSalePayments } from "../services/car-sale.js";

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/payments", async (req) => {
    const { driverId, carId, from, to } = req.query as {
      driverId?: string;
      carId?: string;
      from?: string;
      to?: string;
    };
    try {
      await restoreMisfiledSalePayments(ownerId(req));
    } catch (err) {
      req.log.warn({ err }, "failed to restore sale payments");
    }
    return prisma.payment.findMany({
      where: {
        ownerId: ownerId(req),
        ...(driverId ? { driverId } : {}),
        ...(carId ? { carId } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }],
      include: {
        driver: { select: { id: true, fullName: true } },
        car: { select: { id: true, plate: true } },
      },
    });
  });

  app.post("/payments", async (req, reply) => {
    const body = parse(paymentCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    if (body.driverId) {
      const driver = await prisma.driver.findFirst({ where: { id: body.driverId, ownerId: oid } });
      if (!driver) return reply.code(400).send({ error: "invalid_driver" });
    }
    const data = toDates(body, ["date"]);
    if (data.method === "CASH") data.bank = "NONE";
    return prisma.payment.create({ data: { ...data, ownerId: oid } });
  });

  app.patch("/payments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(paymentUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.payment.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    if (body.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: body.driverId, ownerId: ownerId(req) },
      });
      if (!driver) return reply.code(400).send({ error: "invalid_driver" });
    }
    const data = toDates(body, ["date"]);
    const nextMethod = data.method ?? existing.method;
    if (nextMethod === "CASH") data.bank = "NONE";
    // A sale payment stays a sale on its sold car. Editing the amount or date
    // from Finance must not turn it into rent, or the archive loses the lines
    // while the stored sale price no longer matches.
    if (existing.type === "SALE") {
      data.type = "SALE";
      data.carId = existing.carId;
      data.discountAmount = 0;
    }
    const updated = await prisma.payment.update({ where: { id }, data });
    if (existing.type === "SALE" || updated.type === "SALE") {
      await syncSoldCarFromSalePayments(ownerId(req), existing.carId);
      if (updated.carId && updated.carId !== existing.carId) {
        await syncSoldCarFromSalePayments(ownerId(req), updated.carId);
      }
    }
    return updated;
  });

  app.delete("/payments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.payment.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.payment.delete({ where: { id } });
    if (existing.type === "SALE") {
      await syncSoldCarFromSalePayments(ownerId(req), existing.carId);
    }
    return { ok: true };
  });
}
