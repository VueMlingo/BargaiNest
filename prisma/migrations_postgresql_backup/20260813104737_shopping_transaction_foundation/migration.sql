-- CreateEnum
CREATE TYPE "ShoppingListStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShoppingItemPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "PurchaseSource" AS ENUM ('MANUAL', 'RECEIPT', 'API', 'IMPORT', 'POS', 'OTHER');

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ShoppingListStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT,
    "category" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "targetPrice" DECIMAL(65,30),
    "priority" "ShoppingItemPriority" NOT NULL DEFAULT 'NORMAL',
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "retailerBranchId" TEXT,
    "loyaltyAccountId" TEXT,
    "transactionReference" TEXT,
    "transactionAt" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "savingsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "source" "PurchaseSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_lists_userId_idx" ON "shopping_lists"("userId");

-- CreateIndex
CREATE INDEX "shopping_lists_status_idx" ON "shopping_lists"("status");

-- CreateIndex
CREATE INDEX "shopping_list_items_shoppingListId_idx" ON "shopping_list_items"("shoppingListId");

-- CreateIndex
CREATE INDEX "shopping_list_items_productCode_idx" ON "shopping_list_items"("productCode");

-- CreateIndex
CREATE INDEX "shopping_list_items_category_idx" ON "shopping_list_items"("category");

-- CreateIndex
CREATE INDEX "purchase_transactions_userId_idx" ON "purchase_transactions"("userId");

-- CreateIndex
CREATE INDEX "purchase_transactions_retailerId_idx" ON "purchase_transactions"("retailerId");

-- CreateIndex
CREATE INDEX "purchase_transactions_retailerBranchId_idx" ON "purchase_transactions"("retailerBranchId");

-- CreateIndex
CREATE INDEX "purchase_transactions_loyaltyAccountId_idx" ON "purchase_transactions"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "purchase_transactions_transactionAt_idx" ON "purchase_transactions"("transactionAt");

-- CreateIndex
CREATE INDEX "purchase_transactions_source_idx" ON "purchase_transactions"("source");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_transactions_retailerId_transactionReference_key" ON "purchase_transactions"("retailerId", "transactionReference");

-- CreateIndex
CREATE INDEX "purchase_items_transactionId_idx" ON "purchase_items"("transactionId");

-- CreateIndex
CREATE INDEX "purchase_items_productCode_idx" ON "purchase_items"("productCode");

-- CreateIndex
CREATE INDEX "purchase_items_category_idx" ON "purchase_items"("category");

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_retailerBranchId_fkey" FOREIGN KEY ("retailerBranchId") REFERENCES "retailer_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "purchase_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
