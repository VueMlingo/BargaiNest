-- AlterTable
ALTER TABLE `wallet_vouchers`
  ADD COLUMN `voucherNumber` VARCHAR(191) NULL,
  ADD COLUMN `validFrom` DATETIME(3) NULL;
