/**
 * BN-016 — Canonical Retailer Offer Contract, v1.
 *
 * Formalizes the shape every retailer offer must have, regardless of
 * whether it came from a public specials page (Pilot) or an official
 * retailer API (Production) — matching the architecture already
 * described in the project's own planning: both paths converge on one
 * contract so BargaiNest never has to special-case a retailer's
 * origin downstream (matching, Best Basket, frontend display).
 *
 * This is additive, not a rewrite: `RetailerOffer` (retailer-offer.types.ts)
 * already covered most of this reasonably well. What was genuinely
 * missing, found by reading the actual pipeline code rather than
 * assuming:
 *   - Product identity (gtin/barcode/retailerSku) was captured by the
 *     catalogue layer but silently DROPPED when mapped to RetailerOffer
 *     — retailer-offer.mapper.ts never read those fields. Fixed here.
 *   - No availability/stock model existed anywhere in the pipeline.
 *     Added end-to-end (RawCatalogueItem → NormalizedCatalogueItem →
 *     canonical Offer), defaulting honestly to UNKNOWN rather than
 *     assuming in-stock.
 *   - No formal error taxonomy — adapter/lookup failures were ad hoc
 *     strings (e.g. "CHECKERS_DISCOVERY_EMPTY", HTTP status codes).
 *     Classified into a small stable set of OfferErrorCode values here.
 *   - No response envelope — callers got a loose object with an
 *     internal catalogue-lookup type leaking through
 *     (LiveRetailerOfferLookupResult.lookup). Formalized as OfferResponse.
 */

export const CANONICAL_OFFER_CONTRACT_VERSION = "1.0" as const;

// ---------------------------------------------------------------------------
// Product identity
// ---------------------------------------------------------------------------

/**
 * Identity signals for the product an offer is for. All optional
 * because no single retailer source reliably provides all of them —
 * that's *why* the resolver's matching layer supports multiple signal
 * types (GTIN, barcode, retailer SKU, fuzzy name) rather than requiring
 * one canonical identifier across all five+ retailers.
 */
export interface ProductIdentity {
  gtin?: string | null;
  barcode?: string | null;
  retailerSku?: string | null;
  name: string;
  brand?: string | null;
  packSize?: string | null;
  unit?: string | null;
  category?: string | null;
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export interface Price {
  amount: number;
  currency: string;
  /** Pre-promotion price, if this offer represents a discount. */
  wasAmount?: number | null;
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export interface Promotion {
  isPromotion: boolean;
  promotionText?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export type AvailabilityStatus = "IN_STOCK" | "OUT_OF_STOCK" | "LIMITED" | "UNKNOWN";

export interface Availability {
  status: AvailabilityStatus;
}

// ---------------------------------------------------------------------------
// Source & freshness metadata
// ---------------------------------------------------------------------------

export type OfferSourceType = "PUBLIC" | "API" | "FEED" | "OTHER";

export interface SourceMetadata {
  type: OfferSourceType;
  adapterKey: string;
  url?: string | null;
}

export interface FreshnessMetadata {
  observedAt: string;
  /** How long this observation should be trusted before a caller
   *  should treat it as stale and re-fetch rather than rely on it —
   *  e.g. for Best Basket calculations. Not enforced by this module;
   *  callers decide what to do with a stale offer. */
  staleAfterSeconds: number;
}

export function isOfferStale(freshness: FreshnessMetadata, now: Date = new Date()): boolean {
  const observedAtMs = Date.parse(freshness.observedAt);
  if (Number.isNaN(observedAtMs)) return true; // unparsable timestamp — treat as untrustworthy
  return now.getTime() - observedAtMs > freshness.staleAfterSeconds * 1000;
}

/** Default staleness budget per source type — a specials brochure is
 *  good for longer than a live product-page price, which can change
 *  same-day. Callers can override per use case. */
export const DEFAULT_STALE_AFTER_SECONDS: Record<OfferSourceType, number> = {
  PUBLIC: 60 * 60 * 24, // 24h — typical specials-brochure validity granularity
  API: 60 * 60, // 1h — official APIs are assumed closer to real-time
  FEED: 60 * 60 * 6, // 6h
  OTHER: 60 * 60 * 24,
};

// ---------------------------------------------------------------------------
// The canonical offer itself
// ---------------------------------------------------------------------------

export interface OfferRetailer {
  id: string;
  code: string;
  name: string;
}

export interface CanonicalOffer {
  contractVersion: typeof CANONICAL_OFFER_CONTRACT_VERSION;
  retailer: OfferRetailer;
  identity: ProductIdentity;
  price: Price;
  promotion: Promotion;
  availability: Availability;
  source: SourceMetadata;
  freshness: FreshnessMetadata;
  /** 0–1. Confidence the matching layer has that `identity` correctly
   *  represents the searched-for product — NOT confidence in the price
   *  itself (a price extracted via JSON-LD vs. a text-fallback guess
   *  has its own separate confidence, folded in upstream before this
   *  point is reached; this field is about product-match confidence). */
  matchConfidence: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type OfferErrorCode =
  | "SOURCE_NOT_CONFIGURED" // no CatalogueSource/adapter registered for this retailer
  | "SOURCE_UNAVAILABLE" // adapter threw, network failure, non-2xx response
  | "TIMEOUT"
  | "PARSE_FAILED" // page fetched but no price could be extracted
  | "NOT_FOUND" // search/lookup succeeded but returned no candidates
  | "UNKNOWN";

export interface OfferError {
  code: OfferErrorCode;
  message: string;
  retailerCode?: string;
  adapterKey?: string | null;
  /** True if retrying the same request might succeed (e.g. TIMEOUT) —
   *  false for errors that need a config/code fix (SOURCE_NOT_CONFIGURED). */
  retryable: boolean;
}

/**
 * Classifies the ad hoc error strings the existing catalogue lookup
 * pipeline produces (see retail-catalogue.price-lookup.service.ts's
 * CataloguePriceLookupAttempt.error) into the stable taxonomy above.
 * Pattern-matches on known prefixes rather than requiring every
 * adapter to be rewritten to throw typed errors — additive, not
 * disruptive.
 */
export function classifyOfferError(rawError: string): OfferErrorCode {
  if (rawError.includes("ADAPTER_NOT_REGISTERED") || rawError.includes("ADAPTER_KEY_MISSING")) {
    return "SOURCE_NOT_CONFIGURED";
  }
  if (rawError.includes("TIMEOUT") || rawError.includes("ABORT")) {
    return "TIMEOUT";
  }
  if (
    rawError.includes("EMPTY") ||
    rawError.includes("HTTP_4") ||
    rawError.includes("HTTP_5") ||
    rawError.includes("UNAVAILABLE")
  ) {
    return "SOURCE_UNAVAILABLE";
  }
  if (rawError.includes("PARSE") || rawError.includes("NOT_FOUND")) {
    return rawError.includes("NOT_FOUND") ? "NOT_FOUND" : "PARSE_FAILED";
  }
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Request / Response envelope
// ---------------------------------------------------------------------------

export interface OfferRequest {
  /** Free-text shopping intent, e.g. "milk" — the same input the
   *  existing shopping-intent module already normalizes upstream. */
  query: string;
  brand?: string;
  packSize?: string;
  unit?: string;
  countryCode?: string;
  province?: string;
  city?: string;
}

export type OfferResponseStatus =
  | "SUCCESS" // at least one retailer returned a usable offer, no errors
  | "PARTIAL" // some retailers returned offers, others errored
  | "FAILED"; // no retailer returned a usable offer

export interface OfferResponse {
  contractVersion: typeof CANONICAL_OFFER_CONTRACT_VERSION;
  status: OfferResponseStatus;
  request: OfferRequest;
  offers: CanonicalOffer[];
  errors: OfferError[];
  retailersAttempted: number;
  retailersSucceeded: number;
}

export function buildOfferResponseStatus(
  offers: CanonicalOffer[],
  errors: OfferError[],
): OfferResponseStatus {
  if (offers.length > 0 && errors.length === 0) return "SUCCESS";
  if (offers.length > 0) return "PARTIAL";
  return "FAILED";
}
