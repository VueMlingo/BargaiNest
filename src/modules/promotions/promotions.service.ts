import type {
  CatalogueSourceDiscoveryAdapter,
} from "../retail-catalogue/retail-catalogue.source-discovery.types.js";
import type { CatalogueAdapter, RawCatalogueItem } from "../retail-catalogue/retail-catalogue.types.js";
import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupContext,
} from "../retail-catalogue/retail-catalogue.price-lookup.types.js";
import { extractPackSize } from "../shopping-intent/pack-size.util.js";

/**
 * "What's on special right now" -- a materially different question
 * from BN-015's live current-price search ("what does milk cost right
 * now at a specific retailer"). BN-015 deliberately doesn't answer
 * this; a shopping-list price lookup isn't a promotions browse.
 *
 * Rather than build new scraping, this reuses BN-015's own specials
 * pipeline directly (ShopriteSourceDiscoveryAdapter +
 * ShopritePublicationAdapter) -- the same tested discovery-then-parse
 * flow, just surfaced as a browsable feed instead of feeding the price
 * comparison engine. No new catalogue-adapter code was written for
 * this; the only new code is this orchestration layer and the read
 * API around it.
 */

export interface PromotionRetailerConfig {
  retailerCode: string;
  retailerName: string;
  retailerId: string;
  discoveryAdapter: CatalogueSourceDiscoveryAdapter;
  publicationAdapterFactory: () => CatalogueAdapter;
}

export interface Promotion {
  retailerCode: string;
  retailerName: string;
  name: string;
  packSize: string | null;
  price: number;
  /** The regular (non-promotional) price, where the source makes it
   *  available -- distinct from `price`, which is always the current
   *  (possibly promotional) price actually being charged. */
  wasPrice: number | null;
  currency: string;
  promotionText: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  sourceUrl: string;
}

export interface BrowsePromotionsOptions {
  /** Bounds cost: each specials page fetched is a real network call.
   *  Only the first N discovered pages per retailer are fetched. */
  maxSourcesPerRetailer?: number;
  /** Case-insensitive substring match against each item's name, so
   *  "milk" surfaces promotions with "milk" in the title. Omit for
   *  no filtering. */
  searchTerm?: string;
}

const DEFAULT_MAX_SOURCES_PER_RETAILER = 3;

function itemToPromotion(
  item: RawCatalogueItem,
  retailerCode: string,
  retailerName: string,
  sourceUrl: string,
): Promotion | null {
  if (item.price === undefined || !Number.isFinite(item.price)) return null;

  return {
    retailerCode,
    retailerName,
    name: item.name,
    // Same fallback used throughout the price-lookup pipeline (see
    // retail-catalogue.normalizer.ts) -- most sources here don't
    // populate a structured packSize either, only a free-text name.
    packSize: item.packSize?.trim() || extractPackSize(item.name),
    price: item.price,
    wasPrice: item.wasPrice ?? null,
    currency: item.currency ?? "ZAR",
    promotionText: item.promotionText ?? null,
    validFrom: item.validFrom ?? null,
    validUntil: item.validUntil ?? null,
    sourceUrl,
  };
}

/**
 * Browses current promotions for one configured retailer. Failures
 * fetching an individual specials page are logged-and-skipped rather
 * than failing the whole browse -- one stale/broken specials URL
 * shouldn't take down promotions browsing for every other page from
 * the same retailer.
 */
export async function browsePromotionsForRetailer(
  config: PromotionRetailerConfig,
  options: BrowsePromotionsOptions = {},
  onSourceError?: (sourceUrl: string, error: unknown) => void,
): Promise<Promotion[]> {
  const maxSources = options.maxSourcesPerRetailer ?? DEFAULT_MAX_SOURCES_PER_RETAILER;

  let candidates;
  try {
    candidates = await config.discoveryAdapter.discover({
      retailerId: config.retailerId,
      retailerCode: config.retailerCode,
      retailerName: config.retailerName,
    });
  } catch (error) {
    // Discovery is retailer-specific and may depend on a live external
    // source. A discovery failure must not fail the entire promotions
    // browse, especially once multiple retailers are configured.
    onSourceError?.(config.retailerName, error);
    return [];
  }

  const limited = candidates.slice(0, maxSources);
  const promotions: Promotion[] = [];

  for (const candidate of limited) {
    try {
      const publicationAdapter = config.publicationAdapterFactory();
      const items = await publicationAdapter.discover({
        catalogueSourceId: candidate.code,
        retailerId: config.retailerId,
        channel: candidate.channel,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.sourceUrl,
      });

      for (const item of items) {
        if (!item.isPromotion) continue;
        const promotion = itemToPromotion(
          item,
          config.retailerCode,
          config.retailerName,
          candidate.sourceUrl,
        );
        if (promotion) promotions.push(promotion);
      }
    } catch (error) {
      onSourceError?.(candidate.sourceUrl, error);
    }
  }

  if (options.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    return promotions.filter((p) => p.name.toLowerCase().includes(term));
  }

  return promotions;
}

/**
 * BN-030: Pick n Pay's Hybris API and Woolworths' Constructor.io
 * index are both real, live, already-proven product *search*
 * providers (see PNP-HYBRIS-PRICE-LOOKUP.md and
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md) -- but neither exposes a bulk
 * "list everything currently on promotion" endpoint, only
 * per-product search. Rather than build new, unverified scraping of
 * each retailer's specials page (the exact kind of fragile,
 * unconfirmed-selector adapter this project moved away from for live
 * price search), this reuses the existing CataloguePriceLookupAdapter
 * interface these retailers already implement, searching a small set
 * of real, common grocery categories (the same ones already
 * established in product-equivalence.registry.ts) and keeping only
 * the results the adapter itself reports as promotional
 * (RawCatalogueItem.isPromotion). This is an approximation of
 * "browse all current specials" bounded by which common categories
 * happen to have an active promotion right now -- not a true bulk
 * feed, since neither retailer's real API offers one.
 */
export interface BrowsePromotionsViaLiveSearchConfig {
  retailerCode: string;
  retailerName: string;
  adapter: CataloguePriceLookupAdapter;
  context: CataloguePriceLookupContext;
}

const DEFAULT_SEARCH_CATEGORIES = ["Milk", "Bread", "Cola", "Tea", "Sugar"];

export async function browsePromotionsViaLiveSearch(
  config: BrowsePromotionsViaLiveSearchConfig,
  options: BrowsePromotionsOptions = {},
  onSourceError?: (sourceUrl: string, error: unknown) => void,
  searchCategories: readonly string[] = DEFAULT_SEARCH_CATEGORIES,
): Promise<Promotion[]> {
  const promotions: Promotion[] = [];

  for (const category of searchCategories) {
    try {
      const items = await config.adapter.lookup(config.context, { name: category });

      for (const item of items) {
        if (!item.isPromotion) continue;
        const promotion = itemToPromotion(
          item,
          config.retailerCode,
          config.retailerName,
          // No specials-page URL exists for a live-search-derived
          // result -- sourceUrl here identifies the adapter/provider
          // itself, for traceability, rather than linking a page.
          `live-search:${config.adapter.adapterKey}`,
        );
        if (promotion) promotions.push(promotion);
      }
    } catch (error) {
      // One category's search failing (a transient network error, a
      // retailer-side timeout) must not prevent the other categories
      // from being tried, and must not fail the whole browse -- same
      // per-source isolation principle as browsePromotionsForRetailer.
      onSourceError?.(`${config.retailerName}:${category}`, error);
    }
  }

  if (options.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    return promotions.filter((p) => p.name.toLowerCase().includes(term));
  }

  return promotions;
}

export async function browsePromotions(
  configs: PromotionRetailerConfig[],
  options: BrowsePromotionsOptions = {},
  onSourceError?: (sourceUrl: string, error: unknown) => void,
): Promise<Promotion[]> {
  const results = await Promise.all(
    configs.map((config) => browsePromotionsForRetailer(config, options, onSourceError)),
  );
  return results.flat();
}
