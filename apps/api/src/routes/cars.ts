import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { carCreateSchema, carUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { isImageDocument } from "../services/document-image.js";

async function resolveCoverDocumentId(
  ownerId: string,
  carId: string,
  coverDocumentId: string | null | undefined,
): Promise<string | null | undefined> {
  if (coverDocumentId === undefined) return undefined;
  if (coverDocumentId === null) return null;
  const doc = await prisma.document.findFirst({
    where: { id: coverDocumentId, ownerId, relatedType: "CAR", relatedId: carId },
  });
  if (!doc || !isImageDocument(doc)) return null;
  return coverDocumentId;
}

export async function carsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cars", async (req) => {
    return prisma.car.findMany({
      where: { ownerId: ownerId(req) },
      orderBy: { createdAt: "desc" },
      include: {
        agreements: {
          where: { status: "ACTIVE" },
          include: { driver: { select: { id: true, fullName: true } } },
        },
      },
    });
  });

  app.get("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const car = await prisma.car.findFirst({
      where: { id, ownerId: ownerId(req) },
      include: {
        agreements: {
          where: { status: "ACTIVE" },
          include: { driver: { select: { id: true, fullName: true, phone: true } } },
        },
      },
    });
    if (!car) return reply.code(404).send({ error: "not_found" });
    return car;
  });

  app.post("/cars", async (req, reply) => {
    const body = parse(carCreateSchema, req.body, reply);
    if (!body) return;
    const { coverDocumentId: _cover, ...rest } = body;
    const data = toDates(rest, ["insuranceExpiry", "inspectionExpiry"]);
    if (body.currentMileage != null) {
      (data as { mileageUpdatedAt?: Date }).mileageUpdatedAt = new Date();
    }
    return prisma.car.create({ data: { ...data, ownerId: ownerId(req) } });
  });

  app.patch("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(carUpdateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const existing = await prisma.car.findFirst({ where: { id, ownerId: oid } });
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const { coverDocumentId, ...rest } = body;
    const resolvedCover = await resolveCoverDocumentId(oid, id, coverDocumentId);
    if (coverDocumentId && resolvedCover === null) {
      return reply.code(400).send({ error: "invalid_cover" });
    }

    const data = toDates(rest, ["insuranceExpiry", "inspectionExpiry"]);
    const patch: Record<string, unknown> = {
      ...data,
      ...(resolvedCover !== undefined ? { coverDocumentId: resolvedCover } : {}),
    };
    if (body.currentMileage !== undefined && body.currentMileage != null) {
      patch.mileageUpdatedAt = new Date();
    }
    return prisma.car.update({
      where: { id },
      data: patch,
    });
  });

  app.delete("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.car.delete({ where: { id } });
    return { ok: true };
  });
}
