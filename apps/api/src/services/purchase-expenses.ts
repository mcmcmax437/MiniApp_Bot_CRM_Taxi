import { Currency, ExpenseCategory, type CarPurchasePartInput } from "@taxi/shared";
import { prisma } from "../prisma.js";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function purchaseExpenseNote(plate: string, part: CarPurchasePartInput, multi: boolean): string {
  const base = `Purchase of ${plate}`;
  const sameCurrency = part.amount === part.fleetAmount;
  if (!multi && sameCurrency) return base;
  const original = `${part.amount} ${part.currency}`;
  const rate =
    part.amount > 0 && !sameCurrency
      ? Math.round((part.fleetAmount / part.amount + Number.EPSILON) * 10000) / 10000
      : null;
  const converted = rate != null ? `${original} @ ${rate} = ${part.fleetAmount}` : original;
  const detail = part.note?.trim() ? `${converted} · ${part.note.trim()}` : converted;
  return `${base} · ${detail}`;
}

export function purchaseExpenseRows(args: {
  ownerId: string;
  carId: string;
  plate: string;
  date: Date;
  parts: CarPurchasePartInput[];
}): Array<{
  ownerId: string;
  carId: string;
  category: typeof ExpenseCategory.CAR_PURCHASE;
  amount: number;
  date: Date;
  note: string;
  tag: string;
}> {
  const multi = args.parts.length > 1;
  return args.parts.map((part) => ({
    ownerId: args.ownerId,
    carId: args.carId,
    category: ExpenseCategory.CAR_PURCHASE,
    amount: round2(part.fleetAmount),
    date: args.date,
    note: purchaseExpenseNote(args.plate, part, multi),
    tag: "car-purchase",
  }));
}

const purchaseExpenseWhere = (ownerId: string, carId: string) =>
  ({
    ownerId,
    carId,
    OR: [{ category: ExpenseCategory.CAR_PURCHASE }, { tag: "car-purchase" }],
  }) as never;

function toPartInput(part: {
  amount: number;
  currency: string;
  fleetAmount: number;
  note: string | null;
}): CarPurchasePartInput {
  const currency = (Object.values(Currency) as string[]).includes(part.currency)
    ? (part.currency as CarPurchasePartInput["currency"])
    : Currency.PLN;
  return {
    amount: part.amount,
    currency,
    fleetAmount: part.fleetAmount,
    note: part.note,
  };
}

type CarWithParts = {
  id: string;
  plate: string;
  purchaseDate: Date | null;
  purchaseParts: Array<{
    amount: number;
    currency: string;
    fleetAmount: number;
    note: string | null;
  }>;
};

/** Replace auto-created CAR_PURCHASE expenses so they match the current split. */
export async function replacePurchaseExpenses(args: {
  ownerId: string;
  carId: string;
  plate: string;
  date: Date;
  parts: CarPurchasePartInput[];
}): Promise<void> {
  const rows = purchaseExpenseRows(args);
  await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({
      where: purchaseExpenseWhere(args.ownerId, args.carId),
    });
    if (rows.length === 0) return;
    await tx.expense.createMany({ data: rows as never });
  });
}

/**
 * Cars edited after the first save used to keep the original 1–2 purchase
 * expenses even after the owner split the price into more payments. Rebuild
 * any car whose stored part count no longer matches its purchase expenses.
 */
export async function repairStalePurchaseExpenses(ownerId: string): Promise<void> {
  const cars = (await prisma.car.findMany({
    where: { ownerId },
    select: {
      id: true,
      plate: true,
      purchaseDate: true,
      purchaseParts: { orderBy: { sortOrder: "asc" as const } },
    },
  } as never)) as unknown as CarWithParts[];
  const withParts = cars.filter((c) => c.purchaseParts.length > 0);
  if (withParts.length === 0) return;

  const purchaseExpenses = await prisma.expense.findMany({
    where: {
      ownerId,
      carId: { in: withParts.map((c) => c.id) },
      OR: [{ category: ExpenseCategory.CAR_PURCHASE as never }, { tag: "car-purchase" }],
    },
    select: { carId: true },
  });
  const countByCar = new Map<string, number>();
  for (const row of purchaseExpenses) {
    if (!row.carId) continue;
    countByCar.set(row.carId, (countByCar.get(row.carId) ?? 0) + 1);
  }

  for (const car of withParts) {
    const expected = car.purchaseParts.length;
    const actual = countByCar.get(car.id) ?? 0;
    if (actual === expected) continue;
    await replacePurchaseExpenses({
      ownerId,
      carId: car.id,
      plate: car.plate,
      date: car.purchaseDate ?? new Date(),
      parts: car.purchaseParts.map(toPartInput),
    });
  }
}
