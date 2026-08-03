-- Bank parameter on income payments (which bank received a transfer).
-- Default NONE for existing rows and for cash / unset bank transfers.
ALTER TABLE `Payment` ADD COLUMN `bank` ENUM('NONE', 'PKO', 'CA') NOT NULL DEFAULT 'NONE';
