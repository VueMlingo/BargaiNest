import { describe, expect, it } from "vitest";
import { verifyReceiptAgainstPromotions } from "../src/modules/receipts/receipt-verification.service.js";
import type { Promotion } from "../src/modules/promotions/promotions.service.js";

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    retailerCode: "SHOPRITE",
    retailerName: "Shoprite",
    name: "Full Cream Milk 1L",
    price: 18.99,
    currency: "ZAR",
    promotionText: "Save R3",
    validFrom: null,
    validUntil: null,
    sourceUrl: "https://example.com",
    ...overrides,
  };
}

describe("verifyReceiptAgainstPromotions", () => {
  it("matches a purchased item to a current promotion by name, and confirms the promo price was paid", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "FULL CREAM MILK 1L", price: 18.99 }],
      [makePromotion({ name: "Full Cream Milk 1L", price: 18.99 })],
    );

    expect(result.matchedPromotions).toHaveLength(1);
    expect(result.matchedPromotions[0]!.paidPromoPrice).toBe(true);
    expect(result.unmatchedItems).toHaveLength(0);
  });

  it("flags when the item matches a promotion but the FULL price was paid, not the promo price", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "FULL CREAM MILK 1L", price: 24.99 }],
      [makePromotion({ name: "Full Cream Milk 1L", price: 18.99 })],
    );

    expect(result.matchedPromotions).toHaveLength(1);
    expect(result.matchedPromotions[0]!.paidPromoPrice).toBe(false);
  });

  it("allows a small price tolerance (OCR/rounding), not requiring an exact cent match", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "FULL CREAM MILK 1L", price: 19.0 }],
      [makePromotion({ name: "Full Cream Milk 1L", price: 18.99 })],
    );
    expect(result.matchedPromotions[0]!.paidPromoPrice).toBe(true);
  });

  it("does not match an unrelated item to a promotion", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "WHITE BREAD 700G", price: 15.99 }],
      [makePromotion({ name: "Full Cream Milk 1L", price: 18.99 })],
    );

    expect(result.matchedPromotions).toHaveLength(0);
    expect(result.unmatchedItems).toHaveLength(1);
  });

  it("picks the best match when multiple promotions could plausibly match", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "FULL CREAM MILK 1L", price: 18.99 }],
      [
        makePromotion({ name: "Milk", price: 10 }),
        makePromotion({ name: "Full Cream Milk 1L", price: 18.99 }),
      ],
    );

    expect(result.matchedPromotions).toHaveLength(1);
    expect(result.matchedPromotions[0]!.matchedPromotion.price).toBe(18.99);
  });

  it("returns everything unmatched when there are no current promotions at all", () => {
    const result = verifyReceiptAgainstPromotions(
      [{ name: "MILK", price: 20 }, { name: "BREAD", price: 15 }],
      [],
    );
    expect(result.matchedPromotions).toHaveLength(0);
    expect(result.unmatchedItems).toHaveLength(2);
  });

  it("handles an empty receipt without crashing", () => {
    const result = verifyReceiptAgainstPromotions([], [makePromotion()]);
    expect(result).toEqual({ matchedPromotions: [], unmatchedItems: [] });
  });
});
