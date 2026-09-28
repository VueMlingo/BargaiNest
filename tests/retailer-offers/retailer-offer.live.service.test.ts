import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { FastifyInstance } from "fastify";

import {
  lookupLiveRetailerOffers,
} from "../../src/modules/retailer-offers/retailer-offer.live.service.js";

import {
  createShoppingIntent,
} from "../../src/modules/shopping-intent/shopping-intent.service.js";

import type {
  CataloguePriceLookupRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.registry.js";

import type {
  CatalogueSourceSelectionInput,
} from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.service.js";

import {
  lookupCurrentCataloguePrices,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js";

vi.mock(
  "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js",
  () => ({
    lookupCurrentCataloguePrices: vi.fn(),
  }),
);

const mockedLookup =
  vi.mocked(lookupCurrentCataloguePrices);

describe("retailer-offer.live.service", () => {
  it("converts a shopping intent into matched live retailer offers", async () => {
    mockedLookup.mockResolvedValue({
      items: [
        {
          name: "Coca-Cola Original 2L",
          price: 24.99,
          currency: "ZAR",
          isPromotion: true,
          promotionText: "Special",
          extractionMethod: "WEB_PARSER",
          extractionConfidence: 0.8,
        },
      ],

      matches: [
        {
          item: {
            name: "Coca-Cola Original 2L",
            price: 24.99,
            currency: "ZAR",
            isPromotion: true,
            promotionText: "Special",
            extractionMethod: "WEB_PARSER",
            extractionConfidence: 0.8,
          },

          source: {
            id: "source-1",
            retailerId: "retailer-shoprite",
            retailerCode: "SHOPRITE",
            retailerName: "Shoprite",
            code: "SHOPRITE_WEEKLY",
            name: "Shoprite Weekly",
            channel: "PHYSICAL_CATALOGUE",
            sourceType: "WEB_PAGE",
            sourceUrl:
              "https://example.com/shoprite",
            region: null,
            countryCode: "ZA",
            province: "Western Cape",
            city: "Cape Town",
            storeCode: null,
            adapterKey:
              "SHOPRITE_PUBLICATION",
          },
        },
      ],

      attempts: [
        {
          sourceId: "source-1",
          sourceCode: "SHOPRITE_WEEKLY",
          sourceName: "Shoprite",
          adapterKey:
            "SHOPRITE_PUBLICATION",
          status: "MATCHED",
          itemsReturned: 1,
        },
      ],

      matchedSourceId: "source-1",
      matchedSourceCode: "SHOPRITE_WEEKLY",
      sourcesAttempted: 1,
      sourcesMatched: 1,
      sourcesFailed: 0,
    });

    const intent =
      createShoppingIntent({
        text: "Coca-Cola 2L",
      });

    const sourceSelection =
      {} as CatalogueSourceSelectionInput;

    const registry =
      {} as CataloguePriceLookupRegistry;

    const result =
      await lookupLiveRetailerOffers(
        {} as FastifyInstance,
        sourceSelection,
        intent,
        registry,
      );

    expect(
      mockedLookup,
    ).toHaveBeenCalledTimes(1);

    expect(
      mockedLookup.mock.calls[0]?.[2],
    ).toEqual({
      name: "coca cola 2l",
      brand: "coca-cola",
      packSize: "2l",
    });

    expect(result.offers).toHaveLength(1);

    expect(
      result.offers[0]?.retailer.id,
    ).toBe("retailer-shoprite");

    expect(
      result.offers[0]?.price,
    ).toBe(24.99);

    expect(
      result.matchedOffers,
    ).toHaveLength(1);

    expect(
      result.matchedOffers[0]?.offer.price,
    ).toBe(24.99);
  });

  it("returns no offers when lookup returns no matches", async () => {
    mockedLookup.mockResolvedValue({
      items: [],
      matches: [],
      attempts: [],
      matchedSourceId: null,
      matchedSourceCode: null,
      sourcesAttempted: 0,
      sourcesMatched: 0,
      sourcesFailed: 0,
    });

    const intent =
      createShoppingIntent({
        text: "milk",
      });

    const result =
      await lookupLiveRetailerOffers(
        {} as FastifyInstance,
        {} as CatalogueSourceSelectionInput,
        intent,
        {} as CataloguePriceLookupRegistry,
      );

    expect(result.offers).toHaveLength(0);
    expect(
      result.matchedOffers,
    ).toHaveLength(0);
  });
});
