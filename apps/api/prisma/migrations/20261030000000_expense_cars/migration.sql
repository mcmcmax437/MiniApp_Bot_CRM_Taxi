-- Link one expense to more than one car. Existing rows keep their single car.
CREATE TABLE `ExpenseCar` (
    `expenseId` VARCHAR(191) NOT NULL,
    `carId` VARCHAR(191) NOT NULL,

    INDEX `ExpenseCar_carId_idx`(`carId`),
    PRIMARY KEY (`expenseId`, `carId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ExpenseCar` ADD CONSTRAINT `ExpenseCar_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ExpenseCar` ADD CONSTRAINT `ExpenseCar_carId_fkey` FOREIGN KEY (`carId`) REFERENCES `Car`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `ExpenseCar` (`expenseId`, `carId`)
SELECT `id`, `carId` FROM `Expense` WHERE `carId` IS NOT NULL;
