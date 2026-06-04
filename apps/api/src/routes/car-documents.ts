import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { carDocumentCreateSchema, carDocumentUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";

export async function carDocumentsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/car-documents", async (req) => {
    const { carId } = req.query as { carId?: string };
    return prisma.carDocument.findMany({
      where: { ownerId: ownerId(req), ...(carId ? { carId } : {}) },
      orderBy: { title: "asc" },
    });
  });

  app.post("/car-documents", async (req, reply) => {
    const body = parse(carDocumentCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const car = await prisma.car.findFirst({ where: { id: body.carId, ownerId: oid } });
    if (!car) return reply.code(400).send({ error: "invalid_car" });
    const data = toDates(body, ["expiryDate"]);
    return prisma.carDocument.create({
      data: {
        ownerId: oid,
        carId: body.carId,
        title: body.title,
        expiryDate: data.expiryDate as Date | null | undefined,
        notes: body.notes ?? null,
      },
    });
  });

  app.patch("/car-documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(carDocumentUpdateSchema, req.body, reply);
    if (!body) return;
    const existing = await prisma.carDocument.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const data = toDates(body, ["expiryDate"]);
    return prisma.carDocument.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate as Date | null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
  });

  app.delete("/car-documents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.carDocument.findFirst({
      where: { id, ownerId: ownerId(req) },
    });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.carDocument.delete({ where: { id } });
    return { ok: true };
  });
}
