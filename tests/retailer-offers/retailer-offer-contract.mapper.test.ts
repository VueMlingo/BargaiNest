import { describe, expect, it } from "vitest";
import {
  mapCatalogueMatchToCanonicalOffer,
  buildOfferResponse,
} from "../../src/modules/retailer-offers/retailer-offer-contract.mapper.js";
import { checkOfferCompliance, checkOfferResponseCompliance } from "../../src/modules/retailer-offers/retailer-offer-contract.compliance.js";
import type { CataloguePriceLookupMatch } from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js";
import type { LiveRetailerOfferLookupResult } from "../../src/modules/retailer-offers/retailer-offer.live.service.js";

function makeMatch(overrides: Partial<CataloguePriceLookupMatch["item"]> = {}): CataloguePriceLookupMatch {
  return {
    item: {
      name: "Full Cream Milk 1L",
      price: 21.99,
      currency: "ZAR",
      gtin: "6009999999999",
      barcode: "6009999999999",
      retailerSku: "SKU-123",
      availability: "IN_STOCK",
      extractionMethod: "STRUCTURED",
      extractionConfidence: 0.95,
      ...overrides,
    },
    source: {
      id: "source-1",
      retailerId: "retailer-1",
      retailerCode: "CHECKERS",
      retailerName: "Checkers",
      code: "CHECKERS_LIVE_SEARCH",
      name: "Checkers — live product search",
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: "https://www.checkers.co.za",
      region: null,
      countryCode: "ZA",
      province: null,
      city: null,
      storeCode: null,
      adapterKey: "CHECKERS_LIVE_SEARCH",
    },
  };
}

describe("mapCatalogueMatchToCanonicalOffer — the identity/availability fix", () => {
  it("carries gtin, barcode and retailerSku through to the canonical offer (previously silently dropped)", () => {
    const offer = mapCatalogueMatchToCanonicalOffer(makeMatch(), 0.9);

    expect(offer).not.toBeNull();
    expect(offer?.identity.gtin).toBe("6009999999999");
    expect(offer?.identity.barcode).toBe("6009999999999");
    expect(offer?.identity.retailerSku).toBe("SKU-123");
  });

  it("carries availability through (previously didn't exist anywhere in the pipeline)", () => {
    const offer = mapCatalogueMatchToCanonicalOffer(makeMatch({ availability: "OUT_OF_STOCK" }), 0.9);
    expect(offer?.availability.status).toBe("OUT_OF_STOCK");
  });

  it("defaults availability to UNKNOWN rather than assuming in-stock when a source doesn't report it", () => {
    const { availability: _omit, ...withoutAvailability } = makeMatch().item;
    const match = makeMatch();
    match.item = withoutAvailability as typeof match.item;
    const offer = mapCatalogueMatchToCanonicalOffer(match, 0.9);
    expect(offer?.availability.status).toBe("UNKNOWN");
  });

  it("returns null for a non-finite/negative price, same as the pre-existing mapper's validation", () => {
    expect(mapCatalogueMatchToCanonicalOffer(makeMatch({ price: -5 }), 0.9)).toBeNull();
    const { price: _omit, ...withoutPrice } = makeMatch().item;
    const match = makeMatch();
    match.item = withoutPrice as typeof match.item;
    expect(mapCatalogueMatchToCanonicalOffer(match, 0.9)).toBeNull();
  });

  it("returns null for non-positive extraction confidence", () => {
    expect(
      mapCatalogueMatchToCanonicalOffer(makeMatch({ extractionConfidence: 0 }), 0.9),
    ).toBeNull();
  });

  it("produces output that passes the compliance suite", () => {
    const offer = mapCatalogueMatchToCanonicalOffer(makeMatch(), 0.85);
    expect(offer).not.toBeNull();
    expect(checkOfferCompliance([offer!])).toEqual([]);
  });
});

describe("buildOfferResponse", () => {
  it("builds a SUCCESS response from a healthy lookup result, passing the full compliance suite", () => {
    const match = makeMatch();
    const canonicalOffer = mapCatalogueMatchToCanonicalOffer(match, 0.88)!;

    const result: LiveRetailerOfferLookupResult = {
      intent: { normalizedText: "milk", attributes: {} } as never,
      offers: [
        {
          retailer: { id: "retailer-1", code: "CHECKERS", name: "Checkers" },
          name: "Full Cream Milk 1L",
          price: 21.99,
          currency: "ZAR",
          isPromotion: false,
          availability: "IN_STOCK",
          source: { type: "PUBLIC", adapterKey: "CHECKERS_LIVE_SEARCH", observedAt: new Date().toISOString() },
          confidence: 0.95,
        },
      ],
      matchedOffers: [
        {
          offer: {
            retailer: { id: "retailer-1", code: "CHECKERS", name: "Checkers" },
            name: "Full Cream Milk 1L",
            price: 21.99,
            currency: "ZAR",
            isPromotion: false,
            availability: "IN_STOCK",
            source: { type: "PUBLIC", adapterKey: "CHECKERS_LIVE_SEARCH", observedAt: new Date().toISOString() },
            confidence: 0.95,
          },
          matchScore: 0.88,
          matchQuality: "STRONG",
          matchReason: "name matches",
        },
      ],
      lookup: {
        items: [match.item],
        matches: [match],
        attempts: [
          {
            sourceId: "source-1",
            sourceCode: "CHECKERS_LIVE_SEARCH",
            sourceName: "Checkers — live product search",
            adapterKey: "CHECKERS_LIVE_SEARCH",
            status: "MATCHED",
            itemsReturned: 1,
          },
        ],
        matchedSourceId: "source-1",
        matchedSourceCode: "CHECKERS_LIVE_SEARCH",
        sourcesAttempted: 1,
        sourcesMatched: 1,
        sourcesFailed: 0,
      },
    };

    const response = buildOfferResponse({ query: "milk" }, result);

    expect(response.status).toBe("SUCCESS");
    expect(response.offers).toHaveLength(1);
    expect(response.offers[0]?.identity.gtin).toBe(canonicalOffer.identity.gtin);
    expect(checkOfferResponseCompliance(response)).toEqual([]);
  });

  it("builds a FAILED response with classified errors when every source fails", () => {
    const result: LiveRetailerOfferLookupResult = {
      intent: { normalizedText: "milk", attributes: {} } as never,
      offers: [],
      matchedOffers: [],
      lookup: {
        items: [],
        matches: [],
        attempts: [
          {
            sourceId: "source-1",
            sourceCode: "WOOLWORTHS_LIVE_SEARCH",
            sourceName: "Woolworths — live product search",
            adapterKey: "WOOLWORTHS_LIVE_SEARCH",
            status: "UNAVAILABLE",
            itemsReturned: 0,
            error: "WOOLWORTHS_PRODUCT_HTTP_500",
          },
        ],
        matchedSourceId: null,
        matchedSourceCode: null,
        sourcesAttempted: 1,
        sourcesMatched: 0,
        sourcesFailed: 1,
      },
    };

    const response = buildOfferResponse({ query: "milk" }, result);

    expect(response.status).toBe("FAILED");
    expect(response.errors).toHaveLength(1);
    expect(response.errors[0]?.code).toBe("SOURCE_UNAVAILABLE");
    expect(response.errors[0]?.retryable).toBe(true);
    expect(checkOfferResponseCompliance(response)).toEqual([]);
  });
});
