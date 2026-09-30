import type { Owner } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { carButtonLabel, matchCars, type LedgerCar } from "./match-cars.js";
import { messageCalendarDate, type LedgerIntent } from "./intent.js";
import { askLedgerModel } from "./openai.js";
import { rememberPending, restorePending, takePending } from "./pending.js";
import { formatLedgerAmount, formatLedgerDate, ledgerCopy } from "./copy.js";

const MAX_CHOICES = 8;

export type LedgerBotResult =
  | { status: "saved"; text: string }
  | { status: "choose"; text: string; token: string; choices: Array<{ index: number; label: string }> }
  | { status: "rejected"; text: string };

type ActionIntent = Exclude<LedgerIntent, { kind: "unknown" }>;

async function resolveWriter(telegramUserId: string): Promise<
  | { owner: Owner }
  | { error: "not_owner" | "viewer" | "expired"; locale: string }
> {
  let id: bigint;
  try {
    id = BigInt(telegramUserId);
  } catch {
    return { error: "not_owner", locale: "uk" };
  }

  const owner = await prisma.owner.findUnique({ where: { telegramUserId: id } });
  if (owner?.status === "ACTIVE") {
    if (owner.subscriptionExpiresAt && owner.subscriptionExpiresAt.getTime() < Date.now()) {
      return { error: "expired", locale: owner.locale };
    }
    return { owner };
  }

  const member = await prisma.fleetMember.findFirst({
    where: { telegramUserId: id, status: "ACTIVE" },
  });
  if (member) return { error: "viewer", locale: member.locale };
  return { error: "not_owner", locale: owner?.locale ?? "uk" };
}

async function driverOnDate(ownerId: string, carId: string, date: string) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const agreements = await prisma.rentalAgreement.findMany({
    where: {
      ownerId,
      carId,
      status: "ACTIVE",
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    include: { driver: { select: { id: true, fullName: true } } },
    orderBy: { startDate: "desc" },
  });
  return agreements[0] ?? null;
}

function savedText(args: {
  locale: string;
  currency: string;
  intent: ActionIntent;
  date: string;
  car: LedgerCar;
  driverName: string | null;
  temporaryDriverName: string | null;
}): string {
  const copy = ledgerCopy(args.locale);
  const lines = [
    args.intent.kind === "expense" ? copy.savedExpense : copy.savedIncome,
    formatLedgerAmount(args.intent.amount, args.currency, args.locale),
  ];
  if (args.intent.note) lines.push(args.intent.note);
  lines.push(carButtonLabel(args.car));
  lines.push(formatLedgerDate(args.date, args.locale));
  if (args.intent.kind === "income") {
    if (args.driverName) lines.push(`${copy.driver}: ${args.driverName}`);
    else if (args.temporaryDriverName) lines.push(`${copy.tempDriver}: ${args.temporaryDriverName}`);
    else lines.push(copy.noDriver);
  }
  return lines.join("\n");
}

async function saveIntent(args: {
  owner: Owner;
  intent: ActionIntent;
  date: string;
  car: LedgerCar;
}): Promise<string> {
  const agreement =
    args.intent.kind === "income" ? await driverOnDate(args.owner.id, args.car.id, args.date) : null;
  const noon = new Date(`${args.date}T12:00:00.000Z`);

  if (args.intent.kind === "expense") {
    await prisma.expense.create({
      data: {
        ownerId: args.owner.id,
        carId: args.car.id,
        category: args.intent.category,
        amount: args.intent.amount,
        date: noon,
        note: args.intent.note,
        tag: "telegram",
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        ownerId: args.owner.id,
        carId: args.car.id,
        driverId: agreement?.driver?.id ?? null,
        amount: args.intent.amount,
        date: noon,
        method: args.intent.method,
        bank: args.intent.method === "CASH" ? "NONE" : args.intent.bank,
        type: args.intent.paymentType,
        note: args.intent.note,
      },
    });
  }

  return savedText({
    locale: args.owner.locale,
    currency: args.owner.currency,
    intent: args.intent,
    date: args.date,
    car: args.car,
    driverName: agreement?.driver?.fullName ?? null,
    temporaryDriverName: agreement?.temporaryDriverName ?? null,
  });
}

function chooseOrSave(args: {
  owner: Owner;
  intent: ActionIntent;
  date: string;
  telegramUserId: string;
  cars: LedgerCar[];
}): Promise<LedgerBotResult> | LedgerBotResult {
  const copy = ledgerCopy(args.owner.locale);
  if (args.cars.length === 0) return { status: "rejected", text: copy.noCar };
  if (args.cars.length > MAX_CHOICES) return { status: "rejected", text: copy.tooMany };
  if (args.cars.length > 1) {
    const token = rememberPending({
      telegramUserId: args.telegramUserId,
      ownerId: args.owner.id,
      intent: args.intent,
      date: args.date,
      carIds: args.cars.map((car) => car.id),
    });
    return {
      status: "choose",
      text: copy.choose,
      token,
      choices: args.cars.map((car, index) => ({ index, label: carButtonLabel(car) })),
    };
  }
  return saveIntent({ owner: args.owner, intent: args.intent, date: args.date, car: args.cars[0]! }).then(
    (text) => ({ status: "saved", text }),
  );
}

export async function handleLedgerMessage(input: {
  telegramUserId: string;
  text: string;
  unixSeconds: number;
}): Promise<LedgerBotResult> {
  const access = await resolveWriter(input.telegramUserId);
  if ("error" in access) {
    const copy = ledgerCopy(access.locale);
    const text =
      access.error === "viewer" ? copy.viewer : access.error === "expired" ? copy.expired : copy.notOwner;
    return { status: "rejected", text };
  }

  const copy = ledgerCopy(access.owner.locale);
  let intent: LedgerIntent;
  try {
    intent = await askLedgerModel(input.text);
  } catch (err) {
    const notConfigured = err instanceof Error && err.name === "LedgerNotConfigured";
    return { status: "rejected", text: notConfigured ? copy.notConfigured : copy.aiFailed };
  }
  if (intent.kind === "unknown") return { status: "rejected", text: copy.unknown };

  const cars = await prisma.car.findMany({
    where: { ownerId: access.owner.id },
    select: { id: true, plate: true, make: true, model: true },
  });
  const matched = matchCars(intent.carQuery, cars);
  return chooseOrSave({
    owner: access.owner,
    intent,
    date: messageCalendarDate(input.unixSeconds),
    telegramUserId: input.telegramUserId,
    cars: matched,
  });
}

export async function confirmLedgerChoice(input: {
  telegramUserId: string;
  token: string;
  index: number;
}): Promise<LedgerBotResult> {
  const access = await resolveWriter(input.telegramUserId);
  const copy = ledgerCopy("owner" in access ? access.owner.locale : access.locale);
  if ("error" in access) return { status: "rejected", text: copy.notOwner };

  const pending = takePending(input.token, input.telegramUserId);
  if (!pending || pending.ownerId !== access.owner.id) {
    return { status: "rejected", text: copy.stale };
  }

  const carId = pending.carIds[input.index];
  if (!carId) {
    restorePending(input.token, pending);
    return { status: "rejected", text: copy.stale };
  }

  const car = await prisma.car.findFirst({
    where: { id: carId, ownerId: access.owner.id },
    select: { id: true, plate: true, make: true, model: true },
  });
  if (!car) {
    return { status: "rejected", text: copy.noCar };
  }

  try {
    const text = await saveIntent({
      owner: access.owner,
      intent: pending.intent,
      date: pending.date,
      car,
    });
    return { status: "saved", text };
  } catch (err) {
    restorePending(input.token, pending);
    throw err;
  }
}
