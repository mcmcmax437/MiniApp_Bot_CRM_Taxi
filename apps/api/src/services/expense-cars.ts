import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

type Db = Prisma.TransactionClient | typeof prisma;

export const expenseCarInclude = {
  car: { select: { id: true, plate: true } },
  carLinks: { include: { car: { select: { id: true, plate: true } } } },
} as const;

export async function replaceExpenseCarLinks(
  db: Db,
  expenseId: string,
  carIds: string[],
): Promise<void> {
  const unique = [...new Set(carIds)];
  await db.expenseCar.deleteMany({ where: { expenseId } });
  if (unique.length === 0) return;
  await db.expenseCar.createMany({
    data: unique.map((carId) => ({ expenseId, carId })),
  });
}

export function presentExpense<
  T extends {
    car: { id: string; plate: string } | null;
    carLinks: { car: { id: string; plate: string } }[];
  },
>(row: T) {
  const linked = row.carLinks.map((link) => link.car);
  const cars = (linked.length > 0 ? linked : row.car ? [row.car] : [])
    .slice()
    .sort((a, b) => a.plate.localeCompare(b.plate));
  const { carLinks: _links, ...rest } = row;
  return { ...rest, cars };
}

/** `carIds` wins when the client sends it. A missing list on update leaves the links alone. */
export function carIdsFromExpenseBody(
  body: { carId?: string | null; carIds?: string[] },
  creating: boolean,
): string[] | undefined {
  if (body.carIds !== undefined) return [...new Set(body.carIds)];
  if (body.carId !== undefined) return body.carId ? [body.carId] : [];
  return creating ? [] : undefined;
}
