-- Archive sold cars (status SOLD) and record the sale as income (PaymentType SALE).
ALTER TABLE `Car`
    ADD COLUMN `salePrice` DOUBLE NULL,
    ADD COLUMN `saleDate` DATETIME(3) NULL,
    ADD COLUMN `saleNote` MEDIUMTEXT NULL;

ALTER TABLE `Car`
    MODIFY `status` ENUM('AVAILABLE', 'RENTED', 'MAINTENANCE', 'INACTIVE', 'SOLD') NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE `Payment`
    MODIFY `type` ENUM('RENT', 'DEPOSIT', 'REFUND', 'FINE', 'DISCOUNT', 'SALE') NOT NULL DEFAULT 'RENT';
