-- CreateTable
CREATE TABLE `wallet_vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NULL,
    `retailerName` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NOT NULL,
    `barcodeFormat` VARCHAR(191) NULL,
    `value` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'REDEEMED') NOT NULL DEFAULT 'ACTIVE',
    `redeemedAt` DATETIME(3) NULL,
    `sourcePurchaseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `wallet_vouchers_userId_idx`(`userId`),
    INDEX `wallet_vouchers_status_idx`(`status`),
    INDEX `wallet_vouchers_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wallet_vouchers` ADD CONSTRAINT `wallet_vouchers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_vouchers` ADD CONSTRAINT `wallet_vouchers_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_vouchers` ADD CONSTRAINT `wallet_vouchers_sourcePurchaseId_fkey` FOREIGN KEY (`sourcePurchaseId`) REFERENCES `purchases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
