-- Simplify payment methods: card/bank/other → bank
UPDATE `Payment` SET `method` = 'BANK' WHERE `method` IN ('CARD', 'OTHER');
ALTER TABLE `Payment` MODIFY `method` ENUM('CASH', 'BANK') NOT NULL DEFAULT 'CASH';

-- Partner-paid expenses awaiting settlement
ALTER TABLE `Expense` ADD COLUMN `paidByPartner` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Expense` ADD COLUMN `partnerSettled` BOOLEAN NOT NULL DEFAULT false;
