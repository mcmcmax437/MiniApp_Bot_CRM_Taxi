import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import {
  maintenanceRecordCreateSchema,
  maintenanceRuleCreateSchema,
  maintenanceRuleUpdateSchema,
} from "@taxi/shared";
import { computeNextDue } from "../services/maintenance.js";
import { ownerId, parse, toDates } from "./helpers.js";

async function refreshRuleNextDue(ruleId: string) {
  const rule = await prisma.maintenanceRule.findUnique({ where: { id: ruleId } });
  if (!rule) return;
  const next = computeNextDue(rule, rule.lastCompletedAt, rule.lastCompletedMileage);
  await prisma.maintenanceRule.update({
    where: { id: ruleId },
    data: { nextDueDate: next.nextDueDate, nextDueMileage: next.nextDueMileage },
  });
}

export async function maintenanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/maintenance-rules", async (req) => {
    const { carId } = req.query as { carId?: string };
    return prisma.maintenanceRule.findMany({
      where: { ownerId: ownerId(req), ...(carId ? { carId } : {}) },
      orderBy: { name: "asc" },
    });
  });

  app.post("/maintenance-rules", async (req, reply) => {
    const body = parse(maintenanceRuleCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
    if (!car) return reply.code(400).send({ error: "invalid_car" });

    if (body.intervalKind === "YEARLY" && !body.yearlyMonth) {
      return reply.code(400).send({ error: "yearly_month_required" });
    }

    const next = computeNextDue(
      {
        intervalKind: body.intervalKind,
        intervalValue: body.intervalValue,
        yearlyMonth: body.yearlyMonth ?? null,
      },
      null,
      car.currentMileage,
    );
    return prisma.maintenanceRule.create({
      data: {
        ownerId: oid,
        carId: body.carId,
        name: body.name,
        presetKey: body.presetKey ?? null,
        description: body.description ?? null,
        intervalKind: body.intervalKind,
        intervalValue: body.intervalValue,
        yearlyMonth: body.yearlyMonth ?? null,
        isMandatory: body.isMandatory,
        isActive: body.isActive,
        nextDueDate: next.nextDueDate,
        nextDueMileage: next.nextDueMileage,
      },
    });
  });

  app.patch("/maintenance-rules/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(maintenanceRuleUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.maintenanceRule.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const updated = await prisma.maintenanceRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.presetKey !== undefined ? { presetKey: body.presetKey } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.intervalKind !== undefined ? { intervalKind: body.intervalKind } : {}),
        ...(body.intervalValue !== undefined ? { intervalValue: body.intervalValue } : {}),
        ...(body.yearlyMonth !== undefined ? { yearlyMonth: body.yearlyMonth } : {}),
        ...(body.isMandatory !== undefined ? { isMandatory: body.isMandatory } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    await refreshRuleNextDue(id);
    return prisma.maintenanceRule.findUnique({ where: { id: updated.id } });
  });

  app.delete("/maintenance-rules/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.maintenanceRule.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.maintenanceRule.delete({ where: { id } });
    return { ok: true };
  });

  app.get("/maintenance-records", async (req) => {
    const { carId } = req.query as { carId?: string };
    return prisma.maintenanceRecord.findMany({
      where: { ownerId: ownerId(req), ...(carId ? { carId } : {}) },
      orderBy: { completedAt: "desc" },
      take: 100,
    });
  });

  app.post("/maintenance-records", async (req, reply) => {
    const body = parse(maintenanceRecordCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
    if (!car) return reply.code(400).send({ error: "invalid_car" });

    const completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      return reply.code(400).send({ error: "invalid_date" });
    }

    let presetKey = body.presetKey ?? null;
    if (body.ruleId && !presetKey) {
      const linkedRule = await prisma.maintenanceRule.findFirst({
        where: { id: body.ruleId, ownerId: oid },
      });
      presetKey = linkedRule?.presetKey ?? null;
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({
        data: {
          ownerId: oid,
          carId: body.carId,
          ruleId: body.ruleId ?? null,
          title: body.title,
          presetKey,
          completedAt,
          mileageAt: body.mileageAt ?? null,
          cost: body.cost ?? null,
          notes: body.notes ?? null,
        },
      });

      if (body.mileageAt != null && body.mileageAt >= (car.currentMileage ?? 0)) {
        await tx.car.update({
          where: { id: body.carId },
          data: { currentMileage: body.mileageAt, mileageUpdatedAt: new Date() },
        });
        await tx.mileageLog.create({
          data: {
            ownerId: oid,
            carId: body.carId,
            odometer: body.mileageAt,
            recordedAt: completedAt,
            source: "MAINTENANCE",
            note: body.title,
          },
        });
      }

      if (body.ruleId) {
        const rule = await tx.maintenanceRule.findFirst({
          where: { id: body.ruleId, ownerId: oid },
        });
        if (rule) {
          const next = computeNextDue(rule, completedAt, body.mileageAt ?? null);
          await tx.maintenanceRule.update({
            where: { id: rule.id },
            data: {
              lastCompletedAt: completedAt,
              lastCompletedMileage: body.mileageAt ?? rule.lastCompletedMileage,
              nextDueDate: next.nextDueDate,
              nextDueMileage: next.nextDueMileage,
            },
          });
        }
      }

      return created;
    });

    return record;
  });
}
