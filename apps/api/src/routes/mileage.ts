import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { mileageLogCreateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function mileageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/mileage", async (req) => {
    const { carId } = req.query as { carId?: string };
    if (!carId) return [];
    return prisma.mileageLog.findMany({
      where: { ownerId: ownerId(req), carId },
      orderBy: { recordedAt: "desc" },
      take: 52,
    });
  });

  app.post("/mileage", async (req, reply) => {
    const body = parse(mileageLogCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
    if (!car) return reply.code(400).send({ error: "invalid_car" });

    const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
    if (body.recordedAt && Number.isNaN(recordedAt.getTime())) {
      return reply.code(400).send({ error: "invalid_date" });
    }

    if (car.currentMileage != null && body.odometer < car.currentMileage) {
      return reply.code(400).send({ error: "odometer_lower_than_current" });
    }

    return prisma.$transaction(async (tx) => {
      const log = await tx.mileageLog.create({
        data: {
          ownerId: oid,
          carId: body.carId,
          driverId: body.driverId ?? null,
          odometer: body.odometer,
          recordedAt,
          source: body.source,
          note: body.note ?? null,
        },
      });
      await tx.car.update({
        where: { id: body.carId },
        data: { currentMileage: body.odometer, mileageUpdatedAt: recordedAt },
      });
      return log;
    });
  });
}
