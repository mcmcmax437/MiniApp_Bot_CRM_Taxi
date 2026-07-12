-- Allow fleet rentals before a full driver profile exists.
ALTER TABLE `RentalAgreement` ADD COLUMN `temporaryDriverName` VARCHAR(191) NULL;
ALTER TABLE `RentalAgreement` MODIFY `driverId` VARCHAR(191) NULL;
