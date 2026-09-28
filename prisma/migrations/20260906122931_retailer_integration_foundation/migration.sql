-- CreateTable
CREATE TABLE `integrations` (
    `id` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DEVELOPMENT', 'DEPRECATED') NOT NULL DEFAULT 'DEVELOPMENT',
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `integrations_code_key`(`code`),
    INDEX `integrations_retailerId_idx`(`retailerId`),
    INDEX `integrations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retailer_connections` (
    `id` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED') NOT NULL DEFAULT 'PENDING',
    `externalAccountId` VARCHAR(191) NULL,
    `connectedAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `retailer_connections_loyaltyAccountId_idx`(`loyaltyAccountId`),
    INDEX `retailer_connections_integrationId_idx`(`integrationId`),
    INDEX `retailer_connections_status_idx`(`status`),
    UNIQUE INDEX `retailer_connections_loyaltyAccountId_integrationId_key`(`loyaltyAccountId`, `integrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(65, 30) NOT NULL DEFAULT 0.000000000000000000000000000000,
    `source` VARCHAR(191) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `observedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loyalty_snapshots_loyaltyAccountId_idx`(`loyaltyAccountId`),
    INDEX `loyalty_snapshots_observedAt_idx`(`observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retailer_connections` ADD CONSTRAINT `retailer_connections_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retailer_connections` ADD CONSTRAINT `retailer_connections_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `integrations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_snapshots` ADD CONSTRAINT `loyalty_snapshots_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
