import { describe, expect, it } from "vitest";
import { createShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.service.js";
import { expandShoppingIntent } from "../../src/modules/shopping-intent/shopping-intent.expansion.js";

/**
 * REG-002 acceptance criteria, tested against the real pipeline
 * end to end (parse -> expand), not just the vocabulary table in
 * isolation -- this is what a real shopping-list entry actually goes
 * through.
 */
describe("REG-002: product alias matching (real end-to-end pipeline)", () => {
  it("'Coke' alone (no size) expands to include Coca-Cola search variants", () => {
    const intent = createShoppingIntent({ text: "Coke" });
    const expanded = expandShoppingIntent(intent);

    const queries = expanded.map((e) => e.query.toLowerCase());
    expect(queries.some((q) => q.includes("coca-cola") || q.includes("coca cola"))).toBe(true);
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((e) => e.fromEquivalenceExpansion)).toBe(true);
  });

  it("'Coca-Cola' and 'Coca Cola' (the canonical name and its spacing variant) both resolve to the same equivalence group as 'Coke'", () => {
    const cokeExpanded = expandShoppingIntent(createShoppingIntent({ text: "Coke" }));
    const cocaColaExpanded = expandShoppingIntent(createShoppingIntent({ text: "Coca-Cola" }));
    const cocaColaSpaceExpanded = expandShoppingIntent(createShoppingIntent({ text: "Coca Cola" }));

    const cokeGroupIds = new Set(cokeExpanded.map((e) => e.equivalenceGroupId));
    const cocaColaGroupIds = new Set(cocaColaExpanded.map((e) => e.equivalenceGroupId));
    const cocaColaSpaceGroupIds = new Set(cocaColaSpaceExpanded.map((e) => e.equivalenceGroupId));

    expect([...cokeGroupIds].some((id) => cocaColaGroupIds.has(id))).toBe(true);
    expect([...cokeGroupIds].some((id) => cocaColaSpaceGroupIds.has(id))).toBe(true);
  });

  it("REG-002's own explicit acceptance criteria: 'Coke 2L' must not match 'Coke 300ml' -- specifying a size searches literally, not expanded", () => {
    const twoLitre = createShoppingIntent({ text: "Coke 2L" });
    const threeHundredMl = createShoppingIntent({ text: "Coke 300ml" });

    expect(twoLitre.attributes.packSize).toBeTruthy();
    expect(threeHundredMl.attributes.packSize).toBeTruthy();
    expect(twoLitre.attributes.packSize).not.toBe(threeHundredMl.attributes.packSize);

    const twoLitreExpanded = expandShoppingIntent(twoLitre);
    const threeHundredMlExpanded = expandShoppingIntent(threeHundredMl);

    expect(twoLitreExpanded).toHaveLength(1);
    expect(twoLitreExpanded[0]!.fromEquivalenceExpansion).toBe(false);
    expect(threeHundredMlExpanded).toHaveLength(1);
    expect(threeHundredMlExpanded[0]!.fromEquivalenceExpansion).toBe(false);

    expect(twoLitreExpanded[0]!.query).not.toBe(threeHundredMlExpanded[0]!.query);
    expect(twoLitreExpanded[0]!.query.toLowerCase()).toContain("2l");
    expect(threeHundredMlExpanded[0]!.query.toLowerCase()).toMatch(/300\s*ml/);
  });

  it("does not depend on exact string equality -- case and punctuation variants of the same alias all resolve identically", () => {
    const variants = ["coke", "Coke", "COKE", "coca cola", "Coca-Cola", "COCA-COLA"];
    const groupIdSets = variants.map(
      (text) => new Set(expandShoppingIntent(createShoppingIntent({ text })).map((e) => e.equivalenceGroupId)),
    );

    for (let i = 0; i < groupIdSets.length; i++) {
      for (let j = i + 1; j < groupIdSets.length; j++) {
        const a = groupIdSets[i]!;
        const b = groupIdSets[j]!;
        const overlaps = [...a].some((id) => b.has(id));
        expect(overlaps).toBe(true);
      }
    }
  });

  it("a brand with no equivalence group at all still searches literally, unaffected (unrelated categories are not broken by this feature)", () => {
    const intent = createShoppingIntent({ text: "Some Totally Unknown Product Xyz123" });
    const expanded = expandShoppingIntent(intent);

    expect(expanded).toHaveLength(1);
    expect(expanded[0]!.fromEquivalenceExpansion).toBe(false);
    expect(expanded[0]!.query.toLowerCase()).toContain("some totally unknown product xyz123");
  });

  /**
   * The other four currently-seeded equivalence groups, given the
   * same real-pipeline treatment as Coke above -- proving REG-002's
   * fix is genuinely general, not something that happens to work only
   * for the one example named in the requirement.
   */
  it.each([
    { generic: "Milk", expectedSubstring: "full cream milk" },
    { generic: "Bread", expectedSubstring: "bread" },
    { generic: "Tea", expectedSubstring: "tea" },
    { generic: "Sugar", expectedSubstring: "sugar" },
  ])("'$generic' (generic, no size) expands into real concrete search variants", ({ generic, expectedSubstring }) => {
    const expanded = expandShoppingIntent(createShoppingIntent({ text: generic }));
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((e) => e.fromEquivalenceExpansion)).toBe(true);
    expect(expanded.some((e) => e.query.toLowerCase().includes(expectedSubstring))).toBe(true);
  });

  it("'Rooibos' (a keyword alias, not the canonical label itself) still resolves to the Tea equivalence group", () => {
    const expanded = expandShoppingIntent(createShoppingIntent({ text: "Rooibos" }));
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.some((e) => e.equivalenceGroupId === "tea-bags")).toBe(true);
  });

  it("a specific size on Milk/Bread/Tea/Sugar also stays literal, not expanded -- the same size-preservation rule applies to every group, not just Coke", () => {
    const milkWithSize = createShoppingIntent({ text: "Milk 2L" });
    const breadWithSize = createShoppingIntent({ text: "Bread 700g" });

    const milkExpanded = expandShoppingIntent(milkWithSize);
    const breadExpanded = expandShoppingIntent(breadWithSize);

    expect(milkExpanded).toHaveLength(1);
    expect(milkExpanded[0]!.fromEquivalenceExpansion).toBe(false);
    expect(breadExpanded).toHaveLength(1);
    expect(breadExpanded[0]!.fromEquivalenceExpansion).toBe(false);
  });

  it("'tea' does not falsely match inside an unrelated word (word-boundary matching, e.g. 'steak' must not trigger the Tea group)", () => {
    const expanded = expandShoppingIntent(createShoppingIntent({ text: "Steak" }));
    expect(expanded.every((e) => e.equivalenceGroupId !== "tea-bags")).toBe(true);
  });
});
