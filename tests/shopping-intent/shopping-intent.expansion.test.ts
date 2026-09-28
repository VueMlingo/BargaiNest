import { describe, expect, it } from "vitest";
import { expandShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.expansion.js";
import { createShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.service.js";

describe("expandShoppingIntent — the actual fix for milk/tea/coke returning no price", () => {
  it("expands a generic 'milk' intent into multiple concrete, searchable variants", () => {
    const intent = createShoppingIntent({ text: "milk" });
    expect(intent.specificity).toBe("generic"); // confirms this is the failing case from real testing

    const terms = expandShoppingIntent(intent);

    expect(terms.length).toBeGreaterThan(1);
    expect(terms.every((t) => t.fromEquivalenceExpansion)).toBe(true);
    expect(terms.map((t) => t.query)).toContain("full cream milk 1l");
  });

  it("expands 'coke' via the brand vocabulary path into concrete cola variants", () => {
    const intent = createShoppingIntent({ text: "coke" });
    const terms = expandShoppingIntent(intent);
    expect(terms.map((t) => t.query)).toContain("coca-cola 2l");
  });

  it("expands 'tea bags' into concrete tea variants", () => {
    const intent = createShoppingIntent({ text: "tea bags" });
    const terms = expandShoppingIntent(intent);
    expect(terms.map((t) => t.query).some((q) => q.includes("tea"))).toBe(true);
  });

  it("does NOT expand a specific intent — trusts the user's own detail as-is", () => {
    const intent = createShoppingIntent({ text: "low fat milk 2l" });
    expect(intent.specificity).toBe("specific");

    const terms = expandShoppingIntent(intent);

    expect(terms).toHaveLength(1);
    expect(terms[0]?.fromEquivalenceExpansion).toBe(false);
    expect(terms[0]?.query).toBe(intent.normalizedText);
  });

  it("falls back to the intent's own text for a generic term with no known equivalence group, unchanged from before this existed", () => {
    const intent = createShoppingIntent({ text: "artisanal kombucha" });
    const terms = expandShoppingIntent(intent);

    expect(terms).toHaveLength(1);
    expect(terms[0]?.fromEquivalenceExpansion).toBe(false);
    expect(terms[0]?.query).toBe(intent.normalizedText);
  });

  it("never returns zero terms, even in the fallback case", () => {
    const intent = createShoppingIntent({ text: "xyz123 nonsense term" });
    expect(expandShoppingIntent(intent).length).toBeGreaterThanOrEqual(1);
  });
});
