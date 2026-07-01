-- Allow owners to skip the weekly mileage report for the current week.
ALTER TABLE `OwnerReminderSettings` ADD COLUMN `weeklyMileageSkippedWeekStart` DATETIME(3) NULL;
