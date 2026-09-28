import { describe, expect, it } from "vitest";
import {
  findEquivalenceGroupsForText,
  findEquivalenceGroupById,
  PRODUCT_EQUIVALENCE_GROUPS,
} from "../../src/modules/shopping-intent/product-equivalence.registry.js";

describe("product-equivalence.registry", () => {
  it("finds the milk group for the literal term that was failing in real testing", () => {
    const groups = findEquivalenceGroupsForText("milk");
    expect(groups.map((g) => g.id)).toContain("milk-full-cream");
  });

  it("finds the cola group for 'coke', not just 'cola'", () => {
    expect(findEquivalenceGroupsForText("coke").map((g) => g.id)).toContain("cola");
  });

  it("finds the tea group for 'tea bags'", () => {
    expect(findEquivalenceGroupsForText("tea bags").map((g) => g.id)).toContain("tea-bags");
  });

  it("still finds bread and sugar (the ones that were already working)", () => {
    expect(findEquivalenceGroupsForText("bread").map((g) => g.id)).toContain("bread-white");
    expect(findEquivalenceGroupsForText("sugar").map((g) => g.id)).toContain("sugar-white");
  });

  it("does not match a keyword as a substring of an unrelated word (word-boundary aware)", () => {
    // "tea" should not match inside "steak"
    expect(findEquivalenceGroupsForText("steak").map((g) => g.id)).not.toContain("tea-bags");
  });

  it("returns an empty list for a term with no known equivalence group", () => {
    expect(findEquivalenceGroupsForText("artisanal kombucha")).toEqual([]);
  });

  it("every group has at least one search variant (an empty group would expand to nothing)", () => {
    for (const group of PRODUCT_EQUIVALENCE_GROUPS) {
      expect(group.searchVariants.length).toBeGreaterThan(0);
    }
  });

  it("findEquivalenceGroupById resolves a known id and returns null for an unknown one", () => {
    expect(findEquivalenceGroupById("milk-full-cream")?.canonicalLabel).toBe("Milk");
    expect(findEquivalenceGroupById("does-not-exist")).toBeNull();
  });
});
