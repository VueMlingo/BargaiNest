/**
 * Per-retailer configuration for the generic search+lookup adapter.
 * Every field below that isn't explicitly marked CONFIRMED is a
 * best-effort guess — see RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md
 * for the per-retailer confidence level and what to verify first.
 */
export interface RetailerSearchConfig {
  /** Matches the registry key used in routes.ts, e.g. "CHECKERS". */
  retailerKey: string;

  /** Human-readable note on confidence — surfaced in logs/rawData so
   *  a wrong price is traceable back to "this was always a guess". */
  confidenceNote: string;

  /** True if this retailer's product pages are confirmed (not
   *  guessed) to be server-rendered — lets the adapter skip the
   *  headless renderer for the per-product confirmation step and use
   *  a plain fetch instead, which is faster and cheaper. */
  productPagesConfirmedServerRendered: boolean;

  /** Builds the URL to open before searching. Could be a guessed
   *  direct search-results URL (?q=<query>) or just the homepage, if
   *  search requires interacting with a search box. */
  buildSearchUrl(query: string): string;

  /** CSS selector for the search input box, if `buildSearchUrl`
   *  returns a page that still needs the query typed in (rather than
   *  a URL that already encodes it). Omit if the URL alone triggers
   *  results. */
  searchInputSelector?: string;

  /** CSS selector matching each product "card" in the rendered
   *  search-results page. */
  resultCardSelector: string;
  /** CSS selector, relative to a result card, for the product name. */
  resultNameSelector: string;
  /** CSS selector, relative to a result card, for the link to the
   *  full product page. */
  resultLinkSelector: string;
  /** CSS selector, relative to a result card, for a visible price —
   *  optional; if present, used as a fast hint, but the adapter still
   *  confirms via the product page for anything it returns. */
  resultPriceSelector?: string;

  /** Max number of search results to confirm via product-page visit
   *  per query. Keeps per-search cost bounded. */
  maxResultsToConfirm: number;
}
