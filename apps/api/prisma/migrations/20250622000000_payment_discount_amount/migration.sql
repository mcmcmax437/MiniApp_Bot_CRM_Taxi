-- Add a per-payment discount field.
--
-- Before this change a discount was recorded as a separate Payment row
-- with `type = 'DISCOUNT'`. The owner had to create one extra entry per
-- cash event just to note that the rent was reduced (e.g. the car was
-- inactive for two days, so 300 out of 700 was waived).
--
-- The new `discountAmount` column on the Payment table lets the owner
-- attach the discount to the same Payment row they already use for the
-- RENT (or DEPOSIT) they actually received, so the cash-event flow
-- stays a single record. The balance calculation honours both:
--
--   * `Payment.discountAmount` on any payment row (new behaviour), and
--   * rows where `Payment.type = 'DISCOUNT'` (legacy data).
--
-- The column is non-nullable with a default of 0 so existing rows
-- backfill cleanly without a data migration.
ALTER TABLE `Payment`
  ADD COLUMN `discountAmount` DOUBLE NOT NULL DEFAULT 0;