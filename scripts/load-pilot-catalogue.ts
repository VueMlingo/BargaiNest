import { buildApp } from "../src/app/app.js";
import { PilotFixtureCatalogueAdapter } from "../src/modules/retail-catalogue/adapters/pilot-fixture.adapter.js";
import { ingestCatalogue } from "../src/modules/retail-catalogue/retail-catalogue.ingestion.service.js";

const PILOT_PRODUCTS = [
  {
    name: "Full Cream Milk 2L",
    brand: "Dairy",
    category: "Dairy",
    unit: "2L",
  },
  {
    name: "Brown Bread 700g",
    brand: "Albany",
    category: "Bakery",
    unit: "700g",
  },
  {
    name: "Coca-Cola 2L",
    brand: "Coca-Cola",
    category: "Beverages",
    unit: "2L",
  },
  {
    name: "Sunlight Dishwashing Liquid 750ml",
    brand: "Sunlight",
    category: "Household",
    unit: "750ml",
  },
  {
    name: "White Sugar 2kg",
    brand: "Huletts",
    category: "Pantry",
    unit: "2kg",
  },
  {
    name: "Long Life Milk 1L",
    brand: "Parmalat",
    category: "Dairy",
    unit: "1L",
  },
  {
    name: "Basmati Rice 2kg",
    brand: "Tastic",
    category: "Pantry",
    unit: "2kg",
  },
  {
    name: "Sunflower Oil 2L",
    brand: "Sunfoil",
    category: "Pantry",
    unit: "2L",
  },
  {
    name: "Peanut Butter 400g",
    brand: "Black Cat",
    category: "Pantry",
    unit: "400g",
  },
  {
    name: "Corn Flakes 500g",
    brand: "Kellogg's",
    category: "Breakfast",
    unit: "500g",
  },
  {
    name: "Toilet Paper 18 Pack",
    brand: "Albany",
    category: "Household",
    unit: "18 pack",
  },
  {
    name: "Chicken Breasts 1kg",
    brand: "Farmer's Choice",
    category: "Meat",
    unit: "1kg",
  },
] as const;

const RETAILERS = [
  { code: "SHOPRITE", name: "Shoprite" },
  { code: "CHECKERS", name: "Checkers" },
  { code: "PICK_N_PAY", name: "Pick n Pay" },
  { code: "WOOLWORTHS", name: "Woolworths" },
] as const;

async function main(): Promise<void> {
  const app = buildApp();

  await app.ready();

  try {
    console.log("\n=== BargaiNest Pilot Catalogue Loader ===\n");

    /*
     * ------------------------------------------------------------------------
     * 1. Resolve retailers
     * ------------------------------------------------------------------------
     */

    const retailers = [];

    for (const definition of RETAILERS) {
      let retailer = await app.prisma.retailer.findUnique({
        where: {
          code: definition.code,
        },
      });

      if (!retailer && definition.code === "PICK_N_PAY") {
        retailer = await app.prisma.retailer.findUnique({
          where: {
            code: "PNP",
          },
        });
      }

      if (!retailer) {
        throw new Error(
          `Required pilot retailer not found: ${definition.code}`,
        );
      }

      if (retailer.status !== "ACTIVE") {
        throw new Error(
          `Required pilot retailer is not active: ${retailer.code}`,
        );
      }

      retailers.push(retailer);
    }

    /*
     * ------------------------------------------------------------------------
     * 2. Create/reuse canonical BargaiNest products
     * ------------------------------------------------------------------------
     */

    const products = [];

    for (const definition of PILOT_PRODUCTS) {
      const existing = await app.prisma.product.findMany({
        where: {
          name: definition.name,
          status: "ACTIVE",
        },
        take: 2,
      });

      if (existing.length > 1) {
        throw new Error(
          `Multiple active products found for: ${definition.name}`,
        );
      }

      const product =
        existing[0] ??
        (await app.prisma.product.create({
          data: {
            name: definition.name,
            brand: definition.brand,
            category: definition.category,
            unit: definition.unit,
            status: "ACTIVE",
          },
        }));

      products.push(product);
    }

    console.log(
      `Canonical products ready: ${products.length}`,
    );

    /*
     * ------------------------------------------------------------------------
     * 3. Create/reuse retailer relationships
     * ------------------------------------------------------------------------
     */

    for (const retailer of retailers) {
      for (const product of products) {
        await app.prisma.productRetailer.upsert({
          where: {
            productId_retailerId: {
              productId: product.id,
              retailerId: retailer.id,
            },
          },
          create: {
            productId: product.id,
            retailerId: retailer.id,
            retailerSku: `PILOT-${retailer.code}-${product.id.slice(0, 8)}`,
            currency: "ZAR",
          },
          update: {},
        });
      }
    }

    console.log(
      `Product-retailer relationships ready: ${
        products.length * retailers.length
      }`,
    );

    /*
     * ------------------------------------------------------------------------
     * 4. Create/reuse catalogue sources
     * ------------------------------------------------------------------------
     */

    for (const retailer of retailers) {
      const sourceCode =
        `PILOT_${retailer.code}_CATALOGUE`;

      const source =
        await app.prisma.catalogueSource.upsert({
          where: {
            code: sourceCode,
          },
          create: {
            retailerId: retailer.id,
            code: sourceCode,
            name: `BargaiNest Pilot - ${retailer.name}`,
            channel: "PHYSICAL_CATALOGUE",
            sourceType: "WEB_PAGE",
            sourceUrl: `pilot://catalogue/${retailer.code}`,
            description:
              "Controlled BargaiNest pilot catalogue fixture.",
            active: true,
            schedule: "PILOT",
            adapterKey: "PILOT_FIXTURE",
            countryCode: "ZA",
            sourcePriority: 10,
          },
          update: {
            retailerId: retailer.id,
            name: `BargaiNest Pilot - ${retailer.name}`,
            active: true,
            adapterKey: "PILOT_FIXTURE",
            sourceUrl: `pilot://catalogue/${retailer.code}`,
          },
        });

      /*
       * Do not create duplicate pilot observations when the loader
       * is accidentally run more than once.
       */
      const previousRun =
        await app.prisma.catalogueRun.findFirst({
          where: {
            catalogueSourceId: source.id,
            status: {
              in: ["COMPLETED", "PARTIAL"],
            },
          },
          orderBy: {
            startedAt: "desc",
          },
        });

      if (previousRun) {
        console.log(
          `${retailer.code}: existing successful pilot run ${previousRun.id} - skipped`,
        );
        continue;
      }

      const adapter = new PilotFixtureCatalogueAdapter();

      const result = await ingestCatalogue(
        app,
        {
          catalogueSourceId: source.id,
          retailerId: retailer.id,
          channel: source.channel,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl ?? undefined,
          countryCode: source.countryCode ?? undefined,
          province: source.province ?? undefined,
          city: source.city ?? undefined,
          storeCode: retailer.code,
        },
        adapter,
      );

      console.log(
        `${retailer.code}: ` +
        `${result.itemsMatched}/${result.itemsDiscovered} matched, ` +
        `${result.priceObservationsCreated} price observations`,
      );
    }

    /*
     * ------------------------------------------------------------------------
     * 5. Final verification
     * ------------------------------------------------------------------------
     */

    const sourceCount =
      await app.prisma.catalogueSource.count({
        where: {
          adapterKey: "PILOT_FIXTURE",
        },
      });

    const observationCount =
      await app.prisma.priceObservation.count({
        where: {
          source: {
            startsWith: "BargaiNest Pilot -",
          },
        },
      });

    console.log("\n=== Pilot Catalogue Result ===");
    console.log(`Pilot sources: ${sourceCount}`);
    console.log(`Pilot price observations: ${observationCount}`);
    console.log("================================\n");
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error("\nPilot catalogue loader failed:");
  console.error(error);
  process.exit(1);
});
