import type { CataloguePriceLookupMatch } from "../retail-catalogue/retail-catalogue.price-lookup.service.js";
import { normalizeCatalogueItem } from "../retail-catalogue/retail-catalogue.normalizer.js";
import type { LiveRetailerOfferLookupResult } from "./retailer-offer.live.service.js";
import type { CataloguePriceLookupAttempt } from "../retail-catalogue/retail-catalogue.price-lookup.service.js";

import {
  CANONICAL_OFFER_CONTRACT_VERSION,
  DEFAULT_STALE_AFTER_SECONDS,
  buildOfferResponseStatus,
  classifyOfferError,
  type CanonicalOffer,
  type OfferError,
  type OfferRequest,
  type OfferResponse,
  type OfferSourceType,
} from "./retailer-offer-contract.js";

function toIsoDate(value: Date | null): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function toOfferSourceType(catalogueSourceType: string): OfferSourceType {
  return catalogueSourceType === "API" ? "API" : "PUBLIC";
}

/**
 * Builds a CanonicalOffer directly from a catalogue-layer match,
 * rather than going through the older, lossy RetailerOffer mapper
 * (retailer-offer.mapper.ts) — this is the fix for the identity data
 * that mapper silently dropped. Returns null on the same "not a
 * usable offer" conditions the older mapper used (missing/invalid
 * price, non-positive confidence), so behaviour stays consistent
 * with the existing pipeline's validation, not more permissive.
 */
export function mapCatalogueMatchToCanonicalOffer(
  match: CataloguePriceLookupMatch,
  matchConfidence: number,
): CanonicalOffer | null {
  const item = normalizeCatalogueItem(match.item);

  if (item.price === null || !Number.isFinite(item.price) || item.price < 0) {
    return null;
  }

  const extractionConfidence = item.extractionConfidence ?? 0;
  if (!Number.isFinite(extractionConfidence) || extractionConfidence <= 0) {
    return null;
  }

  const sourceType = toOfferSourceType(match.source.sourceType);

  return {
    contractVersion: CANONICAL_OFFER_CONTRACT_VERSION,
    retailer: {
      id: match.source.retailerId,
      code: match.source.retailerCode,
      name: match.source.retailerName,
    },
    identity: {
      // The fix: these three were captured by the catalogue layer
      // (retail-catalogue.normalizer.ts) but never reached the
      // pre-existing RetailerOffer shape. Carried through here.
      gtin: item.gtin,
      barcode: item.barcode,
      retailerSku: item.retailerSku,
      name: item.rawName,
      brand: item.brand,
      packSize: item.packSize,
      unit: item.unit,
      category: item.category,
    },
    price: {
      amount: item.price,
      currency: item.currency,
      wasAmount: item.wasPrice,
    },
    promotion: {
      isPromotion: item.isPromotion,
      promotionText: item.promotionText,
      validFrom: toIsoDate(item.validFrom),
      validUntil: toIsoDate(item.validUntil),
    },
    availability: {
      // Previously didn't exist anywhere in the pipeline at all.
      status: item.availability,
    },
    source: {
      type: sourceType,
      adapterKey: match.source.adapterKey ?? "UNKNOWN",
      url: match.source.sourceUrl,
    },
    freshness: {
      observedAt: new Date().toISOString(),
      staleAfterSeconds: DEFAULT_STALE_AFTER_SECONDS[sourceType],
    },
    matchConfidence,
  };
}

function attemptToOfferError(attempt: CataloguePriceLookupAttempt): OfferError | null {
  if (attempt.status !== "UNAVAILABLE" && attempt.status !== "SKIPPED") {
    return null; // MATCHED and NO_MATCH aren't errors — no offer isn't a failure
  }

  const rawMessage = attempt.error ?? attempt.status;
  const code = classifyOfferError(rawMessage);

  return {
    code,
    message: rawMessage,
    retailerCode: attempt.sourceCode,
    adapterKey: attempt.adapterKey,
    retryable: code === "TIMEOUT" || code === "SOURCE_UNAVAILABLE",
  };
}

/**
 * Wraps the existing lookupLiveRetailerOffers() result (loose object,
 * with an internal catalogue-lookup type leaking through as `.lookup`)
 * into the formal OfferResponse envelope. Purely additive — does not
 * change lookupLiveRetailerOffers's own return shape, so
 * shopping-list-value.service.ts (its one current caller) is
 * unaffected. Callers that want the formal contract call this on top.
 */
export function buildOfferResponse(
  request: OfferRequest,
  result: LiveRetailerOfferLookupResult,
): OfferResponse {
  const usableMatches = result.matchedOffers.filter((matched) => matched.matchScore > 0);

  // matchedOffers only carries the already-mapped RetailerOffer, not
  // the original CataloguePriceLookupMatch — so identity fields must
  // be re-derived from result.lookup.matches by pairing on retailer +
  // name + price, the only stable join key available without changing
  // lookupLiveRetailerOffers's internals.
  const canonicalOffers: CanonicalOffer[] = [];

  for (const matched of usableMatches) {
    const correspondingMatch = result.lookup.matches.find(
      (m) =>
        m.source.retailerId === matched.offer.retailer.id &&
        m.item.name === matched.offer.name &&
        m.item.price === matched.offer.price,
    );

    if (!correspondingMatch) continue; // shouldn't happen; skip rather than fabricate identity

    const canonical = mapCatalogueMatchToCanonicalOffer(correspondingMatch, matched.matchScore);
    if (canonical) canonicalOffers.push(canonical);
  }

  const errors = result.lookup.attempts
    .map(attemptToOfferError)
    .filter((error): error is OfferError => error !== null);

  return {
    contractVersion: CANONICAL_OFFER_CONTRACT_VERSION,
    status: buildOfferResponseStatus(canonicalOffers, errors),
    request,
    offers: canonicalOffers,
    errors,
    retailersAttempted: result.lookup.sourcesAttempted,
    retailersSucceeded: result.lookup.sourcesMatched,
  };
}
