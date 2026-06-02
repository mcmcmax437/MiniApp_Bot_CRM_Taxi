import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const superAdminId = process.env.TELEGRAM_SUPERADMIN_ID;
  if (!superAdminId || superAdminId === "0") {
    console.log("TELEGRAM_SUPERADMIN_ID not set; skipping super-admin seed.");
    return;
  }

  const owner = await prisma.owner.upsert({
    where: { telegramUserId: BigInt(superAdminId) },
    update: { status: "ACTIVE" },
    create: {
      telegramUserId: BigInt(superAdminId),
      name: "Super Admin",
      status: "ACTIVE",
      locale: "uk",
    },
  });
  console.log(`Super-admin owner ready: ${owner.id}`);

  const existingCars = await prisma.car.count({ where: { ownerId: owner.id } });
  if (existingCars > 0) {
    console.log("Demo data already present; skipping.");
    return;
  }

  const car = await prisma.car.create({
    data: {
      ownerId: owner.id,
      plate: "AA1234BB",
      make: "Toyota",
      model: "Prius",
      year: 2020,
      status: "RENTED",
      insuranceExpiry: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      inspectionExpiry: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    },
  });

  const driver = await prisma.driver.create({
    data: {
      ownerId: owner.id,
      firstName: "Ivan",
      lastName: "Petrenko",
      fullName: "Ivan Petrenko",
      phone: "+380000000000",
    },
  });

  await prisma.rentalAgreement.create({
    data: {
      ownerId: owner.id,
      carId: car.id,
      driverId: driver.id,
      rentAmount: 25,
      depositAmount: 200,
      period: "DAILY",
      startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  await prisma.payment.create({
    data: {
      ownerId: owner.id,
      driverId: driver.id,
      carId: car.id,
      amount: 100,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      method: "CASH",
      type: "RENT",
    },
  });

  await prisma.expense.create({
    data: {
      ownerId: owner.id,
      carId: car.id,
      category: "FUEL",
      amount: 40,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      note: "Full tank",
    },
  });

  console.log("Demo data seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
