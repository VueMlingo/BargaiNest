import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { lookupLiveRetailerOffersExpanded } from "../../src/modules/retailer-offers/retailer-offer.live.service.js";
import { createShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.service.js";
import type { CataloguePriceLookupRegistry } from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.registry.js";
import type { CatalogueSourceSelectionInput } from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.service.js";
import { lookupCurrentCataloguePrices } from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js";

vi.mock("../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js", () => ({
  lookupCurrentCataloguePrices: vi.fn(),
}));

const mockedLookup = vi.mocked(lookupCurrentCataloguePrices);

function fakeResult(retailerId: string, retailerCode: string, price: number, matchScoreHint: number) {
  const item = {
    name: `Full Cream Milk (${retailerCode})`,
    price,
    currency: "ZAR",
    isPromotion: false,
    extractionMethod: "STRUCTURED" as const,
    extractionConfidence: matchScoreHint,
  };
  return {
    items: [item],
    matches: [
      {
        item,
        source: {
          id: `source-${retailerCode}`,
          retailerId,
          retailerCode,
          retailerName: retailerCode,
          code: `${retailerCode}_LIVE_SEARCH`,
          name: `${retailerCode} live search`,
          channel: "ONLINE_STORE" as const,
          sourceType: "WEB_PAGE",
          sourceUrl: null,
          region: null,
          countryCode: "ZA",
          province: null,
          city: null,
          storeCode: null,
          adapterKey: `${retailerCode}_LIVE_SEARCH`,
        },
      },
    ],
    attempts: [
      {
        sourceId: `source-${retailerCode}`,
        sourceCode: `${retailerCode}_LIVE_SEARCH`,
        sourceName: `${retailerCode} live search`,
        adapterKey: `${retailerCode}_LIVE_SEARCH`,
        status: "MATCHED" as const,
        itemsReturned: 1,
      },
    ],
    matchedSourceId: `source-${retailerCode}`,
    matchedSourceCode: `${retailerCode}_LIVE_SEARCH`,
    sourcesAttempted: 1,
    sourcesMatched: 1,
    sourcesFailed: 0,
  };
}

function emptyResult() {
  return {
    items: [],
    matches: [],
    attempts: [],
    matchedSourceId: null,
    matchedSourceCode: null,
    sourcesAttempted: 1,
    sourcesMatched: 0,
    sourcesFailed: 0,
  };
}

describe("lookupLiveRetailerOffersExpanded", () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it("tries only one variant for a specific intent — identical behaviour to the non-expanded lookup", async () => {
    mockedLookup.mockResolvedValueOnce(fakeResult("r1", "CHECKERS", 21.99, 0.9));

    const intent = createShoppingIntent({ text: "low fat milk 2l" });
    const result = await lookupLiveRetailerOffersExpanded(
      {} as FastifyInstance,
      {} as CatalogueSourceSelectionInput,
      intent,
      {} as CataloguePriceLookupRegistry,
    );

    expect(mockedLookup).toHaveBeenCalledTimes(1);
    expect(result.variantsTried).toBe(1);
  });

  it("tries multiple variants for a generic 'milk' intent until enough retailers respond", async () => {
    mockedLookup
      .mockResolvedValueOnce(emptyResult())
      .mockResolvedValueOnce(fakeResult("r1", "CHECKERS", 21.99, 0.9))
      .mockResolvedValueOnce(fakeResult("r2", "SHOPRITE", 19.99, 0.9))
      .mockResolvedValueOnce(fakeResult("r3", "PICK_N_PAY", 22.5, 0.9));

    const intent = createShoppingIntent({ text: "milk" });
    const result = await lookupLiveRetailerOffersExpanded(
      {} as FastifyInstance,
      {} as CatalogueSourceSelectionInput,
      intent,
      {} as CataloguePriceLookupRegistry,
      { minRetailersSatisfied: 3 },
    );

    expect(mockedLookup).toHaveBeenCalledTimes(4);
    expect(result.variantsTried).toBe(4);
    expect(result.matchedOffers).toHaveLength(3);
    expect(new Set(result.matchedOffers.map((m) => m.offer.retailer.id)).size).toBe(3);
  });

  it("stops before exhausting all variants once minRetailersSatisfied is reached (cost control)", async () => {
    mockedLookup
      .mockResolvedValueOnce(fakeResult("r1", "CHECKERS", 21.99, 0.9))
      .mockResolvedValueOnce(fakeResult("r2", "SHOPRITE", 19.99, 0.9));

    const intent = createShoppingIntent({ text: "milk" });
    const result = await lookupLiveRetailerOffersExpanded(
      {} as FastifyInstance,
      {} as CatalogueSourceSelectionInput,
      intent,
      {} as CataloguePriceLookupRegistry,
      { minRetailersSatisfied: 2 },
    );

    expect(mockedLookup).toHaveBeenCalledTimes(2);
    expect(result.matchedOffers).toHaveLength(2);
  });

  it("respects maxVariants as a hard cap even if coverage is never satisfied", async () => {
    mockedLookup.mockResolvedValue(emptyResult());

    const intent = createShoppingIntent({ text: "milk" });
    const result = await lookupLiveRetailerOffersExpanded(
      {} as FastifyInstance,
      {} as CatalogueSourceSelectionInput,
      intent,
      {} as CataloguePriceLookupRegistry,
      { minRetailersSatisfied: 10, maxVariants: 2 },
    );

    expect(mockedLookup).toHaveBeenCalledTimes(2);
    expect(result.variantsTried).toBe(2);
    expect(result.matchedOffers).toHaveLength(0);
  });

  it("keeps only the best-scoring offer per retailer across variants, not duplicates", async () => {
    // matchScore comes from matchOffersToIntent's own name/attribute
    // comparison against the intent — NOT the item's extractionConfidence.
    // So to genuinely produce two different match scores for the same
    // retailer across two variant calls, the item names themselves must
    // differ in how well they match the intent, not just a confidence
    // number attached to the raw catalogue item.
    const poorMatchItem = {
      name: "Unrelated Household Item", // shares no tokens with "milk"
      price: 25.0,
      currency: "ZAR",
      isPromotion: false,
      extractionMethod: "STRUCTURED" as const,
      extractionConfidence: 0.9,
    };
    const goodMatchItem = {
      name: "Full Cream Milk 1L", // strong token overlap with "milk"
      price: 21.99,
      currency: "ZAR",
      isPromotion: false,
      extractionMethod: "STRUCTURED" as const,
      extractionConfidence: 0.9,
    };

    function resultWithItem(retailerId: string, retailerCode: string, item: typeof poorMatchItem) {
      return {
        items: [item],
        matches: [
          {
            item,
            source: {
              id: `source-${retailerCode}`,
              retailerId,
              retailerCode,
              retailerName: retailerCode,
              code: `${retailerCode}_LIVE_SEARCH`,
              name: `${retailerCode} live search`,
              channel: "ONLINE_STORE" as const,
              sourceType: "WEB_PAGE",
              sourceUrl: null,
              region: null,
              countryCode: "ZA",
              province: null,
              city: null,
              storeCode: null,
              adapterKey: `${retailerCode}_LIVE_SEARCH`,
            },
          },
        ],
        attempts: [
          {
            sourceId: `source-${retailerCode}`,
            sourceCode: `${retailerCode}_LIVE_SEARCH`,
            sourceName: `${retailerCode} live search`,
            adapterKey: `${retailerCode}_LIVE_SEARCH`,
            status: "MATCHED" as const,
            itemsReturned: 1,
          },
        ],
        matchedSourceId: `source-${retailerCode}`,
        matchedSourceCode: `${retailerCode}_LIVE_SEARCH`,
        sourcesAttempted: 1,
        sourcesMatched: 1,
        sourcesFailed: 0,
      };
    }

    mockedLookup
      .mockResolvedValueOnce(resultWithItem("r1", "CHECKERS", poorMatchItem))
      .mockResolvedValueOnce(resultWithItem("r1", "CHECKERS", goodMatchItem))
      .mockResolvedValueOnce(fakeResult("r2", "SHOPRITE", 19.99, 0.9))
      .mockResolvedValueOnce(fakeResult("r3", "SPAR", 20.0, 0.9));

    const intent = createShoppingIntent({ text: "milk" });
    const result = await lookupLiveRetailerOffersExpanded(
      {} as FastifyInstance,
      {} as CatalogueSourceSelectionInput,
      intent,
      {} as CataloguePriceLookupRegistry,
      { minRetailersSatisfied: 3 },
    );

    const checkersOffers = result.matchedOffers.filter((m) => m.offer.retailer.id === "r1");
    expect(checkersOffers).toHaveLength(1); // deduped — one entry, not two
    expect(checkersOffers[0]?.offer.price).toBe(21.99); // the genuinely-better name match won
  });
});
