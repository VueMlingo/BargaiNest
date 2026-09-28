import { buildApp } from "../src/app/app.js";

/**
 * Seeds the one piece of data that was missing to actually exercise
 * the loyalty-sync framework end to end: an ACTIVE Integration row.
 *
 * Without this, the framework is fully built and testable in
 * isolation, but genuinely unreachable in the running app —
 * RetailerConnectionService.connect() requires an Integration with
 * status ACTIVE for the same retailer as the loyalty account, and
 * zero exist in the base seed. loyalty-provider.resolver.ts already
 * has a hardcoded mapping from "SHOPRITE_XTRA_SAVINGS" to the mock
 * provider, so that's the integration code used here — pick a
 * different one if a different retailer/programme should be first.
 *
 * Reuses the "SHOPRITE" retailer row created by
 * scripts/seed-live-search-sources.ts (upsert by code) if it already
 * ran, rather than creating a second, conflicting Shoprite retailer.
 * Safe to run in either order, and safe to re-run.
 *
 * Run with: npx tsx scripts/seed-loyalty-integration.ts
 */

const RETAILER_CODE = "SHOPRITE";
const RETAILER_NAME = "Shoprite";
const PROGRAM_CODE = "SHOPRITE_XTRA_SAVINGS";
const PROGRAM_NAME = "Xtra Savings";
const INTEGRATION_CODE = "SHOPRITE_XTRA_SAVINGS";
const INTEGRATION_NAME = "Shoprite Xtra Savings (mock)";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    const retailer = await app.prisma.retailer.upsert({
      where: { code: RETAILER_CODE },
      update: { name: RETAILER_NAME },
      create: {
        code: RETAILER_CODE,
        name: RETAILER_NAME,
        status: "ACTIVE",
      },
    });

    const program = await app.prisma.loyaltyProgram.upsert({
      where: {
        retailerId_code: {
          retailerId: retailer.id,
          code: PROGRAM_CODE,
        },
      },
      update: { name: PROGRAM_NAME, status: "ACTIVE" },
      create: {
        retailerId: retailer.id,
        code: PROGRAM_CODE,
        name: PROGRAM_NAME,
        status: "ACTIVE",
      },
    });

    const integration = await app.prisma.integration.upsert({
      where: { code: INTEGRATION_CODE },
      update: {
        status: "ACTIVE",
        description:
          "Mock provider — no real Shoprite API partnership exists yet. " +
          "Returns deterministic fixture data (see MockRetailerProvider) " +
          "so the connect/sync/read pipeline can be exercised end to end " +
          "ahead of a real integration.",
      },
      create: {
        retailerId: retailer.id,
        code: INTEGRATION_CODE,
        name: INTEGRATION_NAME,
        status: "ACTIVE",
        description:
          "Mock provider — no real Shoprite API partnership exists yet. " +
          "Returns deterministic fixture data (see MockRetailerProvider) " +
          "so the connect/sync/read pipeline can be exercised end to end " +
          "ahead of a real integration.",
      },
    });

    console.log(`✓ Retailer: ${retailer.name} (${retailer.id})`);
    console.log(`✓ Loyalty programme: ${program.name} (${program.id})`);
    console.log(`✓ Integration: ${integration.code} — status ${integration.status}`);
    console.log(
      "\nA loyalty account for this programme can now connect via " +
        "POST /me/loyalty-accounts/:id/connect-and-sync with " +
        `integrationId "${integration.id}".`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("\nLoyalty integration seeding failed:");
  console.error(error);
  process.exit(1);
});
