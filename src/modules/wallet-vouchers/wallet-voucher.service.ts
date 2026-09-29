import type { PrismaClient } from "@prisma/client";

export interface CreateWalletVoucherInput {
  retailerName: string;
  barcode: string;
  barcodeFormat?: string | null;
  voucherNumber?: string | null;
  value: number;
  currency?: string;
  validFrom?: Date | null;
  expiresAt?: Date | null;
  sourcePurchaseId?: string | null;
}

/**
 * The effective status a caller should actually treat a voucher as
 * having -- distinct from the stored `status` column. Expiry is
 * computed here, at read time, rather than by a background job (no
 * cron infrastructure in this pilot; same constraint already noted on
 * reward-expiry-check.service.ts). The stored column only ever
 * transitions ACTIVE -> REDEEMED explicitly; ACTIVE -> EXPIRED is
 * derived, never written back.
 */
export type WalletVoucherEffectiveStatus = "ACTIVE" | "REDEEMED" | "EXPIRED";

export function computeEffectiveStatus(
  storedStatus: "ACTIVE" | "REDEEMED",
  expiresAt: Date | null,
  now: Date = new Date(),
): WalletVoucherEffectiveStatus {
  if (storedStatus === "REDEEMED") return "REDEEMED";
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "ACTIVE";
}

/**
 * Best-effort match against the existing Retailer table, purely for
 * consistent branding/display -- a miss here is not an error. Exact
 * match first, then a case-insensitive fallback, since a user typing
 * or a barcode scanner's associated name is unlikely to match the
 * stored Retailer.name's exact casing.
 */
async function findRetailerIdByName(
  prisma: PrismaClient,
  retailerName: string,
): Promise<string | null> {
  const exact = await prisma.retailer.findFirst({
    where: { name: retailerName },
    select: { id: true },
  });
  if (exact) return exact.id;

  const caseInsensitive = await prisma.retailer.findFirst({
    where: { name: { equals: retailerName, mode: "insensitive" } },
    select: { id: true },
  });
  return caseInsensitive?.id ?? null;
}

export async function createWalletVoucher(
  prisma: PrismaClient,
  userId: string,
  input: CreateWalletVoucherInput,
) {
  const retailerId = await findRetailerIdByName(prisma, input.retailerName);

  return prisma.walletVoucher.create({
    data: {
      userId,
      retailerId,
      retailerName: input.retailerName,
      barcode: input.barcode,
      barcodeFormat: input.barcodeFormat ?? null,
      voucherNumber: input.voucherNumber ?? null,
      value: input.value,
      currency: input.currency ?? "ZAR",
      validFrom: input.validFrom ?? null,
      expiresAt: input.expiresAt ?? null,
      sourcePurchaseId: input.sourcePurchaseId ?? null,
    },
  });
}

export async function listWalletVouchersForUser(prisma: PrismaClient, userId: string) {
  const vouchers = await prisma.walletVoucher.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
  });

  return vouchers.map((voucher) => ({
    ...voucher,
    effectiveStatus: computeEffectiveStatus(voucher.status, voucher.expiresAt),
  }));
}

export async function getWalletVoucherForUser(
  prisma: PrismaClient,
  userId: string,
  voucherId: string,
) {
  const voucher = await prisma.walletVoucher.findFirst({
    where: { id: voucherId, userId },
  });

  if (!voucher) return null;

  return {
    ...voucher,
    effectiveStatus: computeEffectiveStatus(voucher.status, voucher.expiresAt),
  };
}

export async function redeemWalletVoucher(
  prisma: PrismaClient,
  userId: string,
  voucherId: string,
) {
  const voucher = await prisma.walletVoucher.findFirst({
    where: { id: voucherId, userId },
  });

  if (!voucher) {
    throw new Error("WALLET_VOUCHER_NOT_FOUND");
  }

  const effectiveStatus = computeEffectiveStatus(voucher.status, voucher.expiresAt);

  if (effectiveStatus === "REDEEMED") {
    throw new Error("WALLET_VOUCHER_ALREADY_REDEEMED");
  }

  if (effectiveStatus === "EXPIRED") {
    throw new Error("WALLET_VOUCHER_EXPIRED");
  }

  return prisma.walletVoucher.update({
    where: { id: voucherId },
    data: { status: "REDEEMED", redeemedAt: new Date() },
  });
}
