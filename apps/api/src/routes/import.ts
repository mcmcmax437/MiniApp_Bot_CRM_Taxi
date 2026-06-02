import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { ownerId } from "./helpers.js";
import { CarStatus, PaymentMethod, PaymentType } from "@taxi/shared";

/** Minimal CSV parser supporting quoted fields and commas/newlines inside quotes. */
function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

function getCsv(body: unknown): string | null {
  if (body && typeof body === "object" && "csv" in body) {
    const csv = (body as { csv?: unknown }).csv;
    if (typeof csv === "string") return csv;
  }
  if (typeof body === "string") return body;
  return null;
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const found = Object.keys(row).find((h) => h.toLowerCase() === k.toLowerCase());
    if (found && row[found] !== "") return row[found];
  }
  return undefined;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(value?: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[, ]/g, ""));
  return isNaN(n) ? null : n;
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post("/import/cars", async (req, reply) => {
    const csv = getCsv(req.body);
    if (!csv) return reply.code(400).send({ error: "missing_csv" });
    const rows = parseCsv(csv);
    const oid = ownerId(req);
    let created = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const plate = pick(row, ["plate", "number", "номер", "номер авто"]);
      if (!plate) {
        errors.push(`Row ${i + 2}: missing plate`);
        continue;
      }
      const statusRaw = (pick(row, ["status", "статус"]) ?? "").toUpperCase();
      const status = (Object.values(CarStatus) as string[]).includes(statusRaw)
        ? (statusRaw as CarStatus)
        : CarStatus.AVAILABLE;
      await prisma.car.create({
        data: {
          ownerId: oid,
          plate,
          make: pick(row, ["make", "марка"]) ?? null,
          model: pick(row, ["model", "модель"]) ?? null,
          year: parseNum(pick(row, ["year", "рік", "год"])) ?? null,
          status,
          insuranceExpiry: parseDate(pick(row, ["insuranceExpiry", "insurance", "страховка"])),
          inspectionExpiry: parseDate(pick(row, ["inspectionExpiry", "inspection", "техогляд"])),
          notes: pick(row, ["notes", "нотатки", "заметки"]) ?? null,
        },
      });
      created++;
    }
    return { created, total: rows.length, errors };
  });

  app.post("/import/drivers", async (req, reply) => {
    const csv = getCsv(req.body);
    if (!csv) return reply.code(400).send({ error: "missing_csv" });
    const rows = parseCsv(csv);
    const oid = ownerId(req);
    let created = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const fullName = pick(row, ["fullName", "name", "ім'я", "имя", "водій", "водитель"]);
      const firstName =
        pick(row, ["firstName", "first_name", "ім'я", "имя"]) ??
        fullName?.split(/\s+/)[0];
      const lastName =
        pick(row, ["lastName", "last_name", "прізвище", "фамилия"]) ??
        fullName?.split(/\s+/).slice(1).join(" ") ??
        firstName;
      if (!firstName) {
        errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
      await prisma.driver.create({
        data: {
          ownerId: oid,
          firstName,
          lastName: lastName || firstName,
          fullName: displayName,
          phone: pick(row, ["phone", "телефон"]) ?? null,
          telegramUsername: pick(row, ["telegram", "username"]) ?? null,
          pesel: pick(row, ["pesel", "PESEL", "песель"]) ?? null,
          passportNumber: pick(row, ["passport", "passportNumber", "паспорт"]) ?? null,
          addressCity: pick(row, ["city", "addressCity", "місто", "город"]) ?? null,
          addressStreet: pick(row, ["street", "addressStreet", "вулиця", "улица"]) ?? null,
          addressHouse: pick(row, ["house", "addressHouse", "будинок", "дом"]) ?? null,
          addressFlat: pick(row, ["flat", "addressFlat", "квартира"]) ?? null,
          fatherName: pick(row, ["fatherName", "father", "батько", "отец"]) ?? null,
          motherName: pick(row, ["motherName", "mother", "мати", "мать"]) ?? null,
          notes: pick(row, ["notes", "нотатки", "заметки"]) ?? null,
        },
      });
      created++;
    }
    return { created, total: rows.length, errors };
  });

  app.post("/import/payments", async (req, reply) => {
    const csv = getCsv(req.body);
    if (!csv) return reply.code(400).send({ error: "missing_csv" });
    const rows = parseCsv(csv);
    const oid = ownerId(req);
    const drivers = await prisma.driver.findMany({ where: { ownerId: oid } });
    const byName = new Map(drivers.map((d) => [d.fullName.trim().toLowerCase(), d.id] as const));

    let created = 0;
    const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const driverName = pick(row, ["driver", "водій", "водитель", "name"]);
      const amount = parseNum(pick(row, ["amount", "сума", "сумма"]));
      const date = parseDate(pick(row, ["date", "дата"])) ?? new Date();
      if (!driverName || amount == null) {
        errors.push(`Row ${i + 2}: missing driver or amount`);
        continue;
      }
      const driverId = byName.get(driverName.trim().toLowerCase());
      if (!driverId) {
        errors.push(`Row ${i + 2}: driver "${driverName}" not found`);
        continue;
      }
      const methodRaw = (pick(row, ["method", "спосіб", "способ"]) ?? "").toUpperCase();
      const typeRaw = (pick(row, ["type", "тип"]) ?? "").toUpperCase();
      await prisma.payment.create({
        data: {
          ownerId: oid,
          driverId,
          amount,
          date,
          method: (Object.values(PaymentMethod) as string[]).includes(methodRaw)
            ? (methodRaw as PaymentMethod)
            : PaymentMethod.CASH,
          type: (Object.values(PaymentType) as string[]).includes(typeRaw)
            ? (typeRaw as PaymentType)
            : PaymentType.RENT,
          note: pick(row, ["note", "notes", "нотатка", "заметка"]) ?? null,
        },
      });
      created++;
    }
    return { created, total: rows.length, errors };
  });
}
