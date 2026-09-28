import { registerIntelligenceEngineRoutes } from "../modules/intelligence-engine/intelligence-engine.routes.js";
import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../config/constants.js";
import { env } from "../config/env.js";

import { registerIdentityRoutes } from "../modules/identity/identity.routes.js";
import { registerRetailerRoutes } from "../modules/retailers/retailer.routes.js";
import { registerLoyaltyProgramRoutes } from "../modules/loyalty-programs/loyalty-program.routes.js";
import { registerLoyaltyActivityRoutes } from "../modules/loyalty-activities/loyalty-activity.routes.js";
import { registerRewardRoutes } from "../modules/rewards/reward.routes.js";
import { registerProductRoutes } from "../modules/products/product.routes.js";
import { registerPriceObservationRoutes } from "../modules/price-observations/price-observation.routes.js";
import { registerAuthRoutes } from "../modules/auth/auth.routes.js";
import { registerPasswordRecoveryRoutes } from "../modules/auth/password-recovery.routes.js";
import { registerConsentRoutes } from "../modules/auth/consent.routes.js";
import { registerSupportRoutes } from "../modules/auth/support.routes.js";
import { registerNotificationRoutes } from "../modules/notifications/notification.routes.js";
import { registerHouseholdRoutes } from "../modules/household/household.routes.js";
import { registerPromotionsRoutes } from "../modules/promotions/promotions.routes.js";
import { registerInsightsRoutes } from "../modules/insights/insights.routes.js";
import { registerReceiptRoutes } from "../modules/receipts/receipt.routes.js";
import { registerConsumerRoutes } from "../modules/auth/consumer.routes.js";
import { registerCatalogueRoutes } from "../modules/auth/catalogue.routes.js";
import { registerProfileRoutes } from "../modules/auth/profile.routes.js";
import { registerShoppingListRoutes } from "../modules/shopping-lists/shopping-list.routes.js";
import { registerShoppingListValueRoutes } from "../modules/shopping-list-value/shopping-list-value.routes.js";
import { registerWalletVoucherRoutes } from "../modules/wallet-vouchers/wallet-voucher.routes.js";
import { CatalogueAdapterRegistry } from "../modules/retail-catalogue/retail-catalogue.adapter-registry.js";
import { CataloguePriceLookupRegistry } from "../modules/retail-catalogue/retail-catalogue.price-lookup.registry.js";
import { ShopritePriceLookupAdapter } from "../modules/retail-catalogue/adapters/shoprite-price-lookup.adapter.js";
import { CatalogueSourceDiscoveryRegistry } from "../modules/retail-catalogue/retail-catalogue.source-discovery.registry.js";
import { ShopritePublicationAdapter } from "../modules/retail-catalogue/adapters/shoprite-publication.adapter.js";
import { ShopriteSpecialsAdapter } from "../modules/retail-catalogue/adapters/shoprite-specials.adapter.js";
import { ShopriteSourceDiscoveryAdapter } from "../modules/retail-catalogue/adapters/shoprite-source-discovery.adapter.js";
import { CheckersSourceDiscoveryAdapter } from "../modules/retail-catalogue/adapters/checkers-source-discovery.adapter.js";
import { RetailerSearchPriceAdapter } from "../modules/retail-catalogue/search/retailer-search.adapter.js";
import {
  ConstructorIoPriceLookupAdapter,
  PICK_N_PAY_PRICE_EXTRACTOR,
  makeWoolworthsPriceExtractor,
} from "../modules/retail-catalogue/adapters/constructor-io-price-lookup.adapter.js";
import { PnpHybrisPriceLookupAdapter } from "../modules/retail-catalogue/adapters/pnp-hybris-price-lookup.adapter.js";
import { LiveSearchSourceDiscoveryAdapter } from "../modules/retail-catalogue/search/live-search-discovery.adapter.js";
import {
  CHECKERS_CONFIG,
  SHOPRITE_CONFIG,
  WOOLWORTHS_CONFIG,
  PICK_N_PAY_CONFIG,
  SPAR_CONFIG,
} from "../modules/retail-catalogue/search/retailer-configs.js";
import { PilotFixtureCatalogueAdapter } from "../modules/retail-catalogue/adapters/pilot-fixture.adapter.js";

export async function registerRoutes(
  fastify: FastifyInstance
): Promise<void> {
  const catalogueAdapterRegistry = new CatalogueAdapterRegistry({
    SHOPRITE_PUBLICATION: () => new ShopritePublicationAdapter(),
    PILOT_FIXTURE: () => new PilotFixtureCatalogueAdapter(),
    SHOPRITE_SPECIALS: () =>
      new ShopriteSpecialsAdapter(async () => {
        throw new Error("SHOPRITE_SPECIALS_PROVIDER_NOT_CONFIGURED");
      }),
  });

  const catalogueSourceDiscoveryRegistry =
    new CatalogueSourceDiscoveryRegistry({
      SHOPRITE: () => new ShopriteSourceDiscoveryAdapter(),
      // Session 1 work: discovers Shoprite-Holdings-style specials/promo
      // pages. Renamed from bare "CHECKERS" to make room for the
      // distinct live-search source below — these solve different
      // problems (promo flyers vs. everyday current price).
      // ⚠️ UNVERIFIED data source — see RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md.
      CHECKERS_SPECIALS: () => new CheckersSourceDiscoveryAdapter(),

      // Session 2 work: one static "this retailer's live search is
      // always available" source per retailer, feeding the generic
      // RetailerSearchPriceAdapter below. See
      // scripts/seed-live-search-sources.ts — these discovery keys
      // must be run and persisted once before lookups will find them
      // (discoverCatalogueSources reads the DB, it doesn't invoke
      // these adapters live on every request).
      CHECKERS_LIVE_SEARCH: () =>
        new LiveSearchSourceDiscoveryAdapter(
          "CHECKERS", "Checkers", "CHECKERS_LIVE_SEARCH", "https://www.checkers.co.za",
        ),
      SHOPRITE_LIVE_SEARCH: () =>
        new LiveSearchSourceDiscoveryAdapter(
          "SHOPRITE", "Shoprite", "SHOPRITE_LIVE_SEARCH", "https://www.shoprite.co.za",
        ),
      WOOLWORTHS_LIVE_SEARCH: () =>
        new LiveSearchSourceDiscoveryAdapter(
          "WOOLWORTHS", "Woolworths", "WOOLWORTHS_LIVE_SEARCH", "https://www.woolworths.co.za",
        ),
      PICK_N_PAY_LIVE_SEARCH: () =>
        new LiveSearchSourceDiscoveryAdapter(
          "PICK_N_PAY", "Pick n Pay", "PICK_N_PAY_LIVE_SEARCH", "https://www.pnp.co.za",
        ),
      SPAR_LIVE_SEARCH: () =>
        new LiveSearchSourceDiscoveryAdapter(
          "SPAR", "SPAR", "SPAR_LIVE_SEARCH", "https://www.spar2u.co.za",
        ),
    });

  const cataloguePriceLookupRegistry =
    new CataloguePriceLookupRegistry({
      SHOPRITE_PUBLICATION: () =>
        new ShopritePriceLookupAdapter(),
      // Live current-price lookup by shopping-intent search, all five
      // retailers via one generic adapter. See
      // RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md for what's confirmed
      // vs. guessed per retailer — CHECKERS has the strongest evidence
      // behind it, SPAR the weakest. All five need real-environment
      // verification (this sandbox can't reach any retailer site or
      // run a real browser) before being trusted in a user-facing flow.
      // Requires the matching CatalogueSource row to exist — see
      // scripts/seed-live-search-sources.ts.
      CHECKERS_LIVE_SEARCH: () => new RetailerSearchPriceAdapter(CHECKERS_CONFIG),
      SHOPRITE_LIVE_SEARCH: () => new RetailerSearchPriceAdapter(SHOPRITE_CONFIG),
      /*
       * Woolworths and Pick n Pay both run their own site search on
       * Constructor.io, a third-party platform -- confirmed by
       * probing both sites for cnstrc.com references. This is a
       * completely different, JSON-native path from the other three
       * retailers' Playwright/CSS-selector approach: no HTML
       * scraping, no browser, and (per that same probing) no WAF to
       * get past for Woolworths at all. See
       * CONSTRUCTOR-IO-PRICE-LOOKUP.md for exactly what's confirmed
       * vs. still-open here (the price-zone question for Woolworths
       * specifically is a genuinely unresolved question, not
       * something this code has answered).
       *
       * Falls back to the existing Playwright-based adapter when the
       * retailer's Constructor.io key isn't configured, rather than
       * returning nothing at all -- the key is required to actually
       * get real prices out of this path, but the search shouldn't
       * hard-fail just because it's unset in a given environment.
       */
      WOOLWORTHS_LIVE_SEARCH: () =>
        env.WOOLWORTHS_CONSTRUCTOR_KEY
          ? new ConstructorIoPriceLookupAdapter({
              adapterKey: "WOOLWORTHS_LIVE_SEARCH",
              apiKey: env.WOOLWORTHS_CONSTRUCTOR_KEY,
              extractor: makeWoolworthsPriceExtractor(env.WOOLWORTHS_PRICE_ZONE),
              serviceUrl: `https://${env.WOOLWORTHS_CONSTRUCTOR_HOST}`,
            })
          : new RetailerSearchPriceAdapter(WOOLWORTHS_CONFIG),
      PICK_N_PAY_LIVE_SEARCH: () =>
        new PnpHybrisPriceLookupAdapter(""),
      SPAR_LIVE_SEARCH: () => new RetailerSearchPriceAdapter(SPAR_CONFIG),
    });

  /*
   * ==========================================================================
   * ROOT HEALTH CHECK
   * ==========================================================================
   */

  fastify.get("/health", async () => {
    return {
      status: "ok",
      service: "bargainest-backend",
    };
  });

  /*
   * ==========================================================================
   * API v1
   * ==========================================================================
   */

  fastify.register(
    async (api) => {

      /*
       * ----------------------------------------------------------------------
       * API STATUS
       * ----------------------------------------------------------------------
       */

      api.get("/status", async () => {
        return {
          status: "ok",
          service: "bargainest-backend",
          version: "0.1.0",
          release: "Release 3",
        };
      });

      /*
       * ----------------------------------------------------------------------
       * SYSTEM HEALTH
       * ----------------------------------------------------------------------
       */

      api.get("/system/health", async () => {
        const record = await api.prisma.systemHealth.findFirst({
          orderBy: {
            createdAt: "desc",
          },
        });

        return {
          status: "ok",
          database: "connected",
          systemHealthRecord: record,
        };
      });

      /*
       * ----------------------------------------------------------------------
       * IDENTITY
       * ----------------------------------------------------------------------
       */

      await registerAuthRoutes(api);
      await registerPasswordRecoveryRoutes(api);
      await registerConsentRoutes(api);
      await registerSupportRoutes(api);
      await registerNotificationRoutes(api);
      await registerHouseholdRoutes(api);
      await registerPromotionsRoutes(api);
      await registerInsightsRoutes(api);
      await registerReceiptRoutes(api);
      await registerConsumerRoutes(api);
      await registerCatalogueRoutes(api, {
        catalogueAdapterRegistry,
        catalogueSourceDiscoveryRegistry,
      });
      await registerProfileRoutes(api);

      await registerIdentityRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * RETAILERS
       * ----------------------------------------------------------------------
       */

      await registerRetailerRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * LOYALTY PROGRAMMES
       * ----------------------------------------------------------------------
       */

      await registerLoyaltyProgramRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * LOYALTY ACCOUNTS
       * ----------------------------------------------------------------------
       */


      /*
       * ----------------------------------------------------------------------
       * LOYALTY CARDS
       * ----------------------------------------------------------------------
       */


      /*
       * ----------------------------------------------------------------------
       * LOYALTY ACTIVITIES
       * ----------------------------------------------------------------------
       */

      await registerLoyaltyActivityRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * REWARDS
       * ----------------------------------------------------------------------
       */

      await registerRewardRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * PRODUCTS
       * ----------------------------------------------------------------------
       */
      await registerProductRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * PRICE OBSERVATIONS
       * ----------------------------------------------------------------------
       */
      await registerPriceObservationRoutes(api);

      /*
       * ----------------------------------------------------------------------
       * SHOPPING LISTS
       * ----------------------------------------------------------------------
       */

      await registerShoppingListRoutes(api);
      await registerWalletVoucherRoutes(api);
      await registerShoppingListValueRoutes(api, {
        cataloguePriceLookupRegistry,
      });


      /*
       * ----------------------------------------------------------------------
       * SHOPPING TRANSACTIONS
       *
       * Historical purchasing and basket data
       * ----------------------------------------------------------------------
       */


      /*
       * ----------------------------------------------------------------------
       * INTELLIGENCE ENGINE
       *
       * Deterministic price comparison and opportunity detection
       * ----------------------------------------------------------------------
       */

      await registerIntelligenceEngineRoutes(api);
      /*
       * ----------------------------------------------------------------------
       * RELEASE 3 INFORMATION
       * ----------------------------------------------------------------------
       */
      api.get("/", async () => {
        return {
          name: "BargaiNest Intelligence & Data Foundation",
          service: "bargainest-backend",
          release: "Release 3",
          version: "v1",
          status: "operational",
        };
      });
    },
    {
      prefix: API_PREFIX,
    }
  );
}
