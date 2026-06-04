import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { agreementCreateSchema, agreementUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function agreementsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agreements", async (req) => {
    const { driverId, carId, status } = req.query as {
      driverId?: string;
      carId?: string;
      status?: string;
    };
    return prisma.rentalAgreement.findMany({
      where: {
        ownerId: ownerId(req),
        ...(driverId ? { driverId } : {}),
        ...(carId ? { carId } : {}),
        ...(status ? { status: status as "ACTIVE" | "ENDED" } : {}),
      },
      orderBy: { startDate: "desc" },
      include: {
        car: { select: { id: true, plate: true } },
        driver: { select: { id: true, fullName: true, firstName: true, lastName: true } },
      },
    });
  });

  app.post("/agreements", async (req, reply) => {
    const body = parse(agreementCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const [car, driver] = await Promise.all([
      prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } }),
      prisma.driver.findFirst({ where: { id: body.driverId, ownerId: oid } }),
    ]);
    if (!car || !driver) return reply.code(400).send({ error: "invalid_car_or_driver" });

    const duplicate = await prisma.rentalAgreement.findFirst({
      where: {
        ownerId: oid,
        driverId: body.driverId,
        carId: body.carId,
        status: "ACTIVE",
      },
    });
    if (duplicate) return reply.code(400).send({ error: "agreement_exists" });

    const carBusy = await prisma.rentalAgreement.findFirst({
      where: { ownerId: oid, carId: body.carId, status: "ACTIVE" },
    });
    if (carBusy) return reply.code(400).send({ error: "car_already_rented" });

    const data = toDates(body, ["startDate", "endDate"]);
    const created = await prisma.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.create({ data: { ...data, ownerId: oid } });
      if (agreement.status === "ACTIVE") {
        await tx.car.update({ where: { id: body.carId }, data: { status: "RENTED" } });
      }
      return agreement;
    });
    return created;
  });

  app.patch("/agreements/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(agreementUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.rentalAgreement.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["startDate", "endDate"]);
    return prisma.rentalAgreement.update({ where: { id }, data });
  });

  app.post("/agreements/:id/end", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.rentalAgreement.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    return prisma.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.update({
        where: { id },
        data: { status: "ENDED", endDate: existing.endDate ?? new Date() },
      });
      const otherActiveOnCar = await tx.rentalAgreement.count({
        where: { carId: existing.carId, status: "ACTIVE", id: { not: id } },
      });
      if (otherActiveOnCar === 0) {
        await tx.car.update({ where: { id: existing.carId }, data: { status: "AVAILABLE" } });
      }
      return agreement;
    });
  });
}
