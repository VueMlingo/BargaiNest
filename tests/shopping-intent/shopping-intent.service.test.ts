import { describe, expect, it } from "vitest";

import {
  createShoppingIntent,
} from "../../src/modules/shopping-intent/shopping-intent.service.js";

describe("createShoppingIntent", () => {
  it("creates a generic intent for a simple product request", () => {
    const result = createShoppingIntent({
      text: "milk",
    });

    expect(result.originalText).toBe("milk");
    expect(result.normalizedText).toBe("milk");
    expect(result.quantity).toBe(1);
    expect(result.specificity).toBe("generic");
    expect(result.attributes.category).toBe("dairy");
  });

  it("creates a specific intent for full cream milk", () => {
    const result = createShoppingIntent({
      text: "full cream milk",
    });

    expect(result.specificity).toBe("specific");
    expect(result.attributes.category).toBe("dairy");
    expect(result.attributes.variant).toBe("full cream");
  });

  it("creates a specific intent for white bread", () => {
    const result = createShoppingIntent({
      text: "white bread",
    });

    expect(result.specificity).toBe("specific");
    expect(result.attributes.category).toBe("bread");
    expect(result.attributes.variant).toBe("white");
  });

  it("extracts brand and pack size from a branded request", () => {
    const result = createShoppingIntent({
      text: "Coca-Cola 2L",
    });

    expect(result.specificity).toBe("specific");
    expect(result.attributes.brand).toBe("coca-cola");
    expect(result.attributes.packSize).toBe("2l");
  });

  it("preserves quantity", () => {
    const result = createShoppingIntent({
      text: "milk",
      quantity: 3,
    });

    expect(result.quantity).toBe(3);
  });

  it("preserves target price", () => {
    const result = createShoppingIntent({
      text: "milk",
      targetPrice: 25.99,
    });

    expect(result.targetPrice).toBe(25.99);
  });

  it("normalizes whitespace and casing", () => {
    const result = createShoppingIntent({
      text: "  FULL   CREAM   MILK  ",
    });

    expect(result.originalText).toBe("FULL   CREAM   MILK");
    expect(result.normalizedText).toBe("full cream milk");
    expect(result.attributes.variant).toBe("full cream");
  });

  it("rejects empty text", () => {
    expect(() =>
      createShoppingIntent({
        text: "   ",
      }),
    ).toThrow("SHOPPING_INTENT_TEXT_REQUIRED");
  });

  it("rejects invalid quantity", () => {
    expect(() =>
      createShoppingIntent({
        text: "milk",
        quantity: 0,
      }),
    ).toThrow("SHOPPING_INTENT_QUANTITY_INVALID");
  });

  it("rejects negative target prices", () => {
    expect(() =>
      createShoppingIntent({
        text: "milk",
        targetPrice: -1,
      }),
    ).toThrow("SHOPPING_INTENT_TARGET_PRICE_INVALID");
  });
});

describe("shopping brand vocabulary", () => {
  it("maps coke to the canonical Coca-Cola brand", () => {
    const result = createShoppingIntent({
      text: "coke",
    });

    expect(result.normalizedText).toBe("coke");
    expect(result.attributes.brand).toBe("coca-cola");
    expect(result.specificity).toBe("specific");
  });

  it("maps coke 2L to Coca-Cola with the requested pack size", () => {
    const result = createShoppingIntent({
      text: "coke 2L",
    });

    expect(result.normalizedText).toBe("coke 2l");
    expect(result.attributes.brand).toBe("coca-cola");
    expect(result.attributes.packSize).toBe("2l");
    expect(result.specificity).toBe("specific");
  });

  it("maps Coca-Cola to the same canonical brand", () => {
    const result = createShoppingIntent({
      text: "Coca-Cola",
    });

    expect(result.attributes.brand).toBe("coca-cola");
  });

  it("does not treat Pepsi as Coca-Cola", () => {
    const result = createShoppingIntent({
      text: "Pepsi",
    });

    expect(result.attributes.brand).toBe("pepsi");
    expect(result.attributes.brand).not.toBe("coca-cola");
  });
});
