import { buildApp } from "../src/app/app.js";

/**
 * BN-005: fixes "a user can only add a card for Shoprite, no other
 * retailer works." Root cause, confirmed directly against the live
 * database export before writing this: 13 retailers exist as rows,
 * but only ONE LoyaltyProgram row existed anywhere in the database
 * (Shoprite's Xtra Savings). The add-card flow is entirely generic
 * and retailer-agnostic -- it lists whatever loyalty programmes the
 * API returns (GET /catalog/loyalty-programmes) -- so with only one
 * programme in the database, only one retailer could ever show up as
 * an option. This was a missing-data problem, not a code bug.
 *
 * Scoped to the 6 retailers that already have real, designed branding
 * in the frontend's RETAILER_PRESENTATION map (Checkers, Pick n Pay,
 * Woolworths, SPAR, Clicks, Dis-Chem) -- not all 13 retailer rows.
 * The other 6 (Engen, Spur, BP, Ocean Basket, Shell, Bootlegger) have
 * no loyalty-card presentation designed for them at all; adding a
 * loyalty programme for those would let a user add a card the wallet
 * UI has no real styling or handling for.
 *
 * Deliberately does NOT create an Integration (mock or otherwise) for
 * any of these -- only Shoprite has an actual provider-resolver
 * mapping (loyalty-provider.resolver.ts hardcodes
 * "SHOPRITE_XTRA_SAVINGS" to the mock provider). Creating an
 * Integration row without a matching resolver entry would surface a
 * "Sync now" action that silently fails. This fix is scoped exactly
 * to what was reported -- cards can be added -- not to live sync,
 * which is a separate, larger piece of work if wanted later.
 *
 * Upserts by (retailerId, code), matching the existing retailer rows
 * by their real `code` column rather than creating duplicates. Safe
 * to re-run.
 *
 * Run with: npx tsx scripts/seed-additional-retailer-loyalty-programs.ts
 */

const PROGRAMS: { retailerCode: string; programCode: string; programName: string }[] = [
  { retailerCode: "CHECKERS", programCode: "CHECKERS_XTRA_SAVINGS", programName: "Xtra Savings" },
  { retailerCode: "PICK_N_PAY", programCode: "PNP_SMART_SHOPPER", programName: "Smart Shopper" },
  { retailerCode: "WOOLWORTHS", programCode: "WOOLWORTHS_WREWARDS", programName: "WRewards" },
  { retailerCode: "SPAR", programCode: "SPAR_REWARDS", programName: "SPAR Rewards" },
  { retailerCode: "CLICKS", programCode: "CLICKS_CLUBCARD", programName: "ClubCard" },
  { retailerCode: "DISCHEM", programCode: "DISCHEM_BENEFIT_PROGRAMME", programName: "Benefit Programme" },
];

async function main(): Promise<void> {
  const app = await buildApp();
  let createdOrUpdated = 0;
  let skippedMissingRetailer = 0;

  try {
    for (const { retailerCode, programCode, programName } of PROGRAMS) {
      const retailer = await app.prisma.retailer.findUnique({
        where: { code: retailerCode },
      });

      if (!retailer) {
        console.warn(
          `⚠ Skipped ${programName}: no retailer with code "${retailerCode}" exists. ` +
            "Expected this to already exist from earlier seeding -- check before re-running.",
        );
        skippedMissingRetailer += 1;
        continue;
      }

      const program = await app.prisma.loyaltyProgram.upsert({
        where: {
          retailerId_code: {
            retailerId: retailer.id,
            code: programCode,
          },
        },
        update: { name: programName, status: "ACTIVE" },
        create: {
          retailerId: retailer.id,
          code: programCode,
          name: programName,
          status: "ACTIVE",
        },
      });

      console.log(`✓ ${retailer.name}: ${program.name} (${program.id})`);
      createdOrUpdated += 1;
    }

    console.log(
      `\n${createdOrUpdated} loyalty programme(s) seeded/updated` +
        (skippedMissingRetailer > 0 ? `, ${skippedMissingRetailer} skipped (see warnings above).` : "."),
    );
    console.log(
      "\nUsers can now add a card for these retailers via the normal add-card flow. " +
        "None of these have live sync configured yet -- only Shoprite does -- so " +
        "these cards will show as manually-tracked, matching the retailers that " +
        "already have no integration available today.",
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("\nAdditional retailer loyalty programme seeding failed:");
  console.error(error);
  process.exit(1);
});
