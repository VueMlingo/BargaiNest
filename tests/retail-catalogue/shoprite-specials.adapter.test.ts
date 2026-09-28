import { describe, expect, it } from "vitest";

import {
  parseShopriteSpecialsPayload,
  ShopriteSpecialsAdapter,
} from "../../src/modules/retail-catalogue/adapters/shoprite-specials.adapter.js";

describe("Shoprite specials adapter", () => {
  it("converts retailer-published specials into catalogue items without inventing prices", () => {
    const result = parseShopriteSpecialsPayload({
      sourceReference:
        "https://specials.shoprite.co.za/example-publication",
      validFrom: new Date("2026-09-04T00:00:00Z"),
      validUntil: new Date("2026-09-06T23:59:59Z"),
      items: [
        {
          externalId: "SHOPRITE-001",
          name: "Ritebrand Spaghetti 500g",
          brand: "Ritebrand",
          packSize: "500g",
          unit: "500g",
          category: "Pantry",
          price: 20,
          promotionText: "Special",
        },
      ],
    });

    expect(result).toHaveLength(1);

    expect(result[0]!.name).toBe(
      "Ritebrand Spaghetti 500g"
    );

    expect(result[0]!.price).toBe(20);
    expect(result[0]!.currency).toBe("ZAR");

    expect(result[0]!.isPromotion).toBe(true);

    expect(result[0]!.validFrom).toEqual(
      new Date("2026-09-04T00:00:00Z")
    );

    expect(result[0]!.validUntil).toEqual(
      new Date("2026-09-06T23:59:59Z")
    );

    expect(result[0]!.sourceReference).toContain(
      "specials.shoprite.co.za"
    );

    expect(result[0]!.extractionMethod).toBe(
      "PDF_TEXT"
    );

    expect(result[0]!.extractionConfidence).toBe(
      0.95
    );
  });

  it("preserves an item without a price rather than inventing one", () => {
    const result = parseShopriteSpecialsPayload({
      sourceReference:
        "https://specials.shoprite.co.za/example-publication",
      items: [
        {
          name: "Example Product",
          promotionText: "See in store",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Example Product");
    expect(result[0]!.price).toBeUndefined();
  });

  it("filters malformed items with no product name", () => {
    const result = parseShopriteSpecialsPayload({
      sourceReference:
        "https://specials.shoprite.co.za/example-publication",
      items: [
        {
          name: "   ",
          price: 50,
        },
        {
          name: "Valid Product",
          price: 25,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Valid Product");
  });

  it("discovers items through the adapter contract", async () => {
    const adapter = new ShopriteSpecialsAdapter(
      async () => ({
        sourceReference:
          "https://specials.shoprite.co.za/example-publication",
        items: [
          {
            name: "Example Product",
            price: 29.99,
          },
        ],
      })
    );

    const result = await adapter.discover({
      catalogueSourceId: "source-001",
      retailerId: "retailer-001",
      channel: "PHYSICAL_CATALOGUE",
      sourceType: "PDF",
      sourceUrl:
        "https://specials.shoprite.co.za/example-publication",
      countryCode: "ZA",
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Example Product");
    expect(result[0]!.price).toBe(29.99);
  });
});
