import type {
  CatalogueSourceCandidate,
  CatalogueSourceDiscoveryAdapter,
  CatalogueSourceDiscoveryContext,
} from "../retail-catalogue.source-discovery.types.js";

/**
 * Unlike ShopriteSourceDiscoveryAdapter (which crawls a specials
 * microsite to find a *changing list* of promotional pages), live
 * product search doesn't have multiple "sources" to discover — the
 * retailer's search itself IS the single, always-available source.
 * This adapter's discover() returns exactly one static candidate,
 * synchronously, with no network call needed.
 *
 * This exists so the existing discovery → persist → lookup pipeline
 * (retail-catalogue.source-discovery.service.ts reads persisted
 * CatalogueSource rows, keyed by adapterKey, before ever calling a
 * price-lookup adapter) has something to persist. Without a
 * CatalogueSource row referencing e.g. "CHECKERS_LIVE_SEARCH", the
 * RetailerSearchPriceAdapter registered under that key would never
 * actually be invoked — registering it in the price-lookup registry
 * alone is not sufficient. See scripts/seed-live-search-sources.ts,
 * which persists the row this adapter's output represents.
 */
export class LiveSearchSourceDiscoveryAdapter implements CatalogueSourceDiscoveryAdapter {
  readonly discoveryKey: string;

  constructor(
    private readonly retailerCode: string,
    private readonly retailerDisplayName: string,
    private readonly adapterKey: string,
    private readonly homepageUrl: string,
  ) {
    this.discoveryKey = `${retailerCode}_LIVE_SEARCH`;
  }

  async discover(
    context: CatalogueSourceDiscoveryContext,
  ): Promise<CatalogueSourceCandidate[]> {
    return [
      {
        code: `${this.retailerCode}_LIVE_SEARCH`,
        name: `${this.retailerDisplayName} — live product search`,
        channel: "ONLINE_STORE",
        sourceType: "WEB_PAGE",
        sourceUrl: this.homepageUrl,
        adapterKey: this.adapterKey,
        description:
          `Live current-price lookup via ${this.retailerDisplayName}'s own site search, ` +
          `rather than a promotional publication. See RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md.`,
        countryCode: context.countryCode ?? "ZA",
        ...(context.province !== undefined && { province: context.province }),
        ...(context.city !== undefined && { city: context.city }),
        sourcePriority: 100,
      },
    ];
  }
}
