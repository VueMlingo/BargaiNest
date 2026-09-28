import { describe, expect, it } from "vitest";

import {
  mapCatalogueMatchToRetailerOffer,
  mapCatalogueMatchesToRetailerOffers,
} from "../../src/modules/retailer-offers/retailer-offer.mapper.js";

import type {
  CataloguePriceLookupMatch,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js";

function makeMatch(
  overrides: Partial<CataloguePriceLookupMatch["item"]> = {},
): CataloguePriceLookupMatch {
  return {
    item: {
      name: "Coca-Cola Original",
      price: 24.99,
      currency: "ZAR",
      isPromotion: true,
      promotionText: "Special",
      extractionMethod: "WEB_PARSER",
      extractionConfidence: 0.8,
      ...overrides,
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
      sourceUrl: "https://example.com/shoprite",
      region: null,
      countryCode: "ZA",
      province: "Western Cape",
      city: "Cape Town",
      storeCode: null,
      adapterKey: "SHOPRITE_PUBLICATION",
    },
  };
}

describe("retailer-offer.mapper", () => {
  it("maps a catalogue match into the canonical transient RetailerOffer", () => {
    const offer =
      mapCatalogueMatchToRetailerOffer(
        makeMatch({
          brand: "Coca-Cola",
          packSize: "2L",
          unit: "L",
          category: "beverages",
          wasPrice: 29.99,
        }),
      );

    expect(offer).not.toBeNull();

    expect(offer?.retailer.id).toBe(
      "retailer-shoprite",
    );

    expect(offer?.retailer.code).toBe(
      "SHOPRITE",
    );

    expect(offer?.retailer.name).toBe(
      "Shoprite",
    );

    expect(offer?.name).toBe(
      "Coca-Cola Original",
    );

    expect(offer?.brand).toBe(
      "Coca-Cola",
    );

    expect(offer?.packSize).toBe(
      "2L",
    );

    expect(offer?.price).toBe(24.99);
    expect(offer?.currency).toBe("ZAR");
    expect(offer?.wasPrice).toBe(29.99);

    expect(offer?.isPromotion).toBe(true);
    expect(offer?.promotionText).toBe(
      "Special",
    );

    expect(offer?.source.type).toBe(
      "PUBLIC",
    );

    expect(offer?.source.adapterKey).toBe(
      "SHOPRITE_PUBLICATION",
    );

    expect(offer?.source.url).toBe(
      "https://example.com/shoprite",
    );

    expect(offer?.confidence).toBe(0.8);
    expect(offer?.source.observedAt).toBeTypeOf(
      "string",
    );
  });

  it("rejects an item without a valid price", () => {
    const match = makeMatch();
    delete match.item.price;

    const offer =
      mapCatalogueMatchToRetailerOffer(match);

    expect(offer).toBeNull();
  });

  it("rejects an item without usable extraction confidence", () => {
    const offer =
      mapCatalogueMatchToRetailerOffer(
        makeMatch({
          extractionConfidence: 0,
        }),
      );

    expect(offer).toBeNull();
  });

  it("maps multiple matches and removes invalid offers", () => {
    const offers =
      mapCatalogueMatchesToRetailerOffers([
        makeMatch({
          name: "Milk 2L",
          price: 34.99,
        }),
        (() => {
          const match = makeMatch({
            name: "Invalid Item",
          });
          delete match.item.price;
          return match;
        })(),
        makeMatch({
          name: "Bread",
          price: 18.99,
        }),
      ]);

    expect(offers).toHaveLength(2);
    expect(
      offers.map((offer) => offer.name),
    ).toEqual([
      "Milk 2L",
      "Bread",
    ]);
  });
});
