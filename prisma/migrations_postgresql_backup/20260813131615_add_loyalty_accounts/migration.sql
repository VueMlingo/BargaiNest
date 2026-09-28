/*
  Warnings:

  - You are about to drop the column `currency` on the `loyalty_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `membershipNumber` on the `loyalty_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `loyalty_activities` table. All the data in the column will be lost.
  - You are about to drop the column `pointsDelta` on the `loyalty_activities` table. All the data in the column will be lost.
  - You are about to drop the column `barcodeType` on the `loyalty_cards` table. All the data in the column will be lost.
  - You are about to drop the column `barcodeValue` on the `loyalty_cards` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `rewards` table. All the data in the column will be lost.
  - You are about to drop the column `issuedAt` on the `rewards` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `rewards` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `rewards` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `shopping_list_items` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `shopping_list_items` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `shopping_list_items` table. All the data in the column will be lost.
  - You are about to drop the column `productCode` on the `shopping_list_items` table. All the data in the column will be lost.
  - You are about to drop the column `purchased` on the `shopping_list_items` table. All the data in the column will be lost.
  - You are about to drop the `purchase_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_transactions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,loyaltyProgramId]` on the table `loyalty_accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cardNumber]` on the table `loyalty_cards` will be added. If there are existing duplicate values, this will fail.
  - Made the column `cardNumber` on table `loyalty_cards` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `title` to the `rewards` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `shopping_list_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductIdentifierType" AS ENUM ('SKU', 'BARCODE', 'GTIN', 'PLU', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ShoppingListItemStatus" AS ENUM ('ACTIVE', 'PURCHASED', 'REMOVED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntelligenceSignalType" AS ENUM ('PRICE', 'PURCHASE', 'LOYALTY', 'REWARD', 'SHOPPING', 'SAVING', 'PREFERENCE', 'BEHAVIOUR', 'RETAILER', 'PRODUCT', 'OTHER');

-- CreateEnum
CREATE TYPE "IntelligenceSignalStatus" AS ENUM ('ACTIVE', 'PROCESSED', 'EXPIRED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('BETTER_PRICE', 'LOYALTY_BENEFIT', 'REWARD', 'BASKET_SAVING', 'PRODUCT_SUBSTITUTION', 'RETAILER_COMPARISON', 'SHOPPING_OPTIMISATION', 'PRICE_DROP', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('PRODUCT', 'RETAILER', 'OFFER', 'LOYALTY', 'SAVING', 'SHOPPING_LIST', 'BASKET', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('GENERATED', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "IntelligenceEventType" AS ENUM ('SIGNAL_CREATED', 'SIGNAL_PROCESSED', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_VIEWED', 'OPPORTUNITY_ACCEPTED', 'OPPORTUNITY_DISMISSED', 'RECOMMENDATION_CREATED', 'RECOMMENDATION_VIEWED', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_DISMISSED', 'OTHER');

-- DropForeignKey
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_transactions" DROP CONSTRAINT "purchase_transactions_loyaltyAccountId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_transactions" DROP CONSTRAINT "purchase_transactions_retailerBranchId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_transactions" DROP CONSTRAINT "purchase_transactions_retailerId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_transactions" DROP CONSTRAINT "purchase_transactions_userId_fkey";

-- DropIndex
DROP INDEX "loyalty_accounts_loyaltyProgramId_membershipNumber_key";

-- DropIndex
DROP INDEX "loyalty_activities_type_idx";

-- DropIndex
DROP INDEX "loyalty_cards_cardNumber_idx";

-- DropIndex
DROP INDEX "rewards_expiresAt_idx";

-- DropIndex
DROP INDEX "shopping_list_items_category_idx";

-- DropIndex
DROP INDEX "shopping_list_items_productCode_idx";

-- AlterTable
ALTER TABLE "loyalty_accounts" DROP COLUMN "currency",
DROP COLUMN "membershipNumber",
ADD COLUMN     "accountNumber" TEXT;

-- AlterTable
ALTER TABLE "loyalty_activities" DROP COLUMN "metadata",
DROP COLUMN "pointsDelta",
ADD COLUMN     "points" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "loyalty_cards" DROP COLUMN "barcodeType",
DROP COLUMN "barcodeValue",
ALTER COLUMN "cardNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "rewards" DROP COLUMN "currency",
DROP COLUMN "issuedAt",
DROP COLUMN "metadata",
DROP COLUMN "name",
ADD COLUMN     "pointsRequired" DECIMAL(65,30),
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shopping_list_items" DROP COLUMN "category",
DROP COLUMN "name",
DROP COLUMN "priority",
DROP COLUMN "productCode",
DROP COLUMN "purchased",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "status" "ShoppingListItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "shopping_lists" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "purchase_items";

-- DropTable
DROP TABLE "purchase_transactions";

-- DropEnum
DROP TYPE "PurchaseSource";

-- DropEnum
DROP TYPE "ShoppingItemPriority";

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_identifiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ProductIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_retailers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "retailerSku" TEXT,
    "currentPrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailerId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "transactionReference" TEXT,
    "subtotal" DECIMAL(65,30),
    "discount" DECIMAL(65,30),
    "total" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_transaction_items" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30),
    "discount" DECIMAL(65,30),
    "totalPrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_signals" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT,
    "retailerId" TEXT,
    "type" "IntelligenceSignalType" NOT NULL,
    "status" "IntelligenceSignalStatus" NOT NULL DEFAULT 'ACTIVE',
    "signalKey" TEXT NOT NULL,
    "value" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "metadata" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_opportunities" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT,
    "retailerId" TEXT,
    "type" "OpportunityType" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedSaving" DECIMAL(65,30),
    "currentPrice" DECIMAL(65,30),
    "alternativePrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "score" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "retailerId" TEXT,
    "type" "RecommendationType" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'GENERATED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "score" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "reason" TEXT,
    "metadata" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "IntelligenceEventType" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "product_identifiers_productId_idx" ON "product_identifiers"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_identifiers_type_value_key" ON "product_identifiers"("type", "value");

-- CreateIndex
CREATE INDEX "product_retailers_retailerId_idx" ON "product_retailers"("retailerId");

-- CreateIndex
CREATE UNIQUE INDEX "product_retailers_productId_retailerId_key" ON "product_retailers"("productId", "retailerId");

-- CreateIndex
CREATE INDEX "price_observations_productId_observedAt_idx" ON "price_observations"("productId", "observedAt");

-- CreateIndex
CREATE INDEX "price_observations_retailerId_observedAt_idx" ON "price_observations"("retailerId", "observedAt");

-- CreateIndex
CREATE INDEX "shopping_transactions_userId_purchasedAt_idx" ON "shopping_transactions"("userId", "purchasedAt");

-- CreateIndex
CREATE INDEX "shopping_transactions_retailerId_purchasedAt_idx" ON "shopping_transactions"("retailerId", "purchasedAt");

-- CreateIndex
CREATE INDEX "shopping_transaction_items_transactionId_idx" ON "shopping_transaction_items"("transactionId");

-- CreateIndex
CREATE INDEX "shopping_transaction_items_productId_idx" ON "shopping_transaction_items"("productId");

-- CreateIndex
CREATE INDEX "intelligence_signals_userId_type_idx" ON "intelligence_signals"("userId", "type");

-- CreateIndex
CREATE INDEX "intelligence_signals_productId_type_idx" ON "intelligence_signals"("productId", "type");

-- CreateIndex
CREATE INDEX "intelligence_signals_retailerId_type_idx" ON "intelligence_signals"("retailerId", "type");

-- CreateIndex
CREATE INDEX "intelligence_signals_status_idx" ON "intelligence_signals"("status");

-- CreateIndex
CREATE INDEX "intelligence_signals_signalKey_idx" ON "intelligence_signals"("signalKey");

-- CreateIndex
CREATE INDEX "intelligence_opportunities_userId_status_idx" ON "intelligence_opportunities"("userId", "status");

-- CreateIndex
CREATE INDEX "intelligence_opportunities_productId_type_idx" ON "intelligence_opportunities"("productId", "type");

-- CreateIndex
CREATE INDEX "intelligence_opportunities_retailerId_type_idx" ON "intelligence_opportunities"("retailerId", "type");

-- CreateIndex
CREATE INDEX "intelligence_opportunities_status_idx" ON "intelligence_opportunities"("status");

-- CreateIndex
CREATE INDEX "intelligence_opportunities_detectedAt_idx" ON "intelligence_opportunities"("detectedAt");

-- CreateIndex
CREATE INDEX "recommendations_userId_status_idx" ON "recommendations"("userId", "status");

-- CreateIndex
CREATE INDEX "recommendations_userId_type_idx" ON "recommendations"("userId", "type");

-- CreateIndex
CREATE INDEX "recommendations_productId_idx" ON "recommendations"("productId");

-- CreateIndex
CREATE INDEX "recommendations_retailerId_idx" ON "recommendations"("retailerId");

-- CreateIndex
CREATE INDEX "recommendations_generatedAt_idx" ON "recommendations"("generatedAt");

-- CreateIndex
CREATE INDEX "intelligence_events_userId_createdAt_idx" ON "intelligence_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "intelligence_events_type_createdAt_idx" ON "intelligence_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "intelligence_events_entityType_entityId_idx" ON "intelligence_events"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_userId_loyaltyProgramId_key" ON "loyalty_accounts"("userId", "loyaltyProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_cards_cardNumber_key" ON "loyalty_cards"("cardNumber");

-- CreateIndex
CREATE INDEX "shopping_list_items_productId_idx" ON "shopping_list_items"("productId");

-- AddForeignKey
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_retailers" ADD CONSTRAINT "product_retailers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_retailers" ADD CONSTRAINT "product_retailers_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_transactions" ADD CONSTRAINT "shopping_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_transactions" ADD CONSTRAINT "shopping_transactions_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_transaction_items" ADD CONSTRAINT "shopping_transaction_items_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "shopping_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_transaction_items" ADD CONSTRAINT "shopping_transaction_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_opportunities" ADD CONSTRAINT "intelligence_opportunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_opportunities" ADD CONSTRAINT "intelligence_opportunities_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_opportunities" ADD CONSTRAINT "intelligence_opportunities_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_events" ADD CONSTRAINT "intelligence_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
