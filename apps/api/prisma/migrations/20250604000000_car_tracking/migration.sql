-- AlterTable
ALTER TABLE `Car` ADD COLUMN `currentMileage` INTEGER NULL,
    ADD COLUMN `mileageUpdatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `OwnerReminderSettings` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `insuranceDaysBefore` VARCHAR(191) NOT NULL DEFAULT '14,7,3',
    `inspectionDaysBefore` VARCHAR(191) NOT NULL DEFAULT '7,3,1',
    `documentDaysBefore` VARCHAR(191) NOT NULL DEFAULT '14,7,3',
    `maintenanceDaysBefore` VARCHAR(191) NOT NULL DEFAULT '7,3,1',
    `weeklyMileageEnabled` BOOLEAN NOT NULL DEFAULT true,
    `weeklyMileageWeekday` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OwnerReminderSettings_ownerId_key`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarDocument` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `expiryDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarDocument_ownerId_idx`(`ownerId`),
    INDEX `CarDocument_carId_idx`(`carId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceRule` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `intervalKind` ENUM('DAYS', 'MONTHS', 'MILEAGE', 'YEARLY') NOT NULL,
    `intervalValue` INTEGER NOT NULL,
    `yearlyMonth` INTEGER NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastCompletedAt` DATETIME(3) NULL,
    `lastCompletedMileage` INTEGER NULL,
    `nextDueDate` DATETIME(3) NULL,
    `nextDueMileage` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceRule_ownerId_idx`(`ownerId`),
    INDEX `MaintenanceRule_carId_idx`(`carId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `completedAt` DATETIME(3) NOT NULL,
    `mileageAt` INTEGER NULL,
    `cost` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MaintenanceRecord_ownerId_idx`(`ownerId`),
    INDEX `MaintenanceRecord_carId_idx`(`carId`),
    INDEX `MaintenanceRecord_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MileageLog` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NULL,
    `odometer` INTEGER NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,
    `source` ENUM('MANUAL', 'WEEKLY', 'MAINTENANCE') NOT NULL DEFAULT 'MANUAL',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MileageLog_ownerId_idx`(`ownerId`),
    INDEX `MileageLog_carId_recordedAt_idx`(`carId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OwnerReminderSettings` ADD CONSTRAINT `OwnerReminderSettings_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarDocument` ADD CONSTRAINT `CarDocument_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarDocument` ADD CONSTRAINT `CarDocument_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRule` ADD CONSTRAINT `MaintenanceRule_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRule` ADD CONSTRAINT `MaintenanceRule_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRecord` ADD CONSTRAINT `MaintenanceRecord_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRecord` ADD CONSTRAINT `MaintenanceRecord_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceRecord` ADD CONSTRAINT `MaintenanceRecord_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `MaintenanceRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MileageLog` ADD CONSTRAINT `MileageLog_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MileageLog` ADD CONSTRAINT `MileageLog_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
