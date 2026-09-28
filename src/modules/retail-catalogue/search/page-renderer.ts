/**
 * Decouples "get me the fully-rendered HTML/results for this page" from
 * *how* that happens (plain fetch vs. headless browser). Adapter logic
 * depends only on this interface, so it can be unit-tested with a fake
 * implementation — no real browser required to test control flow.
 */

export interface SearchResultCandidate {
  name: string;
  productUrl: string;
  /** Present only if the search results page itself shows a price
   *  (many sites do, in which case a second product-page fetch isn't
   *  strictly necessary — but adapters should still confirm via the
   *  product page when in doubt, since search-card prices are more
   *  often stale/cached). */
  priceHint?: number | null;
}

export interface PageRenderer {
  /** Fetches a single URL and returns its HTML after any JS execution
   *  this renderer performs (none, for a plain-fetch implementation;
   *  full render, for a headless-browser one). */
  renderUrl(url: string): Promise<string>;

  /** Performs a search on the retailer's site and returns candidate
   *  result cards. Implementations decide how (typing into a search
   *  box and reading rendered result cards, for a browser-based
   *  renderer; a server-rendered search results page fetch, if one is
   *  ever confirmed to exist). */
  search(searchUrl: string, query: string): Promise<SearchResultCandidate[]>;
}
