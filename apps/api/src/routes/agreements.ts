import type { FastifyInstance } from "fastify";
import { findRentalPeriodConflict } from "@taxi/shared";
import { prisma } from "../prisma.js";
import { agreementCreateSchema, agreementUpdateSchema } from "@taxi/shared";
import type { AgreementCreateInput, AgreementUpdateInput } from "@taxi/shared";
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

/** Exactly one of driverId or temporaryDriverName; clears the other field. */
function normalizeAgreementDriverFields(
  body: Pick<AgreementCreateInput, "driverId" | "temporaryDriverName">,
): { driverId: string | null; temporaryDriverName: string | null } {
  const temp = body.temporaryDriverName?.trim() || null;
  if (temp) {
    return { driverId: null, temporaryDriverName: temp };
  }
  if (body.driverId) {
    return { driverId: body.driverId, temporaryDriverName: null };
  }
  return { driverId: null, temporaryDriverName: null };
}

function mergedDriverFields(
  existing: { driverId: string | null; temporaryDriverName: string | null },
  body: AgreementUpdateInput,
): { driverId: string | null; temporaryDriverName: string | null } {
  const driverTouched = body.driverId !== undefined || body.temporaryDriverName !== undefined;
  if (!driverTouched) {
    return {
      driverId: existing.driverId,
      temporaryDriverName: existing.temporaryDriverName,
    };
  }
  return normalizeAgreementDriverFields({
    driverId: body.driverId !== undefined ? body.driverId : existing.driverId,
    temporaryDriverName:
      body.temporaryDriverName !== undefined
        ? body.temporaryDriverName
        : existing.temporaryDriverName,
  });
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
    const driverFields = normalizeAgreementDriverFields(body);

    const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
    if (!car) return reply.code(400).send({ error: "invalid_car_or_driver" });

    if (driverFields.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: driverFields.driverId, ownerId: oid },
      });
      if (!driver) return reply.code(400).send({ error: "invalid_car_or_driver" });
    }

    const data = toDates(body, ["startDate", "endDate"]);
    // An agreement with no endDate is an ongoing rental (ACTIVE).
    // An agreement with a future or current endDate is also ACTIVE — the end
    // date is just when it stops. Only past endDates mark the agreement as
    // historical (ENDED), which is how users record rentals that have
    // already finished. This matches the user's mental model: "I assigned
    // the car for two weeks, today is the start, in two weeks is the end."
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = data.endDate as Date | null | undefined;
    const endIsPast =
      endDate instanceof Date && endDate.getTime() < today.getTime();
    const status =
      endIsPast
        ? (body.status ?? "ENDED")
        : body.status ?? "ACTIVE";

    if (endDate && data.startDate && endDate < (data.startDate as unknown as Date)) {
      return reply.code(400).send({ error: "end_before_start" });
    }

    if (!(await assertNoRentalOverlap(oid, body.carId, data.startDate as unknown as Date, endDate instanceof Date ? endDate : null))) {
      return reply.code(400).send({ error: "rental_overlap" });
    }

    if (status === "ACTIVE") {
      if (driverFields.driverId) {
        const duplicate = await prisma.rentalAgreement.findFirst({
          where: {
            ownerId: oid,
            driverId: driverFields.driverId,
            carId: body.carId,
            status: "ACTIVE",
          },
        });
        if (duplicate) return reply.code(400).send({ error: "agreement_exists" });
      }

      const carBusy = await prisma.rentalAgreement.findFirst({
        where: { ownerId: oid, carId: body.carId, status: "ACTIVE" },
      });
      if (carBusy) return reply.code(400).send({ error: "car_already_rented" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.create({
        data: { ...data, ...driverFields, ownerId: oid, status },
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

    const driverFields = mergedDriverFields(existing, body);
    if (!driverFields.driverId && !driverFields.temporaryDriverName) {
      return reply.code(400).send({ error: "driver_or_temp_required" });
    }

    if (driverFields.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: driverFields.driverId, ownerId: oid },
      });
      if (!driver) return reply.code(400).send({ error: "invalid_car_or_driver" });
    }

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
        data: { ...data, ...driverFields },
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
