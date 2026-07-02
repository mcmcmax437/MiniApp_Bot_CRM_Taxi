-- Replace optional payer text with a paid-by-father flag (informational only, no settlement).
ALTER TABLE `Expense` ADD COLUMN `paidByFather` BOOLEAN NOT NULL DEFAULT false;
