import type { ProductEquivalenceGroup } from "./product-equivalence.types.js";

/**
 * Seeded with the exact five categories mentioned in the project's own
 * testing notes — Milk, Tea, Coke were confirmed failing; Bread, Sugar
 * were confirmed working (their generic terms happen to already match
 * common product names closely enough). All five are included so the
 * "already working" ones have regression coverage too, not just the
 * broken ones.
 *
 * This is intentionally a small, hand-curated starting set, not an
 * attempt at a comprehensive grocery taxonomy — matching the project's
 * own explicit architectural decision NOT to build a large internal
 * product catalogue. Add more groups as more categories are found
 * failing in real testing, the same way these five were identified.
 */
export const PRODUCT_EQUIVALENCE_GROUPS: readonly ProductEquivalenceGroup[] = [
  {
    id: "milk-full-cream",
    category: "dairy",
    canonicalLabel: "Milk",
    matchKeywords: ["milk"],
    searchVariants: [
      "full cream milk 1l",
      "full cream milk 2l",
      "long life full cream milk 1l",
      "fresh milk 1l",
      "low fat milk 1l",
      "uht milk 1l",
    ],
  },
  {
    id: "bread-white",
    category: "bread",
    canonicalLabel: "Bread",
    matchKeywords: ["bread"],
    searchVariants: [
      "white bread 700g",
      "brown bread 700g",
      "white sliced bread",
      "whole wheat bread 700g",
    ],
  },
  {
    id: "cola",
    category: "beverages",
    canonicalLabel: "Cola",
    matchKeywords: ["coke", "cola", "coca cola", "coca-cola"],
    searchVariants: [
      "coca-cola 2l",
      "coca-cola 1.5l",
      "coca-cola 500ml",
      "coke 2l",
      "coke zero 2l",
    ],
  },
  {
    id: "tea-bags",
    category: "beverages",
    canonicalLabel: "Tea",
    matchKeywords: ["tea", "tea bags", "rooibos"],
    searchVariants: [
      "rooibos tea 80s",
      "rooibos tea bags",
      "five roses tea 100s",
      "black tea bags 100s",
      "ceylon tea bags",
    ],
  },
  {
    id: "sugar-white",
    category: "pantry",
    canonicalLabel: "Sugar",
    matchKeywords: ["sugar"],
    searchVariants: ["white sugar 2kg", "white sugar 1kg", "castor sugar 1kg"],
  },
];

function normalizeForMatch(value: string): string {
  return ` ${value.trim().toLowerCase()} `;
}

/**
 * Finds equivalence groups whose keywords appear in the given
 * (already-normalized) shopping intent text. Word-boundary aware via
 * padding with spaces, so "tea" doesn't match inside "steak".
 */
export function findEquivalenceGroupsForText(normalizedText: string): ProductEquivalenceGroup[] {
  const padded = normalizeForMatch(normalizedText);
  return PRODUCT_EQUIVALENCE_GROUPS.filter((group) =>
    group.matchKeywords.some((keyword) => padded.includes(normalizeForMatch(keyword))),
  );
}

export function findEquivalenceGroupById(id: string): ProductEquivalenceGroup | null {
  return PRODUCT_EQUIVALENCE_GROUPS.find((group) => group.id === id) ?? null;
}
