import type { Prisma } from "@prisma/client";
import type { PaymentBank, PaymentMethod } from "@taxi/shared";

export class CarAlreadySoldError extends Error {
  constructor() {
    super("car_already_sold");
    this.name = "CarAlreadySoldError";
  }
}

export class CarNotSoldError extends Error {
  constructor() {
    super("car_not_sold");
    this.name = "CarNotSoldError";
  }
}

export type CarSalePaymentInput = {
  amount: number;
  saleDate: Date;
  method: PaymentMethod;
  bank: PaymentBank;
  note: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseSaleDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
}

/** Turns a sell/edit payload into the income rows stored for the car. */
export function paymentsFromSellInput(
  plate: string,
  body: {
    amount?: number;
    date?: string;
    method?: PaymentMethod;
    bank?: PaymentBank | null;
    note?: string | null;
    parts?: Array<{
      amount: number;
      date: string;
      method?: PaymentMethod;
      bank?: PaymentBank | null;
      note?: string | null;
    }>;
  },
): CarSalePaymentInput[] {
  const sharedNote = body.note?.trim() || `Sale ${plate}`;
  const sourceParts =
    body.parts && body.parts.length > 0
      ? body.parts
      : [
          {
            amount: body.amount!,
            date: body.date!,
            method: body.method,
            bank: body.bank,
            note: body.note,
          },
        ];
  return sourceParts.map((part, index) => {
    const method = part.method ?? "CASH";
    const partNote = part.note?.trim();
    const note =
      partNote ||
      (sourceParts.length > 1 ? `${sharedNote} (${index + 1}/${sourceParts.length})` : sharedNote);
    return {
      amount: part.amount,
      saleDate: parseSaleDate(part.date),
      method,
      bank: (method === "BANK" ? (part.bank ?? "NONE") : "NONE") as PaymentBank,
      note,
    };
  });
}

function saleTotals(payments: CarSalePaymentInput[]): { total: number; saleDate: Date } {
  const total = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const saleDate = payments
    .map((payment) => payment.saleDate)
    .reduce((earliest, date) => (date.getTime() < earliest.getTime() ? date : earliest));
  return { total, saleDate };
}

export async function recordCarSale(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    carId: string;
    payments: CarSalePaymentInput[];
    saleNote: string | null;
  },
): Promise<void> {
  if (input.payments.length === 0) {
    throw new Error("sale_payments_required");
  }

  const { total, saleDate } = saleTotals(input.payments);

  const updated = await tx.car.updateMany({
    where: { id: input.carId, ownerId: input.ownerId, status: { not: "SOLD" } },
    data: {
      status: "SOLD",
      salePrice: total,
      saleDate,
      saleNote: input.saleNote,
    },
  });

  if (updated.count !== 1) {
    throw new CarAlreadySoldError();
  }

  await tx.rentalAgreement.updateMany({
    where: { ownerId: input.ownerId, carId: input.carId, status: "ACTIVE" },
    data: { status: "ENDED", endDate: saleDate },
  });
  await tx.payment.createMany({
    data: salePaymentRows(input.ownerId, input.carId, input.payments),
  });
}

/** Replace the income rows of a car that is already sold. Rent and other payments stay. */
export async function replaceCarSalePayments(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    carId: string;
    payments: CarSalePaymentInput[];
    saleNote: string | null;
  },
): Promise<void> {
  if (input.payments.length === 0) {
    throw new Error("sale_payments_required");
  }

  const { total, saleDate } = saleTotals(input.payments);
  const updated = await tx.car.updateMany({
    where: { id: input.carId, ownerId: input.ownerId, status: "SOLD" },
    data: {
      salePrice: total,
      saleDate,
      saleNote: input.saleNote,
    },
  });
  if (updated.count !== 1) {
    throw new CarNotSoldError();
  }

  await tx.payment.deleteMany({
    where: { ownerId: input.ownerId, carId: input.carId, type: "SALE" },
  });
  await tx.payment.createMany({
    data: salePaymentRows(input.ownerId, input.carId, input.payments),
  });
}

function salePaymentRows(ownerId: string, carId: string, payments: CarSalePaymentInput[]) {
  return payments.map((payment) => ({
    ownerId,
    carId,
    amount: payment.amount,
    date: payment.saleDate,
    method: payment.method,
    bank: payment.bank,
    type: "SALE" as const,
    note: payment.note,
  }));
}
