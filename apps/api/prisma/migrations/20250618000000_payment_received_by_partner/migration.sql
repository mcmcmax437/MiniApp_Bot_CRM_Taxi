-- Track payments that were received by the business partner (instead of the owner)
-- and whether the partner has settled them back to the owner yet.
ALTER TABLE `Payment` ADD COLUMN `receivedByPartner` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Payment` ADD COLUMN `partnerSettled` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `Payment_ownerId_receivedByPartner_partnerSettled_idx` ON `Payment`(`ownerId`, `receivedByPartner`, `partnerSettled`);
