import type { Prisma } from "@prisma/client";
import type { PaymentBank, PaymentMethod } from "@taxi/shared";

export class CarAlreadySoldError extends Error {
  constructor() {
    super("car_already_sold");
    this.name = "CarAlreadySoldError";
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

  const total = round2(input.payments.reduce((sum, payment) => sum + payment.amount, 0));
  const saleDate = input.payments
    .map((payment) => payment.saleDate)
    .reduce((earliest, date) => (date.getTime() < earliest.getTime() ? date : earliest));

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
    data: input.payments.map((payment) => ({
      ownerId: input.ownerId,
      carId: input.carId,
      amount: payment.amount,
      date: payment.saleDate,
      method: payment.method,
      bank: payment.bank,
      type: "SALE" as const,
      note: payment.note,
    })),
  });
}
