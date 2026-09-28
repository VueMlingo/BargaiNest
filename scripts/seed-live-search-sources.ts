import { buildApp } from "../src/app/app.js";

/**
 * One-time (but safe-to-re-run) setup: persists a Retailer row and a
 * CatalogueSource row per retailer for the new live-search adapters
 * built in this session.
 *
 * WHY THIS IS NEEDED: retail-catalogue.source-discovery.service.ts's
 * discoverCatalogueSources() reads directly from the CatalogueSource
 * database table — it does NOT invoke discovery adapters live on every
 * lookup. Registering RetailerSearchPriceAdapter in the price-lookup
 * registry (routes.ts) is necessary but not sufficient: without a
 * matching, active CatalogueSource row, the lookup pipeline will never
 * find these adapters, and BargaiNest will silently behave as if these
 * five retailers don't exist rather than erroring loudly. Run this
 * script once against your real database before expecting any of the
 * five retailers to return live prices.
 *
 * Run with: npx tsx scripts/seed-live-search-sources.ts
 */

interface RetailerSeed {
  code: string;
  name: string;
  adapterKey: string;
  discoveryKey: string;
  sourceUrl: string;
}

const RETAILERS: RetailerSeed[] = [
  {
    code: "CHECKERS",
    name: "Checkers",
    adapterKey: "CHECKERS_LIVE_SEARCH",
    discoveryKey: "CHECKERS_LIVE_SEARCH",
    sourceUrl: "https://www.checkers.co.za",
  },
  {
    code: "SHOPRITE",
    name: "Shoprite",
    adapterKey: "SHOPRITE_LIVE_SEARCH",
    discoveryKey: "SHOPRITE_LIVE_SEARCH",
    sourceUrl: "https://www.shoprite.co.za",
  },
  {
    code: "WOOLWORTHS",
    name: "Woolworths",
    adapterKey: "WOOLWORTHS_LIVE_SEARCH",
    discoveryKey: "WOOLWORTHS_LIVE_SEARCH",
    sourceUrl: "https://www.woolworths.co.za",
  },
  {
    code: "PICK_N_PAY",
    name: "Pick n Pay",
    adapterKey: "PICK_N_PAY_LIVE_SEARCH",
    discoveryKey: "PICK_N_PAY_LIVE_SEARCH",
    sourceUrl: "https://www.pnp.co.za",
  },
  {
    code: "SPAR",
    name: "SPAR",
    adapterKey: "SPAR_LIVE_SEARCH",
    discoveryKey: "SPAR_LIVE_SEARCH",
    sourceUrl: "https://www.spar2u.co.za",
  },
];

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    for (const retailerSeed of RETAILERS) {
      const retailer = await app.prisma.retailer.upsert({
        where: { code: retailerSeed.code },
        update: { name: retailerSeed.name },
        create: {
          code: retailerSeed.code,
          name: retailerSeed.name,
          status: "ACTIVE",
        },
      });

      const sourceCode = `${retailerSeed.code}_LIVE_SEARCH`;

      await app.prisma.catalogueSource.upsert({
        where: { code: sourceCode },
        update: {
          adapterKey: retailerSeed.adapterKey,
          active: true,
          sourceUrl: retailerSeed.sourceUrl,
        },
        create: {
          retailerId: retailer.id,
          code: sourceCode,
          name: `${retailerSeed.name} — live product search`,
          channel: "ONLINE_STORE",
          sourceType: "WEB_PAGE",
          sourceUrl: retailerSeed.sourceUrl,
          adapterKey: retailerSeed.adapterKey,
          active: true,
          countryCode: "ZA",
          sourcePriority: 100,
          description:
            `Live current-price lookup via ${retailerSeed.name}'s own site search. ` +
            "See RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md for confidence level.",
        },
      });

      console.log(`✓ ${retailerSeed.name}: retailer + catalogue source ready`);
    }

    console.log("\nAll five live-search sources seeded. Verify with:");
    console.log(
      "  SELECT code, adapterKey, active FROM catalogue_sources WHERE code LIKE '%_LIVE_SEARCH';\n",
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("\nLive-search source seeding failed:");
  console.error(error);
  process.exit(1);
});
