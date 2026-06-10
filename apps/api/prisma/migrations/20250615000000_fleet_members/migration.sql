-- Investor / viewer accounts: read-only access to a fleet, approved by the business owner.

CREATE TABLE `FleetMember` (
    `id` VARCHAR(191) NOT NULL,
    `fleetOwnerId` VARCHAR(191) NOT NULL,
    `telegramUserId` BIGINT NOT NULL,
    `name` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FleetMember_fleetOwnerId_idx`(`fleetOwnerId`),
    INDEX `FleetMember_telegramUserId_idx`(`telegramUserId`),
    UNIQUE INDEX `FleetMember_fleetOwnerId_telegramUserId_key`(`fleetOwnerId`, `telegramUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FleetMember` ADD CONSTRAINT `FleetMember_fleetOwnerId_fkey` FOREIGN KEY (`fleetOwnerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
