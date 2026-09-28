import type {
  CatalogueSourceDiscoveryAdapter,
} from "../retail-catalogue/retail-catalogue.source-discovery.types.js";
import type { CatalogueAdapter, RawCatalogueItem } from "../retail-catalogue/retail-catalogue.types.js";

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
  price: number;
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
    price: item.price,
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
