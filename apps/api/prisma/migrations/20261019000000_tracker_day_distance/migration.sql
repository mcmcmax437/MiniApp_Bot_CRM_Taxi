-- Daily GPS distance (kilometres driven), separate from the manual odometer.
CREATE TABLE `TrackerDayDistance` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `day` DATETIME(3) NOT NULL,
    `distanceKm` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrackerDayDistance_ownerId_carId_idx`(`ownerId`, `carId`),
    UNIQUE INDEX `TrackerDayDistance_carId_day_key`(`carId`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TrackerDayDistance` ADD CONSTRAINT `TrackerDayDistance_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TrackerDayDistance` ADD CONSTRAINT `TrackerDayDistance_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
