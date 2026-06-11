import type { FastifyInstance } from "fastify";
import { findRentalPeriodConflict } from "@taxi/shared";
import { prisma } from "../prisma.js";
import { agreementCreateSchema, agreementUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

async function assertNoRentalOverlap(
  ownerIdValue: string,
  carId: string,
  startDate: Date,
  endDate: Date | null,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.rentalAgreement.findMany({
    where: {
      ownerId: ownerIdValue,
      carId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, carId: true, startDate: true, endDate: true },
  });

  const conflict = findRentalPeriodConflict(
    { carId, startDate, endDate },
    existing.map((row) => ({
      id: row.id,
      carId: row.carId,
      startDate: row.startDate,
      endDate: row.endDate,
    })),
  );

  return !conflict;
}

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

    const data = toDates(body, ["startDate", "endDate"]);
    const isHistorical = Boolean(data.endDate);
    const status = isHistorical ? "ENDED" : (body.status ?? "ACTIVE");

    if (isHistorical && data.endDate && data.startDate && data.endDate < data.startDate) {
      return reply.code(400).send({ error: "end_before_start" });
    }

    const endDate = isHistorical ? ((data.endDate as Date | undefined) ?? null) : null;
    if (!(await assertNoRentalOverlap(oid, body.carId, data.startDate as Date, endDate))) {
      return reply.code(400).send({ error: "rental_overlap" });
    }

    if (status === "ACTIVE") {
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
    }

    const created = await prisma.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.create({
        data: { ...data, ownerId: oid, status },
      });
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
    const oid = ownerId(req);
    const existing = await prisma.rentalAgreement.findFirst({
      where: { id, ownerId: oid },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const data = toDates(body, ["startDate", "endDate"]);
    const start = (data.startDate ?? existing.startDate) as Date;
    const end = data.endDate !== undefined ? (data.endDate as Date | null) : existing.endDate;
    if (end && end < start) {
      return reply.code(400).send({ error: "end_before_start" });
    }

    const nextStatus = data.status ?? existing.status;
    const nextCarId = body.carId ?? existing.carId;
    const nextEnd = nextStatus === "ACTIVE" && data.endDate === null ? null : end;

    if (!(await assertNoRentalOverlap(oid, nextCarId, start, nextEnd, id))) {
      return reply.code(400).send({ error: "rental_overlap" });
    }

    if (nextStatus === "ACTIVE") {
      const otherActiveOnCar = await prisma.rentalAgreement.findFirst({
        where: {
          ownerId: oid,
          carId: nextCarId,
          status: "ACTIVE",
          id: { not: id },
        },
      });
      if (otherActiveOnCar) return reply.code(400).send({ error: "car_already_rented" });
    }

    const ending = existing.status === "ACTIVE" && nextStatus === "ENDED";

    return prisma.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.update({
        where: { id },
        data,
      });
      if (ending) {
        const otherActiveOnCar = await tx.rentalAgreement.count({
          where: { carId: existing.carId, status: "ACTIVE", id: { not: id } },
        });
        if (otherActiveOnCar === 0) {
          await tx.car.update({ where: { id: existing.carId }, data: { status: "AVAILABLE" } });
        }
      }
      if (nextStatus === "ACTIVE" && existing.status !== "ACTIVE") {
        await tx.car.update({ where: { id: nextCarId }, data: { status: "RENTED" } });
      }
      return agreement;
    });
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

  app.delete("/agreements/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.rentalAgreement.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    return prisma.$transaction(async (tx) => {
      await tx.rentalAgreement.delete({ where: { id } });
      if (existing.status === "ACTIVE") {
        const otherActiveOnCar = await tx.rentalAgreement.count({
          where: { carId: existing.carId, status: "ACTIVE" },
        });
        if (otherActiveOnCar === 0) {
          await tx.car.update({ where: { id: existing.carId }, data: { status: "AVAILABLE" } });
        }
      }
      return { ok: true };
    });
  });
}
