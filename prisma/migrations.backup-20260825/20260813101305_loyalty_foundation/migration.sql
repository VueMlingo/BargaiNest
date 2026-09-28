-- CreateEnum
CREATE TYPE "LoyaltyAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LoyaltyCardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'REPLACED');

-- CreateEnum
CREATE TYPE "LoyaltyActivityType" AS ENUM ('EARN', 'REDEEM', 'BONUS', 'ADJUSTMENT', 'EXPIRY', 'REVERSAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('POINTS', 'DISCOUNT', 'VOUCHER', 'CASHBACK', 'BENEFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "membershipNumber" TEXT,
    "pointsBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT DEFAULT 'ZAR',
    "status" "LoyaltyAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_cards" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "cardNumber" TEXT,
    "barcodeValue" TEXT,
    "barcodeType" TEXT,
    "status" "LoyaltyCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_activities" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" "LoyaltyActivityType" NOT NULL,
    "pointsDelta" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" DECIMAL(65,30),
    "currency" TEXT DEFAULT 'ZAR',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyalty_accounts_userId_idx" ON "loyalty_accounts"("userId");

-- CreateIndex
CREATE INDEX "loyalty_accounts_loyaltyProgramId_idx" ON "loyalty_accounts"("loyaltyProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_loyaltyProgramId_membershipNumber_key" ON "loyalty_accounts"("loyaltyProgramId", "membershipNumber");

-- CreateIndex
CREATE INDEX "loyalty_cards_loyaltyAccountId_idx" ON "loyalty_cards"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "loyalty_cards_cardNumber_idx" ON "loyalty_cards"("cardNumber");

-- CreateIndex
CREATE INDEX "loyalty_activities_loyaltyAccountId_idx" ON "loyalty_activities"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "loyalty_activities_occurredAt_idx" ON "loyalty_activities"("occurredAt");

-- CreateIndex
CREATE INDEX "loyalty_activities_type_idx" ON "loyalty_activities"("type");

-- CreateIndex
CREATE INDEX "rewards_loyaltyAccountId_idx" ON "rewards"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "rewards_status_idx" ON "rewards"("status");

-- CreateIndex
CREATE INDEX "rewards_expiresAt_idx" ON "rewards"("expiresAt");

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_activities" ADD CONSTRAINT "loyalty_activities_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
