/**
 * Product Equivalence — closes the gap the project's own testing found:
 * "milk", "tea bags" and "coke" returned no price, while "sugar" and
 * "bread" did. The difference isn't a frontend bug — it's that a
 * generic term like "milk" was only ever searched as the literal
 * string "milk" against retailer sites, never expanded into the
 * concrete product variants retailers actually list ("Full Cream Milk
 * 1L", "Long Life Full Cream Milk 6 x 1L", etc.).
 *
 * An equivalence group is a named set of concrete search variants that
 * all satisfy the same generic shopping intent. Expansion only kicks
 * in for GENERIC intents (shopping-intent.types.ts already has this
 * concept — `specificity: "generic" | "specific"` — it just wasn't
 * being used to trigger expansion before this). A SPECIFIC intent
 * (the user already said "low fat milk 2l") is trusted as-is and
 * searched literally, since expanding it further would risk searching
 * for something the user didn't ask for.
 */

export interface ProductEquivalenceGroup {
  id: string;
  category: string;
  canonicalLabel: string;
  /** Keywords checked against the shopping intent's normalized text.
   *  A match on ANY keyword selects this group — deliberately simple
   *  (substring match on already-normalized text) rather than a
   *  second parallel classifier duplicating shopping-intent.service.ts's
   *  own category inference, which doesn't cover every term here
   *  (it has no rule for "coke"/"tea" at all, only "milk"/"bread"). */
  matchKeywords: readonly string[];
  /** Concrete phrases to search, in priority order (most commonly
   *  stocked / most likely to match first). Deliberately retailer-
   *  agnostic — a retailer's own search or product-page matching
   *  handles whether a specific variant exists in that store. */
  searchVariants: readonly string[];
}
