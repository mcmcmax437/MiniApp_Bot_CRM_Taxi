import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { carCreateSchema, carUpdateSchema } from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { isImageDocument } from "../services/document-image.js";
import { fetchMkingPosition, TrackerError, type TrackerPosition } from "../services/mking-tracker.js";

const TRACKER_CACHE_TTL_MS = 20_000;
const trackerCache = new Map<string, { at: number; position: TrackerPosition }>();

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
    const data = toDates(rest, [
      "insuranceExpiry",
      "inspectionExpiry",
      "purchaseDate",
      "tireInstalledAt",
    ]);
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

    const data = toDates(rest, [
      "insuranceExpiry",
      "inspectionExpiry",
      "purchaseDate",
      "tireInstalledAt",
    ]);
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

  // Live GPS position from the car's MKing tracker portal (no public API; we
  // replicate the web login server-side). Cached briefly to avoid hammering MKing.
  app.get("/cars/:id/tracker/location", async (req, reply) => {
    const { id } = req.params as { id: string };
    const force = (req.query as { refresh?: string } | undefined)?.refresh === "1";
    const car = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!car) return reply.code(404).send({ error: "not_found" });
    if (!car.trackerLogin || !car.trackerPassword) {
      return reply.code(400).send({ error: "tracker_not_configured" });
    }

    if (!force) {
      const cached = trackerCache.get(id);
      if (cached && Date.now() - cached.at < TRACKER_CACHE_TTL_MS) {
        return { ...cached.position, cached: true };
      }
    }

    try {
      const position = await fetchMkingPosition({
        baseUrl: car.trackerUrl,
        login: car.trackerLogin,
        password: car.trackerPassword,
        loginType: "DEVICE",
      });
      trackerCache.set(id, { at: Date.now(), position });
      return { ...position, cached: false };
    } catch (err) {
      if (err instanceof TrackerError) {
        const status = err.code === "tracker_unavailable" ? 502 : 400;
        return reply.code(status).send({ error: err.code });
      }
      req.log.error({ err }, "tracker location failed");
      return reply.code(502).send({ error: "tracker_unavailable" });
    }
  });
}
