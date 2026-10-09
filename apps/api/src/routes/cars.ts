import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import {
  carCreateSchema,
  carUpdateSchema,
  type CarPurchasePartInput,
} from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { isImageDocument } from "../services/document-image.js";
import { fetchMkingPosition, TrackerError, type TrackerPosition } from "../services/mking-tracker.js";
import { replacePurchaseExpenses } from "../services/purchase-expenses.js";

const TRACKER_CACHE_TTL_MS = 20_000;
const trackerCache = new Map<string, { at: number; position: TrackerPosition }>();

const carInclude = {
  agreements: {
    where: { status: "ACTIVE" as const },
    include: { driver: { select: { id: true, fullName: true, phone: true } } },
  },
  purchaseParts: { orderBy: { sortOrder: "asc" as const } },
};

const carListInclude = {
  agreements: {
    where: { status: "ACTIVE" as const },
    include: { driver: { select: { id: true, fullName: true } } },
  },
  purchaseParts: { orderBy: { sortOrder: "asc" as const } },
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumFleetAmount(parts: CarPurchasePartInput[]): number {
  return round2(parts.reduce((s, p) => s + p.fleetAmount, 0));
}

function purchasePartRows(parts: CarPurchasePartInput[]) {
  return parts.map((p, i) => ({
    amount: p.amount,
    currency: p.currency,
    fleetAmount: p.fleetAmount,
    note: p.note ?? null,
    sortOrder: i,
  }));
}

async function ownerCurrency(ownerId: string): Promise<CarPurchasePartInput["currency"]> {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { currency: true },
  });
  return (owner?.currency as CarPurchasePartInput["currency"] | undefined) ?? "PLN";
}

function expensePartsFromPurchase(
  parts: CarPurchasePartInput[],
  purchasePrice: number | null | undefined,
  currency: CarPurchasePartInput["currency"],
): CarPurchasePartInput[] {
  if (parts.length > 0) return parts;
  if (purchasePrice != null && purchasePrice > 0) {
    return [{ amount: purchasePrice, currency, fleetAmount: purchasePrice, note: null }];
  }
  return [];
}

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
      include: carListInclude,
    });
  });

  app.get("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const car = await prisma.car.findFirst({
      where: { id, ownerId: ownerId(req) },
      include: carInclude,
    });
    if (!car) return reply.code(404).send({ error: "not_found" });
    return car;
  });

  app.post("/cars", async (req, reply) => {
    const body = parse(carCreateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const { coverDocumentId: _cover, purchaseParts, ...rest } = body;
    const data = toDates(rest, [
      "insuranceExpiry",
      "inspectionExpiry",
      "purchaseDate",
      "tireInstalledAt",
    ]);
    if (body.currentMileage != null) {
      (data as { mileageUpdatedAt?: Date }).mileageUpdatedAt = new Date();
    }

    const parts = purchaseParts ?? [];
    if (parts.length > 0) {
      (data as { purchasePrice?: number }).purchasePrice = sumFleetAmount(parts);
    }

    const car = await prisma.car.create({
      data: {
        ...data,
        ownerId: oid,
        ...(parts.length > 0
          ? { purchaseParts: { create: purchasePartRows(parts) } }
          : {}),
      },
      include: carInclude,
    });

    // Auto-record purchase expense(s). Prefer explicit split parts; otherwise a
    // single total purchasePrice still becomes one CAR_PURCHASE expense.
    const expenseParts = expensePartsFromPurchase(
      parts,
      body.purchasePrice,
      parts.length === 0 ? await ownerCurrency(oid) : "PLN",
    );

    if (expenseParts.length > 0) {
      const purchaseDate =
        (data as { purchaseDate?: Date | null }).purchaseDate ?? new Date();
      try {
        await replacePurchaseExpenses({
          ownerId: oid,
          carId: car.id,
          plate: car.plate,
          date: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
          parts: expenseParts,
        });
      } catch (err) {
        req.log.warn({ err, carId: car.id }, "failed to create purchase expenses");
      }
    }

    return car;
  });

  app.patch("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(carUpdateSchema, req.body, reply);
    if (!body) return;
    const oid = ownerId(req);
    const existing = await prisma.car.findFirst({ where: { id, ownerId: oid } });
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const { coverDocumentId, purchaseParts, ...rest } = body;
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

    if (purchaseParts !== undefined) {
      if (purchaseParts.length > 0) {
        patch.purchasePrice = sumFleetAmount(purchaseParts);
      }
      await prisma.$transaction([
        prisma.carPurchasePart.deleteMany({ where: { carId: id } }),
        prisma.car.update({
          where: { id },
          data: {
            ...patch,
            ...(purchaseParts.length > 0
              ? { purchaseParts: { create: purchasePartRows(purchaseParts) } }
              : {}),
          },
        }),
      ]);
      const updated = await prisma.car.findFirstOrThrow({ where: { id }, include: carInclude });
      const expenseParts = expensePartsFromPurchase(
        purchaseParts,
        updated.purchasePrice,
        purchaseParts.length === 0 ? await ownerCurrency(oid) : "PLN",
      );
      try {
        await replacePurchaseExpenses({
          ownerId: oid,
          carId: id,
          plate: updated.plate,
          date: updated.purchaseDate ?? new Date(),
          parts: expenseParts,
        });
      } catch (err) {
        req.log.warn({ err, carId: id }, "failed to sync purchase expenses");
      }
      return updated;
    }

    return prisma.car.update({
      where: { id },
      data: patch,
      include: carInclude,
    });
  });

  app.delete("/cars/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.car.findFirst({ where: { id, ownerId: ownerId(req) } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    trackerCache.delete(id);
    await prisma.car.delete({ where: { id } });
    return { ok: true };
  });

  // Live GPS for every car that has a tracker. One failure does not drop the rest.
  app.get("/cars/tracker/locations", async (req) => {
    const force = (req.query as { refresh?: string } | undefined)?.refresh === "1";
    const cars = await prisma.car.findMany({
      where: { ownerId: ownerId(req) },
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        trackerLogin: true,
        trackerPassword: true,
        trackerUrl: true,
      },
      orderBy: { plate: "asc" },
    });
    const ready = cars.filter((car) => car.trackerLogin && car.trackerPassword);
    const located: Array<Record<string, unknown>> = [];
    const failed: Array<{ id: string; plate: string; error: string }> = [];

    let cursor = 0;
    async function next(): Promise<void> {
      const index = cursor;
      cursor += 1;
      const car = ready[index];
      if (!car || !car.trackerLogin || !car.trackerPassword) return;
      try {
        let position: TrackerPosition | undefined;
        let cached = false;
        if (!force) {
          const hit = trackerCache.get(car.id);
          if (hit && Date.now() - hit.at < TRACKER_CACHE_TTL_MS) {
            position = hit.position;
            cached = true;
          }
        }
        if (!position) {
          position = await fetchMkingPosition({
            baseUrl: car.trackerUrl,
            login: car.trackerLogin,
            password: car.trackerPassword,
            loginType: "DEVICE",
          });
          trackerCache.set(car.id, { at: Date.now(), position });
        }
        if (!position.hasFix) {
          failed.push({ id: car.id, plate: car.plate, error: "tracker_no_fix" });
          return;
        }
        located.push({
          id: car.id,
          plate: car.plate,
          make: car.make,
          model: car.model,
          latitude: position.latitude,
          longitude: position.longitude,
          speed: position.speed,
          course: position.course,
          fixTime: position.fixTime,
          online: position.online,
          status: position.status,
          cached,
        });
      } catch (err) {
        const error = err instanceof TrackerError ? err.code : "tracker_unavailable";
        failed.push({ id: car.id, plate: car.plate, error });
      }
    }

    const workers = Math.min(3, ready.length);
    await Promise.all(Array.from({ length: workers }, () => next().then(async function drain() {
      if (cursor < ready.length) {
        await next();
        await drain();
      }
    })));

    located.sort((a, b) => String(a.plate).localeCompare(String(b.plate)));
    return { located, failed, unconfigured: cars.length - ready.length };
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
