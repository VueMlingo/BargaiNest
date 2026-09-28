import type { CatalogueAvailabilityStatus } from "../retail-catalogue/retail-catalogue.types.js";

export interface ShoppingListValueItem {
  itemId: string;
  description: string;
  quantity: number;
  targetPrice: number | null;

  productId: string | null;
  productName: string | null;

  comparable: boolean;

  bestPrice: number | null;
  bestRetailerId: string | null;
  bestRetailerName: string | null;
  bestObservedAt: Date | null;
  bestCurrency: string | null;
  bestIsPromotion: boolean;
  bestPromotionText: string | null;
  /** "OUT_OF_STOCK" means this is the least-bad available price, not
   *  a genuinely purchasable one -- see the availability-aware
   *  selection logic in the service for why an out-of-stock offer can
   *  still end up here rather than being excluded entirely. */
  bestAvailability: CatalogueAvailabilityStatus | null;

  lineValue: number | null;
  potentialSaving: number | null;

  targetStatus:
    | "BELOW_TARGET"
    | "AT_TARGET"
    | "ABOVE_TARGET"
    | "NO_TARGET"
    | "NO_PRICE";

  confidence: number | null;
}

export interface ShoppingListRetailerBasket {
  retailerId: string;
  retailerName: string;
  itemCount: number;
  basketValue: number;
  currency: string;
  /** True when this retailer has a current compatible offer for
   *  EVERY comparable item on the list — i.e. the whole basket could
   *  genuinely be bought there in one trip. Partial baskets (missing
   *  one or more items) are still returned, not hidden, so a shopper
   *  can weigh "cheaper but incomplete" against "complete but pricier". */
  isComplete: boolean;
  missingItemCount: number;
}

export interface ShoppingListMixedBasketAssignment {
  itemId: string;
  description: string;
  retailerId: string;
  retailerName: string;
  unitPrice: number;
  quantity: number;
  lineValue: number;
}

export interface ShoppingListMixedBasket {
  /** The absolute cheapest way to buy every comparable item, picking
   *  the best price per item independently of which retailer it's
   *  at. Always at least as cheap as the best single-retailer
   *  basket — the real question for a shopper is whether the extra
   *  savings are worth visiting more than one store for. */
  totalValue: number;
  currency: string | null;
  retailerCount: number;
  assignments: ShoppingListMixedBasketAssignment[];
  /** How much cheaper the mixed basket is than the best COMPLETE
   *  single-retailer basket. Zero (not negative) when no complete
   *  basket exists to compare against, or when they're equal. */
  savingsVsBestCompleteBasket: number;
}

export interface ShoppingListValueSummary {
  itemsAnalysed: number;
  itemsWithoutProduct: number;
  itemsWithoutPrice: number;
  comparableItems: number;

  bestKnownBasketValue: number;
  potentialSavings: number;

  retailerBaskets: ShoppingListRetailerBasket[];
  cheapestRetailerId: string | null;
  cheapestRetailerName: string | null;
  highestRetailerBasketValue: number | null;
  basketSavings: number;

  /** The true optimal breakdown — buy each item at whichever retailer
   *  currently has it cheapest. null only when there are zero
   *  comparable items (nothing to build a basket from at all). */
  mixedBasket: ShoppingListMixedBasket | null;

  currency: string | null;
}

export interface ShoppingListValueResult {
  shoppingListId: string;
  shoppingListName: string;

  items: ShoppingListValueItem[];

  summary: ShoppingListValueSummary;
}
