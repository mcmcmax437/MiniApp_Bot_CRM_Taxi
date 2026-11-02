import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentBank, PaymentMethod } from "@taxi/shared";
import { CarAlreadySoldError, recordCarSale } from "./car-sale.js";

function payment(amount: number, day: string) {
  return {
    amount,
    saleDate: new Date(`${day}T12:00:00.000Z`),
    method: PaymentMethod.CASH,
    bank: PaymentBank.NONE,
    note: `Sale OP8645U ${amount}`,
  };
}

describe("recordCarSale", () => {
  it("books each split payment and stores the total sale price", async () => {
    const tx = {
      car: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      rentalAgreement: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      payment: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    } as unknown as Prisma.TransactionClient;

    await recordCarSale(tx, {
      ownerId: "owner1",
      carId: "car1",
      saleNote: "Sold to buyer",
      payments: [
        { ...payment(5_000, "2026-11-02"), method: PaymentMethod.CASH, bank: PaymentBank.NONE },
        { ...payment(7_500, "2026-11-10"), method: PaymentMethod.BANK, bank: PaymentBank.PKO },
      ],
    });

    expect(tx.car.updateMany).toHaveBeenCalledWith({
      where: { id: "car1", ownerId: "owner1", status: { not: "SOLD" } },
      data: {
        status: "SOLD",
        salePrice: 12_500,
        saleDate: new Date("2026-11-02T12:00:00.000Z"),
        saleNote: "Sold to buyer",
      },
    });
    expect(tx.payment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ amount: 5_000, type: "SALE", method: PaymentMethod.CASH }),
        expect.objectContaining({ amount: 7_500, type: "SALE", method: PaymentMethod.BANK, bank: PaymentBank.PKO }),
      ],
    });
  });

  it("does not create duplicate income when another request already sold the car", async () => {
    const tx = {
      car: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      rentalAgreement: { updateMany: vi.fn() },
      payment: { createMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      recordCarSale(tx, {
        ownerId: "owner1",
        carId: "car1",
        saleNote: null,
        payments: [payment(12_500, "2026-11-02")],
      }),
    ).rejects.toBeInstanceOf(CarAlreadySoldError);
    expect(tx.rentalAgreement.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.createMany).not.toHaveBeenCalled();
  });
});
