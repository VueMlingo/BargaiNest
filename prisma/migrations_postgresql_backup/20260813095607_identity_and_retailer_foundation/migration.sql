-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserIdentifierType" AS ENUM ('EMAIL', 'PHONE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "RetailerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LoyaltyProgramStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identifiers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RetailerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_branches" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "status" "RetailerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "LoyaltyProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_identifiers_userId_idx" ON "user_identifiers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identifiers_type_value_key" ON "user_identifiers"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_code_key" ON "retailers"("code");

-- CreateIndex
CREATE INDEX "retailer_branches_retailerId_idx" ON "retailer_branches"("retailerId");

-- CreateIndex
CREATE INDEX "loyalty_programs_retailerId_idx" ON "loyalty_programs"("retailerId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_retailerId_code_key" ON "loyalty_programs"("retailerId", "code");

-- AddForeignKey
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_branches" ADD CONSTRAINT "retailer_branches_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
