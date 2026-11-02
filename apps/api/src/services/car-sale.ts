import type { Prisma } from "@prisma/client";
import type { PaymentBank, PaymentMethod } from "@taxi/shared";

export class CarAlreadySoldError extends Error {
  constructor() {
    super("car_already_sold");
    this.name = "CarAlreadySoldError";
  }
}

export async function recordCarSale(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    carId: string;
    amount: number;
    saleDate: Date;
    method: PaymentMethod;
    bank: PaymentBank;
    note: string;
    saleNote: string | null;
  },
): Promise<void> {
  const updated = await tx.car.updateMany({
    where: { id: input.carId, ownerId: input.ownerId, status: { not: "SOLD" } },
    data: {
      status: "SOLD",
      salePrice: input.amount,
      saleDate: input.saleDate,
      saleNote: input.saleNote,
    },
  });

  if (updated.count !== 1) {
    throw new CarAlreadySoldError();
  }

  await tx.rentalAgreement.updateMany({
    where: { ownerId: input.ownerId, carId: input.carId, status: "ACTIVE" },
    data: { status: "ENDED", endDate: input.saleDate },
  });
  await tx.payment.create({
    data: {
      ownerId: input.ownerId,
      carId: input.carId,
      amount: input.amount,
      date: input.saleDate,
      method: input.method,
      bank: input.bank,
      type: "SALE",
      note: input.note,
    },
  });
}
