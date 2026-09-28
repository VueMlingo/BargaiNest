-- AlterTable
ALTER TABLE `price_observations` ADD COLUMN `catalogueItemId` VARCHAR(191) NULL,
    ADD COLUMN `channel` ENUM('PHYSICAL_CATALOGUE', 'ONLINE_STORE', 'DELIVERY_APP', 'API', 'FEED', 'OTHER') NULL,
    ADD COLUMN `confidence` DECIMAL(65, 30) NULL,
    ADD COLUMN `extractionMethod` ENUM('STRUCTURED', 'PDF_TEXT', 'PDF_OCR', 'WEB_PARSER', 'API', 'FEED', 'MANUAL_REVIEW') NULL,
    ADD COLUMN `isPromotion` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `promotionText` VARCHAR(191) NULL,
    ADD COLUMN `sourceReference` VARCHAR(191) NULL,
    ADD COLUMN `validFrom` DATETIME(3) NULL,
    ADD COLUMN `validUntil` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `catalogue_sources` (
    `id` VARCHAR(191) NOT NULL,
    `retailerId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `channel` ENUM('PHYSICAL_CATALOGUE', 'ONLINE_STORE', 'DELIVERY_APP', 'API', 'FEED', 'OTHER') NOT NULL,
    `sourceType` ENUM('WEB_PAGE', 'PDF', 'API', 'JSON_FEED', 'CSV_FEED', 'OTHER') NOT NULL,
    `sourceUrl` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `schedule` VARCHAR(191) NULL,
    `adapterKey` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `storeCode` VARCHAR(191) NULL,
    `sourcePriority` INTEGER NOT NULL DEFAULT 100,
    `lastSuccessfulRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `catalogue_sources_code_key`(`code`),
    INDEX `catalogue_sources_retailerId_idx`(`retailerId`),
    INDEX `catalogue_sources_channel_idx`(`channel`),
    INDEX `catalogue_sources_sourceType_idx`(`sourceType`),
    INDEX `catalogue_sources_active_idx`(`active`),
    INDEX `catalogue_sources_countryCode_idx`(`countryCode`),
    INDEX `catalogue_sources_province_idx`(`province`),
    INDEX `catalogue_sources_city_idx`(`city`),
    INDEX `catalogue_sources_storeCode_idx`(`storeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalogue_runs` (
    `id` VARCHAR(191) NOT NULL,
    `catalogueSourceId` VARCHAR(191) NOT NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `retrievedAt` DATETIME(3) NULL,
    `sourceVersion` VARCHAR(191) NULL,
    `sourceChecksum` VARCHAR(191) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `itemsDiscovered` INTEGER NOT NULL DEFAULT 0,
    `itemsProcessed` INTEGER NOT NULL DEFAULT 0,
    `itemsMatched` INTEGER NOT NULL DEFAULT 0,
    `itemsUnmatched` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `catalogue_runs_catalogueSourceId_startedAt_idx`(`catalogueSourceId`, `startedAt`),
    INDEX `catalogue_runs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalogue_items` (
    `id` VARCHAR(191) NOT NULL,
    `catalogueRunId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `retailerSku` VARCHAR(191) NULL,
    `gtin` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `rawName` VARCHAR(191) NOT NULL,
    `normalizedName` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `packSize` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `price` DECIMAL(65, 30) NULL,
    `wasPrice` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ZAR',
    `isPromotion` BOOLEAN NOT NULL DEFAULT false,
    `promotionText` VARCHAR(191) NULL,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `extractionMethod` ENUM('STRUCTURED', 'PDF_TEXT', 'PDF_OCR', 'WEB_PARSER', 'API', 'FEED', 'MANUAL_REVIEW') NOT NULL,
    `extractionConfidence` DECIMAL(65, 30) NULL,
    `rawData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `catalogue_items_catalogueRunId_idx`(`catalogueRunId`),
    INDEX `catalogue_items_externalId_idx`(`externalId`),
    INDEX `catalogue_items_retailerSku_idx`(`retailerSku`),
    INDEX `catalogue_items_gtin_idx`(`gtin`),
    INDEX `catalogue_items_barcode_idx`(`barcode`),
    INDEX `catalogue_items_normalizedName_idx`(`normalizedName`),
    INDEX `catalogue_items_validUntil_idx`(`validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalogue_item_product_matches` (
    `id` VARCHAR(191) NOT NULL,
    `catalogueItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `confidence` DECIMAL(65, 30) NOT NULL,
    `method` ENUM('GTIN', 'BARCODE', 'RETAILER_SKU', 'EXACT_NAME', 'NORMALIZED_NAME', 'BRAND_NAME_SIZE', 'FUZZY', 'SEMANTIC', 'MANUAL') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `status` ENUM('PROPOSED', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PROPOSED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `catalogue_item_product_matches_productId_idx`(`productId`),
    INDEX `catalogue_item_product_matches_confidence_idx`(`confidence`),
    INDEX `catalogue_item_product_matches_status_idx`(`status`),
    UNIQUE INDEX `catalogue_item_product_matches_catalogueItemId_productId_key`(`catalogueItemId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `price_observations_catalogueItemId_idx` ON `price_observations`(`catalogueItemId`);

-- CreateIndex
CREATE INDEX `price_observations_validUntil_idx` ON `price_observations`(`validUntil`);

-- AddForeignKey
ALTER TABLE `price_observations` ADD CONSTRAINT `price_observations_catalogueItemId_fkey` FOREIGN KEY (`catalogueItemId`) REFERENCES `catalogue_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_sources` ADD CONSTRAINT `catalogue_sources_retailerId_fkey` FOREIGN KEY (`retailerId`) REFERENCES `retailers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_runs` ADD CONSTRAINT `catalogue_runs_catalogueSourceId_fkey` FOREIGN KEY (`catalogueSourceId`) REFERENCES `catalogue_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_items` ADD CONSTRAINT `catalogue_items_catalogueRunId_fkey` FOREIGN KEY (`catalogueRunId`) REFERENCES `catalogue_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_item_product_matches` ADD CONSTRAINT `catalogue_item_product_matches_catalogueItemId_fkey` FOREIGN KEY (`catalogueItemId`) REFERENCES `catalogue_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_item_product_matches` ADD CONSTRAINT `catalogue_item_product_matches_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

