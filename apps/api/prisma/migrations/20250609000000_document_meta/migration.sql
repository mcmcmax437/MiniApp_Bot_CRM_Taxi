-- Document metadata: car gallery flag, custom label, notes
ALTER TABLE `Document` ADD COLUMN `isCarPhoto` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Document` ADD COLUMN `displayName` VARCHAR(191) NULL;
ALTER TABLE `Document` ADD COLUMN `notes` TEXT NULL;

-- Existing car images were uploaded as gallery photos before the flag existed
UPDATE `Document`
SET `isCarPhoto` = true
WHERE `relatedType` = 'CAR'
  AND (
    `mimeType` LIKE 'image/%'
    OR `fileName` REGEXP '\\.(jpe?g|png|webp|gif|bmp|heic|heif)$'
  );
