-- Company the car is given to on this rental (FLG or STA).
-- Existing contracts stay empty until edited.
ALTER TABLE `RentalAgreement` ADD COLUMN `company` ENUM('FLG', 'STA') NULL;
