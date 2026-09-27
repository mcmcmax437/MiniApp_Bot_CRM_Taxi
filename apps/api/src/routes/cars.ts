import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import {
  ExpenseCategory,
  carCreateSchema,
  carUpdateSchema,
  type CarPurchasePartInput,
} from "@taxi/shared";
import { ownerId, parse, toDates } from "./helpers.js";
import { isImageDocument } from "../services/document-image.js";
import { fetchMkingPosition, TrackerError, type TrackerPosition } from "../services/mking-tracker.js";

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

function purchaseExpenseNote(plate: string, part: CarPurchasePartInput, multi: boolean): string {
  const base = `Purchase of ${plate}`;
  const sameCurrency = part.amount === part.fleetAmount;
  if (!multi && sameCurrency) return base;
  const original = `${part.amount} ${part.currency}`;
  const rate =
    part.amount > 0 && !sameCurrency
      ? Math.round((part.fleetAmount / part.amount + Number.EPSILON) * 10000) / 10000
      : null;
  const converted =
    rate != null
      ? `${original} @ ${rate} = ${part.fleetAmount}`
      : original;
  const detail = part.note?.trim() ? `${converted} · ${part.note.trim()}` : converted;
  return `${base} · ${detail}`;
}

async function createPurchaseExpenses(args: {
  ownerId: string;
  carId: string;
  plate: string;
  date: Date;
  parts: CarPurchasePartInput[];
}): Promise<void> {
  if (args.parts.length === 0) return;
  const multi = args.parts.length > 1;
  await prisma.expense.createMany({
    data: args.parts.map((part) => ({
      ownerId: args.ownerId,
      carId: args.carId,
      category: ExpenseCategory.CAR_PURCHASE,
      amount: part.fleetAmount,
      date: args.date,
      note: purchaseExpenseNote(args.plate, part, multi),
      tag: "car-purchase",
    })),
  });
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
    const expenseParts: CarPurchasePartInput[] =
      parts.length > 0
        ? parts
        : body.purchasePrice != null && body.purchasePrice > 0
          ? [
              {
                amount: body.purchasePrice,
                currency: "PLN",
                fleetAmount: body.purchasePrice,
                note: null,
              },
            ]
          : [];

    // Use owner's currency for the synthetic single-part currency label when
    // there was no split — fall back to PLN only if owner currency is unknown.
    if (expenseParts.length === 1 && parts.length === 0) {
      const owner = await prisma.owner.findUnique({
        where: { id: oid },
        select: { currency: true },
      });
      if (owner?.currency) {
        expenseParts[0] = { ...expenseParts[0], currency: owner.currency as CarPurchasePartInput["currency"] };
      }
    }

    if (expenseParts.length > 0) {
      const purchaseDate =
        (data as { purchaseDate?: Date | null }).purchaseDate ?? new Date();
      try {
        await createPurchaseExpenses({
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
      return prisma.car.findFirstOrThrow({ where: { id }, include: carInclude });
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
