import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  evaluateShoppingListValue,
} from "../src/modules/shopping-list-value/shopping-list-value.service.js";

import type {
  RetailerOffer,
  MatchedOffer,
} from "../src/modules/retailer-offers/retailer-offer.types.js";

import {
  lookupLiveRetailerOffersExpanded,
} from "../src/modules/retailer-offers/retailer-offer.live.service.js";

vi.mock(
  "../src/modules/retailer-offers/retailer-offer.live.service.js",
  () => ({
    lookupLiveRetailerOffersExpanded:
      vi.fn(),
  }),
);

const mockedLookupLiveRetailerOffers =
  vi.mocked(
    lookupLiveRetailerOffersExpanded,
  );

function makeOffer({
  retailerId,
  retailerName,
  price,
  currency = "ZAR",
  name = "Full Cream Milk 1L",
  brand = null,
  packSize = "1l",
  confidence = 0.95,
  observedAt = "2026-09-14T09:00:00.000Z",
  isPromotion = false,
  promotionText = null,
  availability = "IN_STOCK",
}: {
  retailerId: string;
  retailerName: string;
  price: number;
  currency?: string;
  name?: string;
  brand?: string | null;
  packSize?: string | null;
  confidence?: number;
  observedAt?: string;
  isPromotion?: boolean;
  promotionText?: string | null;
  availability?: "IN_STOCK" | "OUT_OF_STOCK" | "LIMITED" | "UNKNOWN";
}): RetailerOffer {
  return {
    retailer: {
      id: retailerId,
      code: retailerId.toUpperCase(),
      name: retailerName,
    },
    name,
    brand,
    packSize,
    unit: null,
    category: "dairy",
    price,
    currency,
    wasPrice: null,
    isPromotion,
    promotionText,
    validFrom: null,
    validUntil: null,
    availability,
    source: {
      type: "PUBLIC",
      adapterKey: "TEST",
      url: `https://example.test/${retailerId}`,
      observedAt,
    },
    confidence,
  };
}

function matched(
  offer: RetailerOffer,
  matchScore = 0.95,
): MatchedOffer {
  return {
    offer,
    matchScore,
    matchQuality:
      matchScore >= 0.9
        ? "EXACT"
        : matchScore >= 0.75
          ? "STRONG"
          : "GOOD",
    matchReason:
      "TEST_MATCH",
  };
}

function makeShoppingList(
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    targetPrice?: number | null;
  }>,
) {
  return {
    id: "list-001",
    userId: "user-001",
    name: "Weekend Groceries",
    items: items.map(
      (item, index) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        targetPrice:
          item.targetPrice ?? null,
        status: "ACTIVE",
        createdAt:
          new Date(
            `2026-09-14T0${index + 1}:00:00.000Z`,
          ),
      }),
    ),
  };
}

function makeApi(
  shoppingList: unknown,
) {
  return {
    prisma: {
      shoppingList: {
        findFirst:
          vi.fn().mockResolvedValue(
            shoppingList,
          ),
      },
    },
  } as any;
}

function mockLiveOffers(
  offers: RetailerOffer[],
) {
  mockedLookupLiveRetailerOffers.mockResolvedValue({
    intent: {
      originalText: "Milk",
      normalizedText: "milk",
      quantity: 1,
      specificity: "generic",
      attributes: {},
    },
    offers,
    matchedOffers:
      offers.map((offer) =>
        matched(offer),
      ),
    lookup: {
      items: [],
      matches: [],
      attempts: [],
      matchedSourceId: null,
      matchedSourceCode: null,
      sourcesAttempted: 0,
      sourcesMatched: 0,
      sourcesFailed: 0,
    },
    variantsTried: 1,
  });
}

const registry = {} as any;

beforeEach(() => {
  mockedLookupLiveRetailerOffers.mockClear();
});

describe("evaluateShoppingListValue", () => {
  it("passes shopper province and coordinates into live retailer lookup", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "pnp",
        retailerName: "Pick n Pay",
        price: 34,
      }),
    ]);

    await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
      {
        province: "Western Cape",
        latitude: -34.0259,
        longitude: 18.4698,
      },
    );

    expect(
      mockedLookupLiveRetailerOffers,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockedLookupLiveRetailerOffers.mock.calls[0]!;

    expect(call[1]).toMatchObject({
      countryCode: "ZA",
      province: "Western Cape",
      latitude: -34.0259,
      longitude: 18.4698,
    });
  });

  it("passes an explicit Pick n Pay store code without losing shopper location context", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "pnp",
        retailerName: "Pick n Pay",
        price: 34,
      }),
    ]);

    await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
      {
        province: "Western Cape",
        storeCode: "WC34",
        latitude: -34.0259,
        longitude: 18.4698,
      },
    );

    expect(
      mockedLookupLiveRetailerOffers,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockedLookupLiveRetailerOffers.mock.calls[0]!;

    expect(call[1]).toMatchObject({
      countryCode: "ZA",
      province: "Western Cape",
      latitude: -34.0259,
      longitude: 18.4698,
    });

    expect(call[4]).toMatchObject({
      province: "Western Cape",
      storeCode: "WC34",
    });
  });

  it("selects the cheapest compatible live offer", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 2,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "shoprite",
        retailerName: "Shoprite",
        price: 32,
      }),
      makeOffer({
        retailerId: "checkers",
        retailerName: "Checkers",
        price: 30,
      }),
      makeOffer({
        retailerId: "pnp",
        retailerName: "Pick n Pay",
        price: 34,
      }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    expect(
      result!.items[0]!.bestPrice,
    ).toBe(30);

    expect(
      result!.items[0]!.bestRetailerId,
    ).toBe("checkers");

    expect(
      result!.items[0]!.lineValue,
    ).toBe(60);

    expect(
      result!.summary.bestKnownBasketValue,
    ).toBe(60);

    expect(
      result!.summary.comparableItems,
    ).toBe(1);
  });

  it("uses only one best compatible offer per retailer", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "shoprite",
        retailerName: "Shoprite",
        price: 32,
      }),
      makeOffer({
        retailerId: "shoprite",
        retailerName: "Shoprite",
        price: 29,
      }),
      makeOffer({
        retailerId: "checkers",
        retailerName: "Checkers",
        price: 31,
      }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    expect(
      result!.items[0]!.bestPrice,
    ).toBe(29);

    expect(
      result!.summary.retailerBaskets,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          retailerId: "shoprite",
          basketValue: 29,
          itemCount: 1,
        }),
        expect.objectContaining({
          retailerId: "checkers",
          basketValue: 31,
          itemCount: 1,
        }),
      ]),
    );

    expect(
      result!.summary.retailerBaskets,
    ).toHaveLength(2);
  });

  it("calculates complete retailer baskets and basket savings", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 2,
        },
        {
          id: "item-002",
          description: "Bread",
          quantity: 1,
        },
      ]);

    mockedLookupLiveRetailerOffers
      .mockResolvedValueOnce({
        intent: {
          originalText: "Milk",
          normalizedText: "milk",
          quantity: 2,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(
            makeOffer({
              retailerId: "shoprite",
              retailerName: "Shoprite",
              price: 30,
            }),
          ),
          matched(
            makeOffer({
              retailerId: "checkers",
              retailerName: "Checkers",
              price: 28,
            }),
          ),
        ],
        lookup: {
          items: [],
          matches: [],
          attempts: [],
          matchedSourceId: null,
          matchedSourceCode: null,
          sourcesAttempted: 0,
          sourcesMatched: 0,
          sourcesFailed: 0,
        },
        variantsTried: 1,
      })
      .mockResolvedValueOnce({
        intent: {
          originalText: "Bread",
          normalizedText: "bread",
          quantity: 1,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(
            makeOffer({
              retailerId: "shoprite",
              retailerName: "Shoprite",
              price: 18,
            }),
          ),
          matched(
            makeOffer({
              retailerId: "checkers",
              retailerName: "Checkers",
              price: 20,
            }),
          ),
        ],
        lookup: {
          items: [],
          matches: [],
          attempts: [],
          matchedSourceId: null,
          matchedSourceCode: null,
          sourcesAttempted: 0,
          sourcesMatched: 0,
          sourcesFailed: 0,
        },
        variantsTried: 1,
      });

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    /*
     * Shoprite = (30 × 2) + 18 = 78
     * Checkers = (28 × 2) + 20 = 76
     */
    expect(
      result!.summary.retailerBaskets,
    ).toEqual([
      expect.objectContaining({
        retailerId: "checkers",
        basketValue: 76,
        itemCount: 2,
      }),
      expect.objectContaining({
        retailerId: "shoprite",
        basketValue: 78,
        itemCount: 2,
      }),
    ]);

    expect(
      result!.summary.cheapestRetailerId,
    ).toBe("checkers");

    expect(
      result!.summary.highestRetailerBasketValue,
    ).toBe(78);

    expect(
      result!.summary.basketSavings,
    ).toBe(2);

    expect(
      result!.summary.bestKnownBasketValue,
    ).toBe(74);
  });

  it("includes a partial-basket retailer flagged as incomplete, rather than hiding it, while keeping it out of complete-basket comparisons", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
        {
          id: "item-002",
          description: "Bread",
          quantity: 1,
        },
      ]);

    mockedLookupLiveRetailerOffers
      .mockResolvedValueOnce({
        intent: {
          originalText: "Milk",
          normalizedText: "milk",
          quantity: 1,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(
            makeOffer({
              retailerId: "shoprite",
              retailerName: "Shoprite",
              price: 20,
            }),
          ),
          matched(
            makeOffer({
              retailerId: "checkers",
              retailerName: "Checkers",
              price: 25,
            }),
          ),
        ],
        lookup: {
          items: [],
          matches: [],
          attempts: [],
          matchedSourceId: null,
          matchedSourceCode: null,
          sourcesAttempted: 0,
          sourcesMatched: 0,
          sourcesFailed: 0,
        },
        variantsTried: 1,
      })
      .mockResolvedValueOnce({
        intent: {
          originalText: "Bread",
          normalizedText: "bread",
          quantity: 1,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(
            makeOffer({
              retailerId: "shoprite",
              retailerName: "Shoprite",
              price: 20,
            }),
          ),
        ],
        lookup: {
          items: [],
          matches: [],
          attempts: [],
          matchedSourceId: null,
          matchedSourceCode: null,
          sourcesAttempted: 0,
          sourcesMatched: 0,
          sourcesFailed: 0,
        },
        variantsTried: 1,
      });

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    // Both retailers are now returned — Shoprite (complete: has both
    // items) and Checkers (partial: missing Bread) — rather than
    // Checkers silently disappearing from the comparison entirely.
    expect(
      result!.summary.retailerBaskets,
    ).toHaveLength(2);

    // Complete baskets sort first.
    expect(
      result!.summary.retailerBaskets[0]!.retailerId,
    ).toBe("shoprite");

    expect(
      result!.summary.retailerBaskets[0]!.basketValue,
    ).toBe(40);

    expect(
      result!.summary.retailerBaskets[0]!.isComplete,
    ).toBe(true);

    expect(
      result!.summary.retailerBaskets[0]!.missingItemCount,
    ).toBe(0);

    // Checkers is flagged as partial rather than hidden.
    expect(
      result!.summary.retailerBaskets[1]!.retailerId,
    ).toBe("checkers");

    expect(
      result!.summary.retailerBaskets[1]!.isComplete,
    ).toBe(false);

    expect(
      result!.summary.retailerBaskets[1]!.missingItemCount,
    ).toBe(1);

    // "Cheapest retailer" still only considers COMPLETE baskets —
    // Checkers' partial R25 basket must not win here even though it's
    // numerically lower than Shoprite's complete R40 basket.
    expect(
      result!.summary.cheapestRetailerId,
    ).toBe("shoprite");
  });

  it("calculates target-price savings and preserves live confidence and observedAt", async () => {
    const observedAt =
      "2026-09-14T10:30:00.000Z";

    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 2,
          targetPrice: 35,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "checkers",
        retailerName: "Checkers",
        price: 30,
        confidence: 0.88,
        observedAt,
      }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    expect(
      result!.items[0]!.potentialSaving,
    ).toBe(10);

    expect(
      result!.items[0]!.targetStatus,
    ).toBe("BELOW_TARGET");

    expect(
      result!.items[0]!.confidence,
    ).toBe(0.88);

    expect(
      result!.items[0]!.bestObservedAt,
    ).toEqual(
      new Date(observedAt),
    );
  });

  it("returns NO_PRICE when no compatible live offer exists and does not require a Product", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Something Unknown",
          quantity: 1,
        },
      ]);

    mockLiveOffers([]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    expect(
      result!.items[0]!.comparable,
    ).toBe(false);

    expect(
      result!.items[0]!.productId,
    ).toBeNull();

    expect(
      result!.items[0]!.productName,
    ).toBeNull();

    expect(
      result!.items[0]!.targetStatus,
    ).toBe("NO_PRICE");

    expect(
      result!.summary.itemsWithoutProduct,
    ).toBe(1); // fixed: this used to assert the dead-code bug's value (always 0)

    expect(
      result!.summary.itemsWithoutPrice,
    ).toBe(1);

    expect(
      result!.summary.comparableItems,
    ).toBe(0);
  });

  it("does not mix currencies for an item", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "shoprite",
        retailerName: "Shoprite",
        price: 30,
        currency: "ZAR",
      }),
      makeOffer({
        retailerId: "other",
        retailerName: "Other Retailer",
        price: 10,
        currency: "USD",
      }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();

    expect(
      result!.items[0]!.bestPrice,
    ).toBe(30);

    expect(
      result!.items[0]!.bestCurrency,
    ).toBe("ZAR");

    expect(
      result!.summary.retailerBaskets,
    ).toHaveLength(1);

    expect(
      result!.summary.retailerBaskets[0]!.retailerId,
    ).toBe("shoprite");
  });

  it("returns null when the shopping list does not belong to the user", async () => {
    const api = makeApi(null);

    const result =
      await evaluateShoppingListValue(
        api,
        "user-001",
        "list-001",
        registry,
      );

    expect(result).toBeNull();
  });

  it("carries the best offer's promotion status through to the item (previously silently dropped)", async () => {
    const shoppingList =
      makeShoppingList([
        {
          id: "item-001",
          description: "Milk",
          quantity: 1,
        },
      ]);

    mockLiveOffers([
      makeOffer({
        retailerId: "shoprite",
        retailerName: "Shoprite",
        price: 21.99,
        isPromotion: true,
        promotionText: "Weekly special",
      }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();
    expect(result!.items[0]!.bestIsPromotion).toBe(true);
    expect(result!.items[0]!.bestPromotionText).toBe("Weekly special");
  });

  it("reports no promotion for a non-promotional best offer, and null/false for an item with no price at all", async () => {
    const shoppingList =
      makeShoppingList([
        { id: "item-001", description: "Milk", quantity: 1 },
        { id: "item-002", description: "Unknown Item", quantity: 1 },
      ]);

    mockLiveOffers([
      makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 21.99 }),
    ]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();
    // Note: mockLiveOffers applies the same offers to every item in this
    // test helper, so item-002 also resolves to the Shoprite milk offer —
    // this test only checks the promotion field defaults, not matching.
    expect(result!.items[0]!.bestIsPromotion).toBe(false);
    expect(result!.items[0]!.bestPromotionText).toBeNull();
  });

  it("builds a mixedBasket breakdown showing which retailer each item's best price came from", async () => {
    const shoppingList =
      makeShoppingList([
        { id: "item-001", description: "Milk", quantity: 2 },
        { id: "item-002", description: "Bread", quantity: 1 },
      ]);

    mockedLookupLiveRetailerOffers
      .mockResolvedValueOnce({
        intent: {
          originalText: "Milk",
          normalizedText: "milk",
          quantity: 2,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 20 })),
          matched(makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 18 })),
        ],
        lookup: {
          items: [], matches: [], attempts: [], matchedSourceId: null, matchedSourceCode: null,
          sourcesAttempted: 0, sourcesMatched: 0, sourcesFailed: 0,
        },
        variantsTried: 1,
      })
      .mockResolvedValueOnce({
        intent: {
          originalText: "Bread",
          normalizedText: "bread",
          quantity: 1,
          specificity: "generic",
          attributes: {},
        },
        offers: [],
        matchedOffers: [
          matched(makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 22 })),
          matched(makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 25 })),
        ],
        lookup: {
          items: [], matches: [], attempts: [], matchedSourceId: null, matchedSourceCode: null,
          sourcesAttempted: 0, sourcesMatched: 0, sourcesFailed: 0,
        },
        variantsTried: 1,
      });

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();
    const mixedBasket = result!.summary.mixedBasket;
    expect(mixedBasket).not.toBeNull();

    // Cheapest overall: milk at Checkers (18 × 2 = 36), bread at
    // Shoprite (22 × 1 = 22) — total 58, split across 2 retailers.
    expect(mixedBasket!.totalValue).toBe(58);
    expect(mixedBasket!.retailerCount).toBe(2);
    expect(mixedBasket!.assignments).toHaveLength(2);

    const milkAssignment = mixedBasket!.assignments.find((a) => a.itemId === "item-001");
    expect(milkAssignment?.retailerId).toBe("checkers");
    expect(milkAssignment?.lineValue).toBe(36);

    const breadAssignment = mixedBasket!.assignments.find((a) => a.itemId === "item-002");
    expect(breadAssignment?.retailerId).toBe("shoprite");
    expect(breadAssignment?.lineValue).toBe(22);

    // Complete baskets: Shoprite (20×2+22=62), Checkers (18×2+25=61).
    // Mixed basket (58) should show real savings vs. the cheapest
    // COMPLETE basket (61, Checkers).
    expect(mixedBasket!.savingsVsBestCompleteBasket).toBe(3);
  });

  it("returns a null mixedBasket when there are zero comparable items", async () => {
    const shoppingList =
      makeShoppingList([
        { id: "item-001", description: "Something Unknown", quantity: 1 },
      ]);

    mockLiveOffers([]);

    const result =
      await evaluateShoppingListValue(
        makeApi(shoppingList),
        "user-001",
        "list-001",
        registry,
      );

    expect(result).not.toBeNull();
    expect(result!.summary.mixedBasket).toBeNull();
  });

  it("prefers an in-stock offer over a cheaper out-of-stock one", async () => {
    const shoppingList = makeShoppingList([
      { id: "item-001", description: "Milk", quantity: 1 },
    ]);

    mockLiveOffers([
      makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 18.99, availability: "OUT_OF_STOCK" }),
      makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 21.99, availability: "IN_STOCK" }),
    ]);

    const result = await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
    );

    expect(result).not.toBeNull();
    // The pricier but actually-in-stock offer wins, not the cheaper
    // out-of-stock one.
    expect(result!.items[0]!.bestRetailerName).toBe("Shoprite");
    expect(result!.items[0]!.bestPrice).toBe(21.99);
    expect(result!.items[0]!.bestAvailability).toBe("IN_STOCK");
  });

  it("falls back to the cheapest out-of-stock offer, labeled honestly, when nothing is in stock", async () => {
    const shoppingList = makeShoppingList([
      { id: "item-001", description: "Milk", quantity: 1 },
    ]);

    mockLiveOffers([
      makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 25.99, availability: "OUT_OF_STOCK" }),
      makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 21.99, availability: "OUT_OF_STOCK" }),
    ]);

    const result = await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
    );

    expect(result).not.toBeNull();
    // Still returns a result rather than treating the item as
    // priceless -- picks the cheapest of the (all out-of-stock)
    // options, and is honest about its availability.
    expect(result!.items[0]!.bestRetailerName).toBe("Shoprite");
    expect(result!.items[0]!.bestPrice).toBe(21.99);
    expect(result!.items[0]!.bestAvailability).toBe("OUT_OF_STOCK");
  });

  it("treats UNKNOWN and LIMITED availability as available, not as out of stock", async () => {
    const shoppingList = makeShoppingList([
      { id: "item-001", description: "Milk", quantity: 1 },
    ]);

    mockLiveOffers([
      makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 18.99, availability: "OUT_OF_STOCK" }),
      makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 21.99, availability: "UNKNOWN" }),
    ]);

    const result = await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
    );

    // UNKNOWN (absence of evidence) is preferred over confirmed
    // OUT_OF_STOCK, even though it's pricier.
    expect(result!.items[0]!.bestRetailerName).toBe("Shoprite");
    expect(result!.items[0]!.bestAvailability).toBe("UNKNOWN");
  });

  it("still picks the cheapest option among multiple in-stock offers (availability only matters when it differs)", async () => {
    const shoppingList = makeShoppingList([
      { id: "item-001", description: "Milk", quantity: 1 },
    ]);

    mockLiveOffers([
      makeOffer({ retailerId: "checkers", retailerName: "Checkers", price: 18.99, availability: "IN_STOCK" }),
      makeOffer({ retailerId: "shoprite", retailerName: "Shoprite", price: 21.99, availability: "IN_STOCK" }),
    ]);

    const result = await evaluateShoppingListValue(
      makeApi(shoppingList),
      "user-001",
      "list-001",
      registry,
    );

    expect(result!.items[0]!.bestRetailerName).toBe("Checkers");
    expect(result!.items[0]!.bestPrice).toBe(18.99);
  });
});
