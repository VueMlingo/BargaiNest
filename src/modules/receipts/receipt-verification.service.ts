import { tokenOverlap, tokenise } from "../retail-catalogue/retail-catalogue.matching.util.js";
import type { Promotion } from "../promotions/promotions.service.js";
import type { ParsedReceiptLineItem } from "./receipt-parser.service.js";

/**
 * "Promotion and rewards verification" (BN-044) turned out to mean
 * one honestly-buildable check, not two: there's no earning-rate
 * model anywhere in this schema (no "R10 spent = 1 point" rule) to
 * verify a reward against, so "rewards verification" folds into
 * promotion verification here -- a purchased item matching a current
 * promotion is itself the thing worth flagging, whether the framing
 * is "you got the discount" or "this may have earned a bonus". A
 * genuine separate rewards-earning check would need that rate model
 * to exist first.
 *
 * Reuses the exact same token-overlap matching already tested and
 * used throughout the retail-catalogue adapters (BN-015) rather than
 * inventing a second fuzzy-matching approach for receipts specifically.
 */

const MATCH_THRESHOLD = 0.5;
/** A paid price within this fraction of the promo price still counts
 *  as "matches the promotion" -- OCR price recognition and rounding
 *  mean an exact cent-for-cent match is an unreasonable bar. */
const PRICE_TOLERANCE_FRACTION = 0.05;

export interface ReceiptVerificationEntry {
  purchasedItem: ParsedReceiptLineItem;
  matchedPromotion: Promotion;
  paidPromoPrice: boolean;
}

export interface ReceiptVerificationResult {
  matchedPromotions: ReceiptVerificationEntry[];
  unmatchedItems: ParsedReceiptLineItem[];
}

function pricesRoughlyMatch(paid: number, promo: number): boolean {
  if (promo === 0) return paid === 0;
  return Math.abs(paid - promo) / promo <= PRICE_TOLERANCE_FRACTION;
}

export function verifyReceiptAgainstPromotions(
  items: ParsedReceiptLineItem[],
  promotions: Promotion[],
): ReceiptVerificationResult {
  const matchedPromotions: ReceiptVerificationEntry[] = [];
  const unmatchedItems: ParsedReceiptLineItem[] = [];

  for (const item of items) {
    const itemTokens = tokenise(item.name);

    let best: { promotion: Promotion; score: number } | null = null;
    for (const promotion of promotions) {
      const score = tokenOverlap(itemTokens, tokenise(promotion.name));
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { promotion, score };
      }
    }

    if (best) {
      matchedPromotions.push({
        purchasedItem: item,
        matchedPromotion: best.promotion,
        paidPromoPrice: pricesRoughlyMatch(item.price, best.promotion.price),
      });
    } else {
      unmatchedItems.push(item);
    }
  }

  return { matchedPromotions, unmatchedItems };
}
