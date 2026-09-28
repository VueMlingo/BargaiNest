import type { ShoppingIntent } from "./shopping-intent.types.js";
import { findEquivalenceGroupsForText } from "./product-equivalence.registry.js";

export interface ExpandedSearchTerm {
  query: string;
  /** True if this came from expanding a generic term (e.g. "milk" →
   *  "full cream milk 1l"); false if it's the intent's own text used
   *  as-is (specific intent, or no matching equivalence group found). */
  fromEquivalenceExpansion: boolean;
  equivalenceGroupId?: string;
}

/**
 * The actual fix for "milk"/"tea"/"coke" returning no price while
 * "sugar"/"bread" did: a SPECIFIC intent (user already said "low fat
 * milk 2l" — shopping-intent.service.ts already infers this via
 * attributes.brand/variant/packSize/unit) is trusted and searched
 * literally, exactly as before. A GENERIC intent ("milk") is expanded
 * into every known concrete variant for that term, so the search
 * layer gets several real product names to try instead of one term
 * that may not exist verbatim in any retailer's catalogue.
 *
 * Deliberately does NOT gate on `intent.specificity` directly: that
 * field flips to "specific" as soon as ANY attribute is detected,
 * including brand alone — so "coke" (brand: "coca-cola" via the
 * vocabulary) counts as "specific" today even though the user hasn't
 * said what size they want. Gating on specificity here would silently
 * un-fix the exact "coke" case this module exists to fix. Instead,
 * this gates on whether a pack size is already known — that's the
 * one attribute where searching literally vs. expanding actually
 * changes what gets searched for.
 *
 * Returns at least one term always — if no equivalence group matches,
 * falls back to the intent's own normalized text, so behaviour for
 * every category not yet in the equivalence registry is unchanged
 * from before this existed.
 */
export function expandShoppingIntent(intent: ShoppingIntent): ExpandedSearchTerm[] {
  const hasExplicitPackSize = Boolean(intent.attributes.packSize);

  if (hasExplicitPackSize) {
    return [{ query: intent.normalizedText, fromEquivalenceExpansion: false }];
  }

  const groups = findEquivalenceGroupsForText(intent.normalizedText);

  if (groups.length === 0) {
    return [{ query: intent.normalizedText, fromEquivalenceExpansion: false }];
  }

  const terms: ExpandedSearchTerm[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const variant of group.searchVariants) {
      if (seen.has(variant)) continue; // a term could theoretically appear in two groups' variants
      seen.add(variant);
      terms.push({ query: variant, fromEquivalenceExpansion: true, equivalenceGroupId: group.id });
    }
  }

  return terms;
}
