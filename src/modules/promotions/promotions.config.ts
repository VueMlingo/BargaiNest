import { ShopriteSourceDiscoveryAdapter } from "../retail-catalogue/adapters/shoprite-source-discovery.adapter.js";
import { ShopritePublicationAdapter } from "../retail-catalogue/adapters/shoprite-publication.adapter.js";
import { ConstructorIoPriceLookupAdapter, makeWoolworthsPriceExtractor } from "../retail-catalogue/adapters/constructor-io-price-lookup.adapter.js";
import { PnpHybrisPriceLookupAdapter } from "../retail-catalogue/adapters/pnp-hybris-price-lookup.adapter.js";
import { env } from "../../config/env.js";
import type { PromotionRetailerConfig, BrowsePromotionsViaLiveSearchConfig } from "./promotions.service.js";

/**
 * Only Shoprite is wired here -- it's the one retailer with a
 * confirmed, real, working specials source (see
 * RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md). Checkers' specials
 * discovery adapter exists but is explicitly flagged unverified in
 * that same doc; wiring it into a user-facing promotions feed before
 * it's confirmed would risk showing unverified/wrong data as if it
 * were real. Add more retailers here once their specials sources are
 * confirmed the same way Shoprite's was.
 */
export const PROMOTION_RETAILER_CONFIGS: PromotionRetailerConfig[] = [
  {
    retailerCode: "SHOPRITE",
    retailerName: "Shoprite",
    retailerId: "SHOPRITE",
    discoveryAdapter: new ShopriteSourceDiscoveryAdapter(),
    publicationAdapterFactory: () => new ShopritePublicationAdapter(),
  },
];

/**
 * BN-030: Pick n Pay and Woolworths have no scrapable specials page
 * with a confirmed, verified source the way Shoprite does -- but both
 * have a real, already-proven product search API (the same ones used
 * for live price search), so promotions.service.ts's
 * browsePromotionsViaLiveSearch() surfaces specials through those
 * instead. Gated the same way the main price-lookup registration
 * already gates them (see app/routes.ts's PICK_N_PAY_LIVE_SEARCH /
 * WOOLWORTHS_LIVE_SEARCH): only wired in here when the relevant
 * configuration is actually present, so an unconfigured environment
 * simply doesn't offer that retailer's specials rather than failing.
 */
export function buildLiveSearchPromotionConfigs(): BrowsePromotionsViaLiveSearchConfig[] {
  const configs: BrowsePromotionsViaLiveSearchConfig[] = [];

  // Neither adapter actually reads catalogueSourceId/channel/sourceType
  // meaningfully -- both key off the query, not these context fields
  // (see PNP-HYBRIS-PRICE-LOOKUP.md / CONSTRUCTOR-IO-PRICE-LOOKUP.md)
  // -- but the shared CataloguePriceLookupContext type requires them.
  const placeholderContext = {
    catalogueSourceId: "BROWSE_SPECIALS",
    retailerId: "BROWSE_SPECIALS",
    channel: "ONLINE_STORE" as const,
    sourceType: "LIVE_SEARCH",
  };

  /*
   * Unlike the main price-lookup registration (app/routes.ts), Browse
   * Specials doesn't require a specific store code to be configured --
   * a general "what's on special right now" browse isn't tied to a
   * specific purchase the way a price lookup for an actual shopping-list
   * item is, so this is always included rather than gated behind
   * PICK_N_PAY_DEFAULT_STORE_CODE being set. If an empty store code
   * genuinely returns nothing usable from Pick n Pay's API, the
   * existing per-category error isolation in
   * browsePromotionsViaLiveSearch already handles that gracefully --
   * same as any other retailer-side failure -- rather than this
   * silently omitting Pick n Pay from the feature entirely.
   */
  configs.push({
    retailerCode: "PICK_N_PAY",
    retailerName: "Pick n Pay",
    adapter: new PnpHybrisPriceLookupAdapter(env.PICK_N_PAY_DEFAULT_STORE_CODE ?? ""),
    context: placeholderContext,
  });

  if (env.WOOLWORTHS_CONSTRUCTOR_KEY) {
    configs.push({
      retailerCode: "WOOLWORTHS",
      retailerName: "Woolworths",
      adapter: new ConstructorIoPriceLookupAdapter({
        adapterKey: "WOOLWORTHS_LIVE_SEARCH",
        apiKey: env.WOOLWORTHS_CONSTRUCTOR_KEY,
        extractor: makeWoolworthsPriceExtractor(env.WOOLWORTHS_PRICE_ZONE),
        serviceUrl: `https://${env.WOOLWORTHS_CONSTRUCTOR_HOST}`,
      }),
      context: placeholderContext,
    });
  }

  return configs;
}
