import { describe, expect, it } from "vitest";
import { normalizeCatalogueItem } from "../../src/modules/retail-catalogue/retail-catalogue.normalizer.js";
import { extractPackSize } from "../../src/modules/shopping-intent/pack-size.util.js";
import type { RawCatalogueItem } from "../../src/modules/retail-catalogue/retail-catalogue.types.js";

function baseItem(overrides: Partial<RawCatalogueItem> = {}): RawCatalogueItem {
  return {
    name: "Clover Fresh Full Cream Milk 2L",
    extractionMethod: "API",
    ...overrides,
  };
}

describe("normalizeCatalogueItem: existing behaviour (regression)", () => {
  it("uses the adapter-supplied packSize when one is actually provided", () => {
    const result = normalizeCatalogueItem(baseItem({ packSize: "2L" }));
    expect(result.packSize).toBe("2L");
  });

  it("still throws on a missing/empty name", () => {
    expect(() => normalizeCatalogueItem(baseItem({ name: "   " }))).toThrow("CATALOGUE_ITEM_NAME_REQUIRED");
  });

  it("normalizes price/currency/confidence exactly as before", () => {
    const result = normalizeCatalogueItem(baseItem({ price: 24.999, currency: "zar", extractionConfidence: 1.4 }));
    expect(result.price).toBe(25);
    expect(result.currency).toBe("ZAR");
    expect(result.extractionConfidence).toBe(1);
  });
});

describe("normalizeCatalogueItem: BN-029/031 packSize fallback", () => {
  it("falls back to extracting packSize from the raw name when the adapter provides none at all -- exactly the Pick n Pay Hybris / Woolworths Constructor.io case", () => {
    const result = normalizeCatalogueItem(baseItem({ name: "Clover Fresh Full Cream Milk 2L" }));
    expect(result.packSize).toBe("2l");
  });

  it("the fallback-extracted packSize matches what shopping-intent parsing produces for the equivalent user request -- this is the actual fix: both sides of the match now agree", () => {
    const retailerResult = normalizeCatalogueItem(baseItem({ name: "Clover Fresh Full Cream Milk 2L" }));
    const userRequestedPackSize = extractPackSize("Milk 2L");
    expect(retailerResult.packSize).toBe(userRequestedPackSize);
  });

  it("extracts multipack sizes from the product name too", () => {
    const result = normalizeCatalogueItem(baseItem({ name: "Clover Milk 6 x 1L" }));
    expect(result.packSize).toBe("6 x 1l");
  });

  it("a product name with no recognisable size still normalizes to null, not an error", () => {
    const result = normalizeCatalogueItem(baseItem({ name: "Generic Grocery Item" }));
    expect(result.packSize).toBeNull();
  });

  it("an adapter-supplied packSize always wins over the name-extraction fallback, even if they'd differ", () => {
    const result = normalizeCatalogueItem(baseItem({ name: "Milk 2L", packSize: "1L" }));
    expect(result.packSize).toBe("1L");
  });
});
