import { describe, expect, it } from "vitest";
import {
  normalizeText,
  tokenise,
  tokenOverlap,
  matchesCatalogueQuery,
} from "../../src/modules/retail-catalogue/retail-catalogue.matching.util.js";

describe("retail-catalogue.matching.util", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeText("  Full-Cream  Milk, 2L! ")).toBe("full cream milk 2l");
  });

  it("tokenises normalized text into a set", () => {
    expect(tokenise("Coca-Cola 2L")).toEqual(new Set(["coca", "cola", "2l"]));
  });

  it("computes token overlap as a fraction of the larger set", () => {
    const left = tokenise("full cream milk");
    const right = tokenise("full cream milk 2l");
    expect(tokenOverlap(left, right)).toBeCloseTo(3 / 4);
  });

  it("returns 0 overlap when either set is empty", () => {
    expect(tokenOverlap(new Set(), tokenise("milk"))).toBe(0);
  });

  describe("matchesCatalogueQuery", () => {
    it("matches on GTIN regardless of name", () => {
      const item = { name: "Completely different name", gtin: "6001234567890" };
      const query = { name: "milk", gtin: "6001234567890" };
      expect(matchesCatalogueQuery(item, query)).toBe(true);
    });

    it("rejects when name has zero token overlap", () => {
      const item = { name: "Coca-Cola 2L" };
      const query = { name: "Full Cream Milk" };
      expect(matchesCatalogueQuery(item, query)).toBe(false);
    });

    it("accepts on sufficient name overlap with no conflicting attributes", () => {
      const item = { name: "Clover Full Cream Milk 2L" };
      const query = { name: "full cream milk" };
      expect(matchesCatalogueQuery(item, query)).toBe(true);
    });

    it("rejects when brand explicitly conflicts even with name overlap", () => {
      const item = { name: "Clover Full Cream Milk 2L", brand: "Clover" };
      const query = { name: "full cream milk", brand: "Parmalat" };
      expect(matchesCatalogueQuery(item, query)).toBe(false);
    });

    it("treats an empty query name as a wildcard match", () => {
      const item = { name: "Anything at all" };
      expect(matchesCatalogueQuery(item, {})).toBe(true);
    });
  });
});
