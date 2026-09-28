import { describe, expect, it } from "vitest";
import {
  checkOfferCompliance,
  checkOfferResponseCompliance,
  allOffersFresh,
} from "../../src/modules/retailer-offers/retailer-offer-contract.compliance.js";
import {
  CANONICAL_OFFER_CONTRACT_VERSION,
  type CanonicalOffer,
  type OfferResponse,
} from "../../src/modules/retailer-offers/retailer-offer-contract.js";

function goodOffer(overrides: Partial<CanonicalOffer> = {}): CanonicalOffer {
  return {
    contractVersion: CANONICAL_OFFER_CONTRACT_VERSION,
    retailer: { id: "r1", code: "CHECKERS", name: "Checkers" },
    identity: { gtin: "600123", name: "Full Cream Milk 1L" },
    price: { amount: 21.99, currency: "ZAR" },
    promotion: { isPromotion: false },
    availability: { status: "IN_STOCK" },
    source: { type: "PUBLIC", adapterKey: "CHECKERS_LIVE_SEARCH" },
    freshness: { observedAt: new Date().toISOString(), staleAfterSeconds: 3600 },
    matchConfidence: 0.9,
    ...overrides,
  };
}

describe("checkOfferCompliance", () => {
  it("passes a well-formed offer with zero violations", () => {
    expect(checkOfferCompliance([goodOffer()])).toEqual([]);
  });

  it("flags a negative price", () => {
    const violations = checkOfferCompliance([goodOffer({ price: { amount: -5, currency: "ZAR" } })]);
    expect(violations.some((v) => v.field === "price.amount")).toBe(true);
  });

  it("flags a missing/invalid currency", () => {
    const violations = checkOfferCompliance([goodOffer({ price: { amount: 10, currency: "R" } })]);
    expect(violations.some((v) => v.field === "price.currency")).toBe(true);
  });

  it("flags a wasAmount lower than the current price (nonsensical discount)", () => {
    const violations = checkOfferCompliance([
      goodOffer({ price: { amount: 20, currency: "ZAR", wasAmount: 10 } }),
    ]);
    expect(violations.some((v) => v.field === "price.wasAmount")).toBe(true);
  });

  it("flags an invalid availability status", () => {
    const violations = checkOfferCompliance([
      goodOffer({ availability: { status: "MAYBE" as never } }),
    ]);
    expect(violations.some((v) => v.field === "availability.status")).toBe(true);
  });

  it("flags a missing adapterKey (untraceable offer)", () => {
    const violations = checkOfferCompliance([
      goodOffer({ source: { type: "PUBLIC", adapterKey: "" } }),
    ]);
    expect(violations.some((v) => v.field === "source.adapterKey")).toBe(true);
  });

  it("flags a non-ISO-8601 freshness timestamp", () => {
    const violations = checkOfferCompliance([
      goodOffer({ freshness: { observedAt: "yesterday", staleAfterSeconds: 60 } }),
    ]);
    expect(violations.some((v) => v.field === "freshness.observedAt")).toBe(true);
  });

  it("flags matchConfidence outside 0-1", () => {
    const violations = checkOfferCompliance([goodOffer({ matchConfidence: 1.5 })]);
    expect(violations.some((v) => v.field === "matchConfidence")).toBe(true);
  });

  it("flags (but doesn't hard-fail elsewhere) an offer with no identifiers at all", () => {
    const violations = checkOfferCompliance([
      goodOffer({ identity: { name: "Mystery Product" } }),
    ]);
    expect(violations.some((v) => v.field === "identity")).toBe(true);
  });

  it("checks every offer in a batch independently, not just the first", () => {
    const violations = checkOfferCompliance([
      goodOffer(),
      goodOffer({ price: { amount: -1, currency: "ZAR" } }),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.offerIndex).toBe(1);
  });
});

describe("checkOfferResponseCompliance", () => {
  function goodResponse(overrides: Partial<OfferResponse> = {}): OfferResponse {
    return {
      contractVersion: CANONICAL_OFFER_CONTRACT_VERSION,
      status: "SUCCESS",
      request: { query: "milk" },
      offers: [goodOffer()],
      errors: [],
      retailersAttempted: 1,
      retailersSucceeded: 1,
      ...overrides,
    };
  }

  it("passes a consistent SUCCESS response", () => {
    expect(checkOfferResponseCompliance(goodResponse())).toEqual([]);
  });

  it("flags SUCCESS status with non-empty errors as inconsistent", () => {
    const violations = checkOfferResponseCompliance(
      goodResponse({
        errors: [{ code: "TIMEOUT", message: "x", retryable: true }],
      }),
    );
    expect(violations.some((v) => v.field === "status")).toBe(true);
  });

  it("flags FAILED status with non-empty offers as inconsistent", () => {
    const violations = checkOfferResponseCompliance(goodResponse({ status: "FAILED" }));
    expect(violations.some((v) => v.field === "status")).toBe(true);
  });

  it("flags retailersSucceeded exceeding retailersAttempted", () => {
    const violations = checkOfferResponseCompliance(
      goodResponse({ retailersAttempted: 1, retailersSucceeded: 2 }),
    );
    expect(violations.some((v) => v.field === "retailersSucceeded")).toBe(true);
  });
});

describe("allOffersFresh", () => {
  it("is true when every offer is within its staleness budget", () => {
    expect(allOffersFresh([goodOffer()])).toBe(true);
  });

  it("is false when any offer has exceeded its staleness budget", () => {
    const stale = goodOffer({
      freshness: {
        observedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        staleAfterSeconds: 3600,
      },
    });
    expect(allOffersFresh([goodOffer(), stale])).toBe(false);
  });
});
