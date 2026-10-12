-- Reminder tag: the driver on this rental prefers to pay in cash.
ALTER TABLE `RentalAgreement` ADD COLUMN `paysCash` BOOLEAN NOT NULL DEFAULT false;
