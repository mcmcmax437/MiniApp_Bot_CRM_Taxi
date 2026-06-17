-- Expand note columns from VARCHAR(191) to MEDIUMTEXT so the application
-- can store free-form notes longer than 191 characters (the previous limit
-- matched the MySQL utf8mb4 / 191-byte default). The Zod schemas in
-- packages/shared allow up to 10000 characters for payment/expense notes
-- and 2000 for most other notes, so MEDIUMTEXT (16 MB) is more than enough.
ALTER TABLE `Car`             MODIFY COLUMN `notes` MEDIUMTEXT NULL;
ALTER TABLE `CarDocument`     MODIFY COLUMN `notes` MEDIUMTEXT NULL;
ALTER TABLE `MaintenanceRecord` MODIFY COLUMN `notes` MEDIUMTEXT NULL;
ALTER TABLE `MileageLog`      MODIFY COLUMN `note`  MEDIUMTEXT NULL;
ALTER TABLE `Driver`          MODIFY COLUMN `notes` MEDIUMTEXT NULL;
ALTER TABLE `RentalAgreement` MODIFY COLUMN `notes` MEDIUMTEXT NULL;
ALTER TABLE `Payment`         MODIFY COLUMN `note`  MEDIUMTEXT NULL;
ALTER TABLE `Expense`         MODIFY COLUMN `note`  MEDIUMTEXT NULL;
ALTER TABLE `Shift`           MODIFY COLUMN `note`  MEDIUMTEXT NULL;
