-- AlterTable
ALTER TABLE `Expense` MODIFY `category` ENUM('MAINTENANCE', 'REPAIR', 'INSURANCE', 'FUEL', 'TAX', 'OTHER', 'CAR_PURCHASE') NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE `CarPurchasePart` (
    `id` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `fleetAmount` DOUBLE NOT NULL,
    `note` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CarPurchasePart_carId_idx`(`carId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CarPurchasePart` ADD CONSTRAINT `CarPurchasePart_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
