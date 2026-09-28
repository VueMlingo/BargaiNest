import type { CanonicalOffer, OfferResponse } from "./retailer-offer-contract.js";
import { CANONICAL_OFFER_CONTRACT_VERSION, isOfferStale } from "./retailer-offer-contract.js";

/**
 * BN-016's "retailer adapter compliance tests" requirement — a
 * reusable, structural conformance checker any source of canonical
 * offers can be run through, whether it's the existing catalogue
 * pipeline (session 3's five live-search adapters, Shoprite's
 * specials adapter) or a future direct official-retailer-API adapter.
 *
 * Returns a list of violations rather than throwing on the first one,
 * so a single non-conformant offer doesn't hide other problems in the
 * same batch — useful when checking real adapter output during
 * development.
 */

export interface ComplianceViolation {
  offerIndex: number;
  field: string;
  message: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function checkOffer(offer: CanonicalOffer, index: number): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const fail = (field: string, message: string) =>
    violations.push({ offerIndex: index, field, message });

  if (offer.contractVersion !== CANONICAL_OFFER_CONTRACT_VERSION) {
    fail("contractVersion", `expected ${CANONICAL_OFFER_CONTRACT_VERSION}, got ${offer.contractVersion}`);
  }

  if (!offer.retailer?.id?.trim()) fail("retailer.id", "must be a non-empty string");
  if (!offer.retailer?.code?.trim()) fail("retailer.code", "must be a non-empty string");
  if (!offer.retailer?.name?.trim()) fail("retailer.name", "must be a non-empty string");

  if (!offer.identity?.name?.trim()) fail("identity.name", "must be a non-empty string");
  const hasAnyIdentifier =
    offer.identity?.gtin || offer.identity?.barcode || offer.identity?.retailerSku;
  if (!hasAnyIdentifier) {
    // Not a hard failure — plenty of real sources only have a name —
    // but flagged, since Best Basket-quality matching benefits a lot
    // from at least one hard identifier.
    fail("identity", "no gtin/barcode/retailerSku present — matching will rely on name only");
  }

  if (typeof offer.price?.amount !== "number" || !Number.isFinite(offer.price.amount)) {
    fail("price.amount", "must be a finite number");
  } else if (offer.price.amount < 0) {
    fail("price.amount", "must not be negative");
  }
  if (!offer.price?.currency || offer.price.currency.length !== 3) {
    fail("price.currency", "must be a 3-letter currency code");
  }
  if (
    offer.price?.wasAmount != null &&
    (offer.price.wasAmount < 0 || offer.price.wasAmount < offer.price.amount)
  ) {
    fail("price.wasAmount", "if present, must be >= price.amount (a 'was' price should be higher)");
  }

  if (typeof offer.promotion?.isPromotion !== "boolean") {
    fail("promotion.isPromotion", "must be a boolean");
  }

  const validAvailability = ["IN_STOCK", "OUT_OF_STOCK", "LIMITED", "UNKNOWN"];
  if (!validAvailability.includes(offer.availability?.status)) {
    fail("availability.status", `must be one of ${validAvailability.join(", ")}`);
  }

  const validSourceTypes = ["PUBLIC", "API", "FEED", "OTHER"];
  if (!validSourceTypes.includes(offer.source?.type)) {
    fail("source.type", `must be one of ${validSourceTypes.join(", ")}`);
  }
  if (!offer.source?.adapterKey?.trim()) {
    fail("source.adapterKey", "must be a non-empty string — untraceable offers can't be debugged");
  }

  if (!offer.freshness?.observedAt || !ISO_DATE_PATTERN.test(offer.freshness.observedAt)) {
    fail("freshness.observedAt", "must be an ISO-8601 UTC timestamp");
  }
  if (
    typeof offer.freshness?.staleAfterSeconds !== "number" ||
    offer.freshness.staleAfterSeconds <= 0
  ) {
    fail("freshness.staleAfterSeconds", "must be a positive number");
  }

  if (
    typeof offer.matchConfidence !== "number" ||
    offer.matchConfidence < 0 ||
    offer.matchConfidence > 1
  ) {
    fail("matchConfidence", "must be a number between 0 and 1");
  }

  return violations;
}

export function checkOfferCompliance(offers: CanonicalOffer[]): ComplianceViolation[] {
  return offers.flatMap((offer, index) => checkOffer(offer, index));
}

/**
 * Convenience wrapper for a full OfferResponse: also checks the
 * envelope-level invariants (status matches offers/errors present)
 * rather than only the individual offers.
 */
export function checkOfferResponseCompliance(response: OfferResponse): ComplianceViolation[] {
  const violations = checkOfferCompliance(response.offers);

  if (response.status === "SUCCESS" && response.errors.length > 0) {
    violations.push({
      offerIndex: -1,
      field: "status",
      message: "status is SUCCESS but errors[] is non-empty",
    });
  }
  if (response.status === "FAILED" && response.offers.length > 0) {
    violations.push({
      offerIndex: -1,
      field: "status",
      message: "status is FAILED but offers[] is non-empty",
    });
  }
  if (response.retailersSucceeded > response.retailersAttempted) {
    violations.push({
      offerIndex: -1,
      field: "retailersSucceeded",
      message: "cannot exceed retailersAttempted",
    });
  }

  return violations;
}

/** True if every offer in the batch is fresh enough to trust right now. */
export function allOffersFresh(offers: CanonicalOffer[], now: Date = new Date()): boolean {
  return offers.every((offer) => !isOfferStale(offer.freshness, now));
}
