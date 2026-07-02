-- Remove unused payer text column if the earlier draft migration was applied.
ALTER TABLE `Expense` DROP COLUMN `payer`;
