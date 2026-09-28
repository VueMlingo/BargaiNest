-- CreateTable
CREATE TABLE `system_health` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_identifiers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('EMAIL', 'PHONE', 'EXTERNAL') NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_identifiers_userId_idx`(`userId`),
    UNIQUE INDEX `user_identifiers_type_value_key`(`type`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retailers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `retailers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retailer_branches` (
    `id` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `latitude` DECIMAL(65, 30) NULL,
    `longitude` DECIMAL(65, 30) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `retailer_branches_retailerId_idx`(`retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_programs` (
    `id` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `loyalty_programs_retailerId_idx`(`retailerId`),
    UNIQUE INDEX `loyalty_programs_retailerId_code_key`(`retailerId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `loyaltyProgramId` VARCHAR(191) NOT NULL,
    `pointsBalance` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `accountNumber` VARCHAR(191) NULL,

    INDEX `loyalty_accounts_userId_idx`(`userId`),
    INDEX `loyalty_accounts_loyaltyProgramId_idx`(`loyaltyProgramId`),
    UNIQUE INDEX `loyalty_accounts_userId_loyaltyProgramId_key`(`userId`, `loyaltyProgramId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_cards` (
    `id` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `cardNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'EXPIRED', 'REPLACED') NOT NULL DEFAULT 'ACTIVE',
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loyalty_cards_cardNumber_key`(`cardNumber`),
    INDEX `loyalty_cards_loyaltyAccountId_idx`(`loyaltyAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_activities` (
    `id` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `type` ENUM('EARN', 'REDEEM', 'BONUS', 'ADJUSTMENT', 'EXPIRY', 'REVERSAL', 'OTHER') NOT NULL,
    `reference` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `points` DECIMAL(65, 30) NOT NULL DEFAULT 0,

    INDEX `loyalty_activities_loyaltyAccountId_idx`(`loyaltyAccountId`),
    INDEX `loyalty_activities_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rewards` (
    `id` VARCHAR(191) NOT NULL,
    `loyaltyAccountId` VARCHAR(191) NOT NULL,
    `type` ENUM('POINTS', 'DISCOUNT', 'VOUCHER', 'CASHBACK', 'BENEFIT', 'OTHER') NOT NULL,
    `status` ENUM('AVAILABLE', 'REDEEMED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'AVAILABLE',
    `description` VARCHAR(191) NULL,
    `value` DECIMAL(65, 30) NULL,
    `expiresAt` DATETIME(3) NULL,
    `redeemedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `pointsRequired` DECIMAL(65, 30) NULL,
    `title` VARCHAR(191) NOT NULL,

    INDEX `rewards_loyaltyAccountId_idx`(`loyaltyAccountId`),
    INDEX `rewards_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `products_name_idx`(`name`),
    INDEX `products_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_identifiers` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `type` ENUM('SKU', 'BARCODE', 'GTIN', 'PLU', 'EXTERNAL') NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_identifiers_productId_idx`(`productId`),
    UNIQUE INDEX `product_identifiers_type_value_key`(`type`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_retailers` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `retailerSku` VARCHAR(191) NULL,
    `currentPrice` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_retailers_retailerId_idx`(`retailerId`),
    UNIQUE INDEX `product_retailers_productId_retailerId_key`(`productId`, `retailerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_observations` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(65, 30) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_observations_productId_observedAt_idx`(`productId`, `observedAt`),
    INDEX `price_observations_retailerId_observedAt_idx`(`retailerId`, `observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopping_lists` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `shopping_lists_userId_idx`(`userId`),
    INDEX `shopping_lists_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopping_list_items` (
    `id` VARCHAR(191) NOT NULL,
    `shoppingListId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL DEFAULT 1,
    `targetPrice` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'PURCHASED', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `shopping_list_items_shoppingListId_idx`(`shoppingListId`),
    INDEX `shopping_list_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopping_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NULL,
    `status` ENUM('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    `transactionReference` VARCHAR(191) NULL,
    `subtotal` DECIMAL(65, 30) NULL,
    `discount` DECIMAL(65, 30) NULL,
    `total` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `purchasedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shopping_transactions_userId_purchasedAt_idx`(`userId`, `purchasedAt`),
    INDEX `shopping_transactions_retailerId_purchasedAt_idx`(`retailerId`, `purchasedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopping_transaction_items` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(65, 30) NULL,
    `discount` DECIMAL(65, 30) NULL,
    `totalPrice` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shopping_transaction_items_transactionId_idx`(`transactionId`),
    INDEX `shopping_transaction_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intelligence_signals` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `retailerId` VARCHAR(191) NULL,
    `type` ENUM('PRICE', 'PURCHASE', 'LOYALTY', 'REWARD', 'SHOPPING', 'SAVING', 'PREFERENCE', 'BEHAVIOUR', 'RETAILER', 'PRODUCT', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'PROCESSED', 'EXPIRED', 'DISMISSED') NOT NULL DEFAULT 'ACTIVE',
    `signalKey` VARCHAR(191) NOT NULL,
    `value` DECIMAL(65, 30) NULL,
    `confidence` DECIMAL(65, 30) NULL,
    `metadata` JSON NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `intelligence_signals_userId_type_idx`(`userId`, `type`),
    INDEX `intelligence_signals_productId_type_idx`(`productId`, `type`),
    INDEX `intelligence_signals_retailerId_type_idx`(`retailerId`, `type`),
    INDEX `intelligence_signals_status_idx`(`status`),
    INDEX `intelligence_signals_signalKey_idx`(`signalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intelligence_opportunities` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `retailerId` VARCHAR(191) NULL,
    `type` ENUM('BETTER_PRICE', 'LOYALTY_BENEFIT', 'REWARD', 'BASKET_SAVING', 'PRODUCT_SUBSTITUTION', 'RETAILER_COMPARISON', 'SHOPPING_OPTIMISATION', 'PRICE_DROP', 'OTHER') NOT NULL,
    `status` ENUM('OPEN', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `estimatedSaving` DECIMAL(65, 30) NULL,
    `currentPrice` DECIMAL(65, 30) NULL,
    `alternativePrice` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `score` DECIMAL(65, 30) NULL,
    `confidence` DECIMAL(65, 30) NULL,
    `metadata` JSON NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `intelligence_opportunities_userId_status_idx`(`userId`, `status`),
    INDEX `intelligence_opportunities_productId_type_idx`(`productId`, `type`),
    INDEX `intelligence_opportunities_retailerId_type_idx`(`retailerId`, `type`),
    INDEX `intelligence_opportunities_status_idx`(`status`),
    INDEX `intelligence_opportunities_detectedAt_idx`(`detectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `retailerId` VARCHAR(191) NULL,
    `type` ENUM('PRODUCT', 'RETAILER', 'OFFER', 'LOYALTY', 'SAVING', 'SHOPPING_LIST', 'BASKET', 'OTHER') NOT NULL,
    `status` ENUM('GENERATED', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'COMPLETED') NOT NULL DEFAULT 'GENERATED',
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `score` DECIMAL(65, 30) NULL,
    `confidence` DECIMAL(65, 30) NULL,
    `reason` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `recommendations_userId_status_idx`(`userId`, `status`),
    INDEX `recommendations_userId_type_idx`(`userId`, `type`),
    INDEX `recommendations_productId_idx`(`productId`),
    INDEX `recommendations_retailerId_idx`(`retailerId`),
    INDEX `recommendations_generatedAt_idx`(`generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intelligence_events` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('SIGNAL_CREATED', 'SIGNAL_PROCESSED', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_VIEWED', 'OPPORTUNITY_ACCEPTED', 'OPPORTUNITY_DISMISSED', 'RECOMMENDATION_CREATED', 'RECOMMENDATION_VIEWED', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_DISMISSED', 'OTHER') NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `intelligence_events_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `intelligence_events_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `intelligence_events_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_identifiers` ADD CONSTRAINT `user_identifiers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `retailer_branches` ADD CONSTRAINT `retailer_branches_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_programs` ADD CONSTRAINT `loyalty_programs_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_accounts` ADD CONSTRAINT `loyalty_accounts_loyaltyProgramId_fkey` FOREIGN KEY (`loyaltyProgramId`) REFERENCES `loyalty_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_accounts` ADD CONSTRAINT `loyalty_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_cards` ADD CONSTRAINT `loyalty_cards_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_activities` ADD CONSTRAINT `loyalty_activities_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rewards` ADD CONSTRAINT `rewards_loyaltyAccountId_fkey` FOREIGN KEY (`loyaltyAccountId`) REFERENCES `loyalty_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_identifiers` ADD CONSTRAINT `product_identifiers_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_retailers` ADD CONSTRAINT `product_retailers_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_retailers` ADD CONSTRAINT `product_retailers_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_observations` ADD CONSTRAINT `price_observations_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_observations` ADD CONSTRAINT `price_observations_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_lists` ADD CONSTRAINT `shopping_lists_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_list_items` ADD CONSTRAINT `shopping_list_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_list_items` ADD CONSTRAINT `shopping_list_items_shoppingListId_fkey` FOREIGN KEY (`shoppingListId`) REFERENCES `shopping_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_transactions` ADD CONSTRAINT `shopping_transactions_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_transactions` ADD CONSTRAINT `shopping_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_transaction_items` ADD CONSTRAINT `shopping_transaction_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_transaction_items` ADD CONSTRAINT `shopping_transaction_items_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `shopping_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_signals` ADD CONSTRAINT `intelligence_signals_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_signals` ADD CONSTRAINT `intelligence_signals_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_signals` ADD CONSTRAINT `intelligence_signals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_opportunities` ADD CONSTRAINT `intelligence_opportunities_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_opportunities` ADD CONSTRAINT `intelligence_opportunities_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_opportunities` ADD CONSTRAINT `intelligence_opportunities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intelligence_events` ADD CONSTRAINT `intelligence_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
