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
