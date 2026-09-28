import type { RawCatalogueItem } from "../retail-catalogue.types.js";
import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupContext,
  CataloguePriceLookupQuery,
} from "../retail-catalogue.price-lookup.types.js";
import type { PageRenderer } from "./page-renderer.js";
import type { RetailerSearchConfig } from "./retailer-search.config.js";
import { parseProductPage } from "../adapters/product-page.parser.js";
import { FetchPageRenderer } from "./fetch-page-renderer.js";
import { PlaywrightPageRenderer } from "./playwright-page-renderer.js";

/**
 * One adapter implementation, configured per retailer, instead of five
 * near-identical classes. Given a shopping-intent query (e.g. "milk"):
 *
 *   1. Search the retailer's site for candidate products (via the
 *      configured renderer — plain fetch if confirmed server-rendered,
 *      headless browser otherwise).
 *   2. For each candidate (bounded by config.maxResultsToConfirm),
 *      visit the product page and extract an authoritative price via
 *      the shared JSON-LD-first parser — search-result-card prices
 *      are used only as a hint, never returned as-is, since they're
 *      more likely to be stale/cached than the product page itself.
 *
 * A failure at the search step throws (not silently empty) so a
 * config/selector regression is visible in logs rather than quietly
 * looking like "no results for milk today".
 */
export class RetailerSearchPriceAdapter implements CataloguePriceLookupAdapter {
  readonly adapterKey: string;

  private readonly fetchRenderer: PageRenderer;
  private readonly browserRenderer: PlaywrightPageRenderer;

  constructor(
    private readonly config: RetailerSearchConfig,
    renderers?: { fetchRenderer?: PageRenderer; browserRenderer?: PlaywrightPageRenderer },
  ) {
    this.adapterKey = config.retailerKey;
    this.fetchRenderer = renderers?.fetchRenderer ?? new FetchPageRenderer();
    this.browserRenderer = renderers?.browserRenderer ?? new PlaywrightPageRenderer();
  }

  async lookup(
    _context: CataloguePriceLookupContext,
    query: CataloguePriceLookupQuery,
  ): Promise<RawCatalogueItem[]> {
    const searchTerm = query.name?.trim();
    if (!searchTerm) {
      throw new Error(`${this.config.retailerKey}_SEARCH_QUERY_MISSING`);
    }

    // Search always goes through the browser renderer: no retailer has
    // a confirmed server-rendered search page yet (see checklist), so
    // there is currently no case where the fetch renderer's search()
    // would succeed. This is the one call site to revisit first if/when
    // a retailer's search endpoint is confirmed server-rendered.
    const candidates = await this.browserRenderer.searchWithConfig(this.config, searchTerm);

    const items: RawCatalogueItem[] = [];

    for (const candidate of candidates) {
      const html = this.config.productPagesConfirmedServerRendered
        ? await this.fetchRenderer.renderUrl(candidate.productUrl)
        : await this.browserRenderer.renderUrl(candidate.productUrl);

      const result = parseProductPage(html, candidate.productUrl);
      if (result.item) {
        items.push(result.item);
      }
    }

    return items;
  }
}
