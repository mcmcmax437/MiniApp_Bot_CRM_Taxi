ALTER TABLE `Car`
  ADD COLUMN `tireFrontBrand` VARCHAR(191) NULL,
  ADD COLUMN `tireFrontSize` VARCHAR(32) NULL,
  ADD COLUMN `tireFrontSeason` ENUM('SUMMER', 'WINTER', 'ALL_SEASON') NULL,
  ADD COLUMN `tireFrontInstalledAt` DATETIME(3) NULL,
  ADD COLUMN `tireFrontNotes` VARCHAR(2000) NULL,
  ADD COLUMN `tireRearBrand` VARCHAR(191) NULL,
  ADD COLUMN `tireRearSize` VARCHAR(32) NULL,
  ADD COLUMN `tireRearSeason` ENUM('SUMMER', 'WINTER', 'ALL_SEASON') NULL,
  ADD COLUMN `tireRearInstalledAt` DATETIME(3) NULL,
  ADD COLUMN `tireRearNotes` VARCHAR(2000) NULL;

UPDATE `Car`
SET
  `tireFrontBrand` = `tireBrand`,
  `tireFrontSize` = `tireSize`,
  `tireFrontSeason` = `tireSeason`,
  `tireFrontInstalledAt` = `tireInstalledAt`,
  `tireFrontNotes` = `tireNotes`
WHERE
  `tireBrand` IS NOT NULL
  OR `tireSize` IS NOT NULL
  OR `tireSeason` IS NOT NULL
  OR `tireInstalledAt` IS NOT NULL
  OR `tireNotes` IS NOT NULL;
