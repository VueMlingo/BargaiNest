import { describe, expect, it } from "vitest";

import {
  matchOffersToIntent,
} from "../../src/modules/retailer-offers/retailer-offer.service.js";

import {
  createShoppingIntent,
} from "../../src/modules/shopping-intent/shopping-intent.service.js";

import type {
  RetailerOffer,
} from "../../src/modules/retailer-offers/retailer-offer.types.js";

const retailer = {
  id: "retailer-1",
  code: "SHOPRITE",
  name: "Shoprite",
};

function offer(
  overrides: Partial<RetailerOffer> = {},
): RetailerOffer {
  return {
    retailer,
    name: "Full Cream Milk 2L",
    brand: "Shoprite",
    packSize: "2L",
    unit: "L",
    category: "Dairy",
    price: 34.99,
    currency: "ZAR",
    wasPrice: null,
    isPromotion: false,
    promotionText: null,
    validFrom: null,
    validUntil: null,
    availability: "IN_STOCK",
    source: {
      type: "PUBLIC",
      adapterKey: "TEST",
      url: null,
      observedAt: new Date().toISOString(),
    },
    confidence: 0.9,
    ...overrides,
  };
}

describe("matchOffersToIntent", () => {
  it("matches a generic milk intent to suitable offers", () => {
    const intent = createShoppingIntent({
      text: "milk",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Full Cream Milk 2L",
        }),
        offer({
          name: "Chocolate Milk 1L",
          packSize: "1L",
        }),
      ],
    );

    expect(result.length).toBe(2);
    expect(result[0]?.matchScore).toBeGreaterThan(0);
  });

  it("ranks a requested brand above a different brand", () => {
    const intent = createShoppingIntent({
      text: "Coca-Cola 2L",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Coca-Cola 2L",
          brand: "Coca-Cola",
          packSize: "2L",
        }),
        offer({
          name: "Pepsi 2L",
          brand: "Pepsi",
          packSize: "2L",
        }),
      ],
    );

    expect(result[0]?.offer.brand).toBe("Coca-Cola");
    expect(result[0]?.matchScore).toBeGreaterThan(
      result[1]?.matchScore ?? 0,
    );
  });

  it("rejects a different brand for a specific brand request", () => {
    const intent = createShoppingIntent({
      text: "Coca-Cola",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Coca-Cola 2L",
          brand: "Coca-Cola",
          packSize: "2L",
        }),
        offer({
          name: "Pepsi 2L",
          brand: "Pepsi",
          packSize: "2L",
        }),
      ],
    );

    const pepsi = result.find(
      (item) => item.offer.brand === "Pepsi",
    );

    expect(pepsi?.matchScore).toBe(0);
    expect(pepsi?.matchQuality).toBe("WEAK");
    expect(pepsi?.matchReason).toContain(
      "requested brand does not match",
    );
  });

  it("matches coke to Coca-Cola", () => {
    const intent = createShoppingIntent({
      text: "coke",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Coca-Cola 2L",
          brand: "Coca-Cola",
          packSize: "2L",
        }),
        offer({
          name: "Pepsi 2L",
          brand: "Pepsi",
          packSize: "2L",
        }),
      ],
    );

    expect(result[0]?.offer.brand).toBe("Coca-Cola");
    expect(result[0]?.matchScore).toBeGreaterThan(0);

    const pepsi = result.find(
      (item) => item.offer.brand === "Pepsi",
    );

    expect(pepsi?.matchScore).toBe(0);
  });

  it("enforces the requested pack size", () => {
    const intent = createShoppingIntent({
      text: "milk 2L",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Full Cream Milk 2L",
          packSize: "2L",
        }),
        offer({
          name: "Full Cream Milk 1L",
          packSize: "1L",
        }),
      ],
    );

    expect(result[0]?.offer.packSize).toBe("2L");
    expect(result[0]?.matchScore).toBeGreaterThan(0);

    const oneLitre = result.find(
      (item) => item.offer.packSize === "1L",
    );

    expect(oneLitre?.matchScore).toBe(0);
    expect(oneLitre?.matchReason).toContain(
      "requested pack size does not match",
    );
  });

  it("allows different pack sizes for a generic request", () => {
    const intent = createShoppingIntent({
      text: "milk",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Full Cream Milk 2L",
          packSize: "2L",
        }),
        offer({
          name: "Full Cream Milk 1L",
          packSize: "1L",
        }),
      ],
    );

    expect(result).toHaveLength(2);
    expect(
      result.every((item) => item.matchScore > 0),
    ).toBe(true);
  });

  it("enforces the requested full cream variant", () => {
    const intent = createShoppingIntent({
      text: "full cream milk",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Full Cream Milk 2L",
          packSize: "2L",
        }),
        offer({
          name: "Low Fat Milk 2L",
          packSize: "2L",
        }),
      ],
    );

    const fullCream = result.find(
      (item) =>
        item.offer.name === "Full Cream Milk 2L",
    );

    const lowFat = result.find(
      (item) =>
        item.offer.name === "Low Fat Milk 2L",
    );

    expect(fullCream?.matchScore).toBeGreaterThan(0);
    expect(lowFat?.matchScore).toBe(0);
    expect(lowFat?.matchReason).toContain(
      "requested variant does not match",
    );
  });

  it("keeps scores between zero and one", () => {
    const intent = createShoppingIntent({
      text: "milk",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [offer()],
    );

    expect(result[0]?.matchScore).toBeGreaterThanOrEqual(0);
    expect(result[0]?.matchScore).toBeLessThanOrEqual(1);
  });

  it("returns offers ordered from highest to lowest score", () => {
    const intent = createShoppingIntent({
      text: "milk",
    });

    const result = matchOffersToIntent(
      {
        retailerId: retailer.id,
        intent,
      },
      [
        offer({
          name: "Chocolate Milk 1L",
          packSize: "1L",
        }),
        offer({
          name: "Full Cream Milk 2L",
          packSize: "2L",
        }),
      ],
    );

    expect(
      result[0]?.matchScore ?? 0,
    ).toBeGreaterThanOrEqual(
      result[1]?.matchScore ?? 0,
    );
  });
});
