-- Optional custom tag on expenses
ALTER TABLE `Expense` ADD COLUMN `tag` VARCHAR(64) NULL;

-- Payments may come from non-drivers (insurance, etc.)
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_driverId_fkey`;
ALTER TABLE `Payment` MODIFY `driverId` VARCHAR(191) NULL;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
