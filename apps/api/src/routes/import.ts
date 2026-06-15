import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { ownerId } from "./helpers.js";
import { CarStatus, ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";

const MAX_NOTE_LENGTH = 2000;
const NAME_TWO_WORD = /^[\p{L}’'\-]+\s+[\p{L}’'\-]+$/u;
const ZERO_WIDTH_RE = /[​-‍﻿]/g;

function getPayload(body: unknown): string | null {
  if (body && typeof body === "object" && "text" in body) {
    const text = (body as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  if (body && typeof body === "object" && "csv" in body) {
    const csv = (body as { csv?: unknown }).csv;
    if (typeof csv === "string") return csv;
  }
  if (typeof body === "string") return body;
  return null;
}

function splitPasteLines(input: string): string[] {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(ZERO_WIDTH_RE, "").trim())
    .filter((line) => line.length > 0);
}

function splitPasteColumns(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim());
  }
  if (line.includes("  ")) {
    return line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
  }
  return line.trim().split(/\s+/);
}

function parsePasteDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const dotted = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (dotted) {
    const [, d, m, rawY] = dotted;
    const yearNum = Number(rawY);
    const year = yearNum < 100 ? 2000 + yearNum : yearNum;
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d), 12));
    return isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function parsePasteNumber(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const body = trimmed.replace(/[+\-]/g, "").replace(/[^\d.,]/g, "");
  if (!body) return null;
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      normalized = body.replace(/,/g, "");
    } else {
      normalized = body.replace(/\./g, "").replace(",", ".");
    }
  } else if (lastComma !== -1) {
    const after = body.length - lastComma - 1;
    if (after === 3 && /^\d{1,3}$/.test(body.slice(0, lastComma))) {
      normalized = body.replace(",", "");
    } else {
      normalized = body.replace(",", ".");
    }
  } else {
    normalized = body;
  }
  const n = Number(normalized);
  return isNaN(n) ? null : n;
}

function splitNameAndNote(raw: string): { name: string; note: string } {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return { name: "", note: "" };
  const tokens = cleaned.split(" ");
  if (tokens.length <= 2) {
    return { name: cleaned, note: "" };
  }
  const firstTwo = `${tokens[0]} ${tokens[1]}`;
  if (NAME_TWO_WORD.test(firstTwo)) {
    return {
      name: firstTwo,
      note: tokens.slice(2).join(" ").trim(),
    };
  }
  return { name: tokens[0], note: tokens.slice(1).join(" ").trim() };
}

function findDriverByName(drivers: { id: string; fullName: string }[], name: string): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const exact = drivers.find((d) => d.fullName.trim().toLowerCase() === needle);
  if (exact) return exact.id;
  const first = drivers.find(
    (d) => d.fullName.trim().toLowerCase().split(/\s+/)[0] === needle,
  );
  return first?.id ?? null;
}

function findCarByPlate(cars: { id: string; plate: string }[], plate: string): string | null {
  const needle = plate.trim().toLowerCase();
  if (!needle) return null;
  const exact = cars.find((c) => c.plate.trim().toLowerCase() === needle);
  if (exact) return exact.id;
  return cars.find((c) => c.plate.trim().toLowerCase().includes(needle))?.id ?? null;
}

function truncateNote(value: string): string {
  if (value.length <= MAX_NOTE_LENGTH) return value;
  return value.slice(0, MAX_NOTE_LENGTH);
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post("/import/cars", async (req, reply) => {
    const text = getPayload(req.body);
    if (!text) return reply.code(400).send({ error: "missing_text" });
    const lines = splitPasteLines(text);
    const oid = ownerId(req);
    let created = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const cols = splitPasteColumns(line);
      const plate = (cols[0] ?? "").trim();
      if (!plate) {
        errors.push(`Line ${i + 1}: missing plate`);
        continue;
      }
      const make = (cols[1] ?? "").trim() || null;
      const model = (cols[2] ?? "").trim() || null;
      const yearNum = parsePasteNumber(cols[3]);
      const noteRaw = cols.slice(make ? 4 : 1).join(" ").trim();
      const note = noteRaw ? truncateNote(noteRaw) : null;
      await prisma.car.create({
        data: {
          ownerId: oid,
          plate,
          make,
          model,
          year: yearNum,
          status: CarStatus.AVAILABLE,
          notes: note,
        },
      });
      created++;
    }
    return { created, total: lines.length, errors };
  });

  app.post("/import/drivers", async (req, reply) => {
    const text = getPayload(req.body);
    if (!text) return reply.code(400).send({ error: "missing_text" });
    const lines = splitPasteLines(text);
    const oid = ownerId(req);
    let created = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const cols = splitPasteColumns(line);
      const nameCol = (cols[0] ?? "").trim();
      if (!nameCol) {
        errors.push(`Line ${i + 1}: missing name`);
        continue;
      }
      const { name, note } = splitNameAndNote(nameCol);
      const [firstName, ...rest] = name.split(" ");
      const lastName = rest.join(" ");
      const phone = (cols[1] ?? "").trim() || null;
      const noteFallback = note || cols.slice(2).join(" ").trim();
      await prisma.driver.create({
        data: {
          ownerId: oid,
          firstName: firstName || name,
          lastName: lastName || firstName || name,
          fullName: name,
          phone,
          notes: noteFallback ? truncateNote(noteFallback) : null,
        },
      });
      created++;
    }
    return { created, total: lines.length, errors };
  });

  app.post("/import/payments", async (req, reply) => {
    const text = getPayload(req.body);
    if (!text) return reply.code(400).send({ error: "missing_text" });
    const lines = splitPasteLines(text);
    const oid = ownerId(req);
    const [drivers, cars] = await Promise.all([
      prisma.driver.findMany({
        where: { ownerId: oid },
        select: { id: true, fullName: true },
      }),
      prisma.car.findMany({
        where: { ownerId: oid },
        select: { id: true, plate: true },
      }),
    ]);

    let created = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const cols = splitPasteColumns(line);
      const date = parsePasteDate(cols[0]) ?? new Date();
      const plate = (cols[1] ?? "").trim();
      const amount = parsePasteNumber(cols[2]);
      const driverCol = (cols[3] ?? "").trim();
      if (amount == null) {
        errors.push(`Line ${i + 1}: missing amount`);
        continue;
      }
      if (!driverCol && !plate) {
        errors.push(`Line ${i + 1}: missing driver or plate`);
        continue;
      }
      const { name, note } = splitNameAndNote(driverCol);
      const driverId = name ? findDriverByName(drivers, name) : null;
      const carId = plate ? findCarByPlate(cars, plate) : null;
      if (driverCol && !driverId) {
        errors.push(`Line ${i + 1}: driver "${name}" not found`);
        continue;
      }
      if (plate && !carId) {
        errors.push(`Line ${i + 1}: car "${plate}" not found`);
        continue;
      }
      const noteText = driverId ? note : driverCol || plate;
      await prisma.payment.create({
        data: {
          ownerId: oid,
          driverId,
          carId,
          amount,
          date,
          method: PaymentMethod.CASH,
          type: PaymentType.RENT,
          note: noteText ? truncateNote(noteText) : null,
        },
      });
      created++;
    }
    return { created, total: lines.length, errors };
  });

  const EXPENSE_CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
    FUEL: ExpenseCategory.FUEL,
    GAS: ExpenseCategory.FUEL,
    PALNE: ExpenseCategory.FUEL,
    PALIVO: ExpenseCategory.FUEL,
    MAINTENANCE: ExpenseCategory.MAINTENANCE,
    SERVICE: ExpenseCategory.MAINTENANCE,
    SERVIS: ExpenseCategory.MAINTENANCE,
    ТО: ExpenseCategory.MAINTENANCE,
    REPAIR: ExpenseCategory.REPAIR,
    REPAIRS: ExpenseCategory.REPAIR,
    REMONT: ExpenseCategory.REPAIR,
    INSURANCE: ExpenseCategory.INSURANCE,
    STRAHOVKA: ExpenseCategory.INSURANCE,
    TAX: ExpenseCategory.TAX,
    PODATOK: ExpenseCategory.TAX,
    NALOG: ExpenseCategory.TAX,
    OTHER: ExpenseCategory.OTHER,
    INSHI: ExpenseCategory.OTHER,
  };

  function parseExpenseCategory(value: string | undefined): ExpenseCategory {
    if (!value) return ExpenseCategory.OTHER;
    const key = value.trim().toUpperCase();
    if (EXPENSE_CATEGORY_ALIASES[key]) return EXPENSE_CATEGORY_ALIASES[key];
    const direct = Object.values(ExpenseCategory).find((c) => c === key);
    if (direct) return direct;
    return ExpenseCategory.OTHER;
  }

  function isCategoryKey(value: string | undefined): boolean {
    if (!value) return false;
    const key = value.trim().toUpperCase();
    if (!key) return false;
    if (EXPENSE_CATEGORY_ALIASES[key]) return true;
    return Object.values(ExpenseCategory).some((c) => c === key);
  }

  app.post("/import/expenses", async (req, reply) => {
    const text = getPayload(req.body);
    if (!text) return reply.code(400).send({ error: "missing_text" });
    const lines = splitPasteLines(text);
    const oid = ownerId(req);
    const cars = await prisma.car.findMany({
      where: { ownerId: oid },
      select: { id: true, plate: true },
    });

    let created = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const cols = splitPasteColumns(line);
      const date = parsePasteDate(cols[0]) ?? new Date();
      const plate = (cols[1] ?? "").trim();
      const amount = parsePasteNumber(cols[2]);
      if (amount == null) {
        errors.push(`Line ${i + 1}: missing amount`);
        continue;
      }

      let category: ExpenseCategory = ExpenseCategory.OTHER;
      let tag: string | null = null;
      let noteRaw = "";
      if (isCategoryKey(cols[3])) {
        category = parseExpenseCategory(cols[3]);
        const tagCol = (cols[4] ?? "").trim();
        const rest = cols.slice(5).join(" ").trim();
        if (tagCol && !/\s/.test(tagCol)) {
          tag = tagCol;
          noteRaw = rest;
        } else if (tagCol) {
          noteRaw = [tagCol, rest].filter(Boolean).join(" ").trim();
        }
      } else {
        noteRaw = cols.slice(3).join(" ").trim();
      }

      const carId = plate ? findCarByPlate(cars, plate) : null;
      if (plate && !carId) {
        errors.push(`Line ${i + 1}: car "${plate}" not found`);
        continue;
      }
      await prisma.expense.create({
        data: {
          ownerId: oid,
          carId: carId ?? null,
          amount,
          date,
          category,
          tag,
          note: noteRaw ? truncateNote(noteRaw) : null,
        },
      });
      created++;
    }
    return { created, total: lines.length, errors };
  });
}
