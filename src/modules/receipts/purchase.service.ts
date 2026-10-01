import type { PrismaClient } from "@prisma/client";

export interface CreatePurchaseItemInput {
  name: string;
  price: number;
  matchedPromotionName?: string | null;
  paidPromoPrice?: boolean | null;
}

export interface CreatePurchaseInput {
  retailerName?: string | null;
  totalAmount?: number | null;
  purchasedAt?: Date;
  source: "RECEIPT_SCAN" | "MANUAL";
  items: CreatePurchaseItemInput[];
}

export async function createPurchase(
  prisma: PrismaClient,
  userId: string,
  input: CreatePurchaseInput,
) {
  return prisma.purchase.create({
    data: {
      userId,
      retailerName: input.retailerName ?? null,
      totalAmount: input.totalAmount ?? null,
      ...(input.purchasedAt ? { purchasedAt: input.purchasedAt } : {}),
      source: input.source,
      items: {
        create: input.items.map((item) => ({
          name: item.name,
          price: item.price,
          matchedPromotionName: item.matchedPromotionName ?? null,
          paidPromoPrice: item.paidPromoPrice ?? null,
        })),
      },
    },
    include: { items: true },
  });
}

export async function listPurchasesForUser(
  prisma: PrismaClient,
  userId: string,
  limit = 50,
) {
  return prisma.purchase.findMany({
    where: { userId },
    orderBy: { purchasedAt: "desc" },
    take: limit,
    include: { items: true },
  });
}

export async function getPurchaseForUser(
  prisma: PrismaClient,
  userId: string,
  purchaseId: string,
) {
  return prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    include: { items: true },
  });
}

/**
 * Deletes a purchase outright -- a receipt scanned/logged by mistake,
 * a duplicate entry, or simply something the user no longer wants in
 * their history. Ownership-scoped the same way every other mutation
 * here is. PurchaseItem already has `onDelete: Cascade` on its
 * relation to Purchase (see schema.prisma), so its line items are
 * removed automatically by the database -- no manual item cleanup
 * needed here.
 */
export async function deletePurchase(
  prisma: PrismaClient,
  userId: string,
  purchaseId: string,
): Promise<void> {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
  });

  if (!purchase) {
    throw new Error("PURCHASE_NOT_FOUND");
  }

  await prisma.purchase.delete({ where: { id: purchaseId } });
}
