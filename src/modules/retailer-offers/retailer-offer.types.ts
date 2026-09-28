import type { ShoppingIntent } from "../shopping-intent/shopping-intent.types.js";
import type { CatalogueAvailabilityStatus } from "../retail-catalogue/retail-catalogue.types.js";

export type RetailerOfferSourceType =
  | "PUBLIC"
  | "API"
  | "FEED"
  | "OTHER";

export interface RetailerOfferRetailer {
  id: string;
  code: string;
  name: string;
}

export interface RetailerOfferSource {
  type: RetailerOfferSourceType;
  adapterKey: string;
  url?: string | null;
  observedAt: string;
}

export interface RetailerOffer {
  retailer: RetailerOfferRetailer;

  name: string;
  brand?: string | null;
  packSize?: string | null;
  unit?: string | null;
  category?: string | null;

  price: number;
  currency: string;

  wasPrice?: number | null;

  isPromotion: boolean;
  promotionText?: string | null;

  validFrom?: string | null;
  validUntil?: string | null;

  /*
   * Previously computed by the catalogue normalizer on every single
   * lookup (NormalizedCatalogueItem.availability, added in BN-016)
   * but silently dropped when building a RetailerOffer -- the exact
   * same "computed then discarded" pattern found repeatedly
   * elsewhere in this project. Best Basket Savings couldn't factor
   * in stock status because this field simply never reached it.
   * Defaults to "UNKNOWN" (not "IN_STOCK") when the mapper has no
   * source data -- assuming stock, absent real evidence, would be
   * actively worse than admitting uncertainty.
   */
  availability: CatalogueAvailabilityStatus;

  source: RetailerOfferSource;

  confidence: number;
}

export interface RetailerOfferLocation {
  countryCode?: string;
  province?: string;
  city?: string;
}

export interface RetailerOfferContext {
  retailerId: string;
  retailerCode?: string;
  retailerName?: string;

  intent: ShoppingIntent;

  location?: RetailerOfferLocation;
}

export interface MatchedOffer {
  offer: RetailerOffer;

  matchScore: number;

  matchQuality:
    | "EXACT"
    | "STRONG"
    | "GOOD"
    | "WEAK";

  matchReason: string;
}

export interface RetailerOfferSourceAdapter {
  readonly adapterKey: string;

  getOffers(
    context: RetailerOfferContext,
  ): Promise<RetailerOffer[]>;
}
