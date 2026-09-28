import { describe, expect, it, vi } from "vitest";
import {
  createPurchase,
  listPurchasesForUser,
  getPurchaseForUser,
} from "../src/modules/receipts/purchase.service.js";

describe("createPurchase", () => {
  it("creates a purchase with its items in one call", async () => {
    const create = vi.fn().mockResolvedValue({ id: "p1", items: [] });
    const prisma = { purchase: { create } } as any;

    await createPurchase(prisma, "user-1", {
      retailerName: "Shoprite",
      totalAmount: 140.46,
      source: "RECEIPT_SCAN",
      items: [{ name: "Milk", price: 21.99 }],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          retailerName: "Shoprite",
          totalAmount: 140.46,
          source: "RECEIPT_SCAN",
          items: { create: [{ name: "Milk", price: 21.99, matchedPromotionName: null, paidPromoPrice: null }] },
        }),
      }),
    );
  });

  it("defaults optional fields to null rather than leaving them undefined", async () => {
    const create = vi.fn().mockResolvedValue({ id: "p1", items: [] });
    const prisma = { purchase: { create } } as any;

    await createPurchase(prisma, "user-1", {
      source: "MANUAL",
      items: [{ name: "Bread", price: 15.99 }],
    });

    const data = create.mock.calls[0]![0].data;
    expect(data.retailerName).toBeNull();
    expect(data.totalAmount).toBeNull();
  });

  it("carries promotion-match metadata through to each item", async () => {
    const create = vi.fn().mockResolvedValue({ id: "p1", items: [] });
    const prisma = { purchase: { create } } as any;

    await createPurchase(prisma, "user-1", {
      source: "RECEIPT_SCAN",
      items: [
        { name: "Milk", price: 18.99, matchedPromotionName: "Full Cream Milk 1L", paidPromoPrice: true },
      ],
    });

    const items = create.mock.calls[0]![0].data.items.create;
    expect(items[0]).toEqual({
      name: "Milk",
      price: 18.99,
      matchedPromotionName: "Full Cream Milk 1L",
      paidPromoPrice: true,
    });
  });
});

describe("listPurchasesForUser", () => {
  it("scopes to the given user, newest first, with items included", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { purchase: { findMany } } as any;

    await listPurchasesForUser(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { purchasedAt: "desc" },
      take: 50,
      include: { items: true },
    });
  });
});

describe("getPurchaseForUser", () => {
  it("scopes lookup to both the purchase id AND the owning user (can't fetch someone else's purchase)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { purchase: { findFirst } } as any;

    await getPurchaseForUser(prisma, "user-1", "purchase-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "purchase-1", userId: "user-1" },
      include: { items: true },
    });
  });
});
