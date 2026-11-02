import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentBank, PaymentMethod } from "@taxi/shared";
import { CarAlreadySoldError, recordCarSale } from "./car-sale.js";

function saleInput() {
  return {
    ownerId: "owner1",
    carId: "car1",
    amount: 12_500,
    saleDate: new Date("2026-11-02T12:00:00.000Z"),
    method: PaymentMethod.BANK,
    bank: PaymentBank.PKO,
    note: "Sale OP8645U",
    saleNote: "Sold to buyer",
  };
}

describe("recordCarSale", () => {
  it("records the sale only after a conditional not-sold car update succeeds", async () => {
    const tx = {
      car: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      rentalAgreement: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      payment: { create: vi.fn().mockResolvedValue({ id: "payment1" }) },
    } as unknown as Prisma.TransactionClient;

    const input = saleInput();
    await recordCarSale(tx, input);

    expect(tx.car.updateMany).toHaveBeenCalledWith({
      where: { id: input.carId, ownerId: input.ownerId, status: { not: "SOLD" } },
      data: {
        status: "SOLD",
        salePrice: input.amount,
        saleDate: input.saleDate,
        saleNote: input.saleNote,
      },
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: input.ownerId,
        carId: input.carId,
        amount: input.amount,
        date: input.saleDate,
        method: input.method,
        bank: input.bank,
        type: "SALE",
      }),
    });
  });

  it("does not create duplicate income when another request already sold the car", async () => {
    const tx = {
      car: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      rentalAgreement: { updateMany: vi.fn() },
      payment: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(recordCarSale(tx, saleInput())).rejects.toBeInstanceOf(CarAlreadySoldError);
    expect(tx.rentalAgreement.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
