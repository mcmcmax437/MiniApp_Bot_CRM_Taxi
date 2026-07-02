-- Replace optional payer text with a paid-by-father flag (informational only, no settlement).
ALTER TABLE `Expense` ADD COLUMN `paidByFather` BOOLEAN NOT NULL DEFAULT false;

UPDATE `Expense`
SET `paidByFather` = true
WHERE `payer` IS NOT NULL
  AND LOWER(TRIM(`payer`)) IN ('father', 'dad', 'тато', 'батько', 'отец', 'папа');

ALTER TABLE `Expense` DROP COLUMN `payer`;
