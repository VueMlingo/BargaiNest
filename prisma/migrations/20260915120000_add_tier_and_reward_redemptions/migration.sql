-- AlterTable: add tier to loyalty_snapshots (previously fetched from
-- the provider on every sync but discarded, same pattern as
-- activities/rewards/vouchers/offers fixed in an earlier migration).
ALTER TABLE `loyalty_snapshots`
  ADD COLUMN `tier` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `reward_redemptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `kind` ENUM('REWARD', 'VOUCHER') NOT NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reward_redemptions_loyaltyAccountId_externalId_kind_key`(`loyaltyAccountId`, `externalId`, `kind`),
    INDEX `reward_redemptions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reward_redemptions` ADD CONSTRAINT `reward_redemptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_redemptions` ADD CONSTRAINT `reward_redemptions_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
