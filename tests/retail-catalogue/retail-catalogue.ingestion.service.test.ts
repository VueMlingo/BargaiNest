import { describe, expect, it, vi } from "vitest";

import { ingestCatalogue } from "../../src/modules/retail-catalogue/retail-catalogue.ingestion.service.js";
import { ShopritePublicationAdapter } from "../../src/modules/retail-catalogue/adapters/shoprite-publication.adapter.js";

describe("retail catalogue ingestion", () => {
  it("creates a verified price observation for a confirmed GTIN match", async () => {
    const catalogueSourceFindUnique = vi.fn().mockResolvedValue({
      id: "source-001",
      retailerId: "retailer-001",
      active: true,
      name: "Controlled Retailer Catalogue",
      sourceUrl: "https://retailer.example/catalogue",
    });

    const catalogueRunCreate = vi.fn().mockResolvedValue({
      id: "run-001",
    });

    const catalogueRunUpdate = vi.fn().mockResolvedValue({
      id: "run-001",
    });

    const catalogueItemCreate = vi.fn().mockResolvedValue({
      id: "catalogue-item-001",
    });

    const catalogueMatchCreate = vi.fn().mockResolvedValue({
      id: "match-001",
    });

    const priceObservationCreate = vi.fn().mockResolvedValue({
      id: "observation-001",
    });

    const productIdentifierFindFirst = vi.fn().mockResolvedValue({
      productId: "product-001",
    });

    const prisma = {
      catalogueSource: {
        findUnique: catalogueSourceFindUnique,
        update: vi.fn().mockResolvedValue({
          id: "source-001",
        }),
      },

      catalogueRun: {
        create: catalogueRunCreate,
        update: catalogueRunUpdate,
      },

      catalogueItem: {
        create: catalogueItemCreate,
      },

      catalogueItemProductMatch: {
        create: catalogueMatchCreate,
      },

      priceObservation: {
        create: priceObservationCreate,
      },

      productIdentifier: {
        findFirst: productIdentifierFindFirst,
      },

      productRetailer: {
        findFirst: vi.fn(),
      },

      product: {
        findMany: vi.fn(),
      },
    } as any;

    const adapter = {
      adapterKey: "CONTROLLED_TEST",

      discover: vi.fn().mockResolvedValue([
        {
          gtin: "6001234567890",
          name: "Full Cream Milk 2L",
          brand: "Test Brand",
          packSize: "2L",
          unit: "2L",
          price: 38,
          currency: "ZAR",
          sourceReference:
            "controlled-test-catalogue-item-001",
          extractionMethod: "STRUCTURED",
          extractionConfidence: 1,
        },
      ]),
    };

    const api = {
      prisma,
    } as any;

    const result = await ingestCatalogue(
      api,
      {
        catalogueSourceId: "source-001",
        retailerId: "retailer-001",
        channel: "ONLINE_STORE",
        sourceType: "JSON_FEED",
        sourceUrl:
          "https://retailer.example/catalogue",
        countryCode: "ZA",
      },
      adapter
    );

    expect(result.catalogueRunId).toBe("run-001");
    expect(result.itemsDiscovered).toBe(1);
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsMatched).toBe(1);
    expect(result.itemsUnmatched).toBe(0);
    expect(result.priceObservationsCreated).toBe(1);

    const catalogueSourceUpdate =
      prisma.catalogueSource.update as ReturnType<typeof vi.fn>;

    expect(catalogueSourceUpdate).toHaveBeenCalledOnce();

    expect(
      catalogueSourceUpdate.mock.calls.at(0)?.[0]
    ).toMatchObject({
      where: {
        id: "source-001",
      },
      data: {
        lastSuccessfulRunAt: expect.any(Date),
      },
    });

    expect(catalogueRunCreate).toHaveBeenCalledOnce();

    expect(catalogueItemCreate).toHaveBeenCalledOnce();

    const catalogueItemCall =
      catalogueItemCreate.mock.calls.at(0)?.[0];

    expect(catalogueItemCall.data.catalogueRunId).toBe(
      "run-001"
    );

    expect(catalogueItemCall.data.rawName).toBe(
      "Full Cream Milk 2L"
    );

    expect(catalogueItemCall.data.price).toBe(38);

    expect(catalogueItemCall.data.currency).toBe(
      "ZAR"
    );

    expect(catalogueMatchCreate).toHaveBeenCalledOnce();

    const matchCall =
      catalogueMatchCreate.mock.calls.at(0)?.[0];

    expect(matchCall.data.productId).toBe(
      "product-001"
    );

    expect(matchCall.data.confidence).toBe(1);
    expect(matchCall.data.method).toBe("GTIN");
    expect(matchCall.data.status).toBe("CONFIRMED");

    expect(priceObservationCreate).toHaveBeenCalledOnce();

    const observationCall =
      priceObservationCreate.mock.calls.at(0)?.[0];

    expect(observationCall.data.productId).toBe(
      "product-001"
    );

    expect(observationCall.data.retailerId).toBe(
      "retailer-001"
    );

    expect(observationCall.data.price).toBe(38);
    expect(observationCall.data.currency).toBe(
      "ZAR"
    );

    expect(observationCall.data.source).toBe(
      "Controlled Retailer Catalogue"
    );

    expect(observationCall.data.sourceReference).toBe(
      "controlled-test-catalogue-item-001"
    );

    expect(observationCall.data.catalogueItemId).toBe(
      "catalogue-item-001"
    );

    expect(observationCall.data.channel).toBe(
      "ONLINE_STORE"
    );

    expect(observationCall.data.extractionMethod).toBe(
      "STRUCTURED"
    );
  });

  it("preserves an unmatched catalogue item without creating a price observation", async () => {
    const catalogueSourceFindUnique = vi.fn().mockResolvedValue({
      id: "source-002",
      retailerId: "retailer-002",
      active: true,
      name: "Controlled Retailer Catalogue",
      sourceUrl: "https://retailer.example/catalogue",
    });

    const catalogueRunCreate = vi.fn().mockResolvedValue({
      id: "run-002",
    });

    const catalogueRunUpdate = vi.fn().mockResolvedValue({
      id: "run-002",
    });

    const catalogueItemCreate = vi.fn().mockResolvedValue({
      id: "catalogue-item-002",
    });

    const catalogueMatchCreate = vi.fn();

    const priceObservationCreate = vi.fn();

    const productIdentifierFindFirst = vi.fn()
      .mockResolvedValue(null);

    const productRetailerFindFirst = vi.fn()
      .mockResolvedValue(null);

    const productFindMany = vi.fn()
      .mockResolvedValue([]);

    const prisma = {
      catalogueSource: {
        findUnique: catalogueSourceFindUnique,
        update: vi.fn().mockResolvedValue({
          id: "source-test-updated",
        }),
      },

      catalogueRun: {
        create: catalogueRunCreate,
        update: catalogueRunUpdate,
      },

      catalogueItem: {
        create: catalogueItemCreate,
      },

      catalogueItemProductMatch: {
        create: catalogueMatchCreate,
      },

      priceObservation: {
        create: priceObservationCreate,
      },

      productIdentifier: {
        findFirst: productIdentifierFindFirst,
      },

      productRetailer: {
        findFirst: productRetailerFindFirst,
      },

      product: {
        findMany: productFindMany,
      },
    } as any;

    const adapter = {
      adapterKey: "CONTROLLED_UNMATCHED_TEST",

      discover: vi.fn().mockResolvedValue([
        {
          name: "Completely Unknown Grocery Product",
          price: 99.95,
          currency: "ZAR",
          sourceReference:
            "controlled-test-unmatched-item",
          extractionMethod: "STRUCTURED",
          extractionConfidence: 1,
        },
      ]),
    };

    const api = {
      prisma,
    } as any;

    const result = await ingestCatalogue(
      api,
      {
        catalogueSourceId: "source-002",
        retailerId: "retailer-002",
        channel: "ONLINE_STORE",
        sourceType: "JSON_FEED",
        sourceUrl:
          "https://retailer.example/catalogue",
        countryCode: "ZA",
      },
      adapter
    );

    expect(result.catalogueRunId).toBe("run-002");
    expect(result.itemsDiscovered).toBe(1);
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsMatched).toBe(0);
    expect(result.itemsUnmatched).toBe(1);
    expect(result.priceObservationsCreated).toBe(0);

    expect(catalogueItemCreate).toHaveBeenCalledOnce();

    expect(catalogueMatchCreate).not.toHaveBeenCalled();

    expect(priceObservationCreate).not.toHaveBeenCalled();

    const firstRunUpdate =
      catalogueRunUpdate.mock.calls[0]?.[0];

    const finalRunUpdate =
      catalogueRunUpdate.mock.calls.at(-1)?.[0];

    expect(firstRunUpdate.data.itemsDiscovered).toBe(1);

    expect(finalRunUpdate.data.status).toBe(
      "COMPLETED"
    );

    expect(finalRunUpdate.data.itemsProcessed).toBe(1);
    expect(finalRunUpdate.data.itemsMatched).toBe(0);
    expect(finalRunUpdate.data.itemsUnmatched).toBe(1);

    expect(
      finalRunUpdate.data.metadata
        .priceObservationsCreated
    ).toBe(0);
  });
});


  it("ingests the real Shoprite publication fixture through the complete pipeline", async () => {
    const fs = await import("node:fs");

    const html = fs.readFileSync(
      "tests/retail-catalogue/fixtures/shoprite-redbull.html",
      "utf8"
    );

    const sourceUrl =
      "https://specials.shoprite.co.za/deals/gnredbullenergydrinksavings28aug13sep2026/index.html";

    const catalogueSourceFindUnique = vi.fn().mockResolvedValue({
      id: "source-shoprite-001",
      retailerId: "retailer-shoprite-001",
      active: true,
      name: "Shoprite Red Bull Energy Drink Savings Gauteng",
      sourceUrl,
    });

    const catalogueRunCreate = vi.fn().mockResolvedValue({
      id: "run-shoprite-001",
    });

    const catalogueRunUpdate = vi.fn().mockResolvedValue({
      id: "run-shoprite-001",
    });

    const catalogueItemCreate = vi.fn().mockResolvedValue({
      id: "catalogue-item-shoprite-001",
    });

    const catalogueMatchCreate = vi.fn().mockResolvedValue({
      id: "match-shoprite-001",
    });

    const priceObservationCreate = vi.fn().mockResolvedValue({
      id: "observation-shoprite-001",
    });

    const productIdentifierFindFirst = vi.fn().mockResolvedValue(null);

    const productRetailerFindFirst = vi.fn().mockResolvedValue(null);

    const productFindMany = vi.fn().mockResolvedValue([
      {
        id: "product-redbull-001",
        name: "Red Bull Original/Cherry & Blossom Flavour Energy Drink 250ml each",
        brand: null,
        unit: "250ml",
        status: "ACTIVE",
      },
    ]);

    const prisma = {
      catalogueSource: {
        findUnique: catalogueSourceFindUnique,
        update: vi.fn().mockResolvedValue({
          id: "source-test-updated",
        }),
      },

      catalogueRun: {
        create: catalogueRunCreate,
        update: catalogueRunUpdate,
      },

      catalogueItem: {
        create: catalogueItemCreate,
      },

      catalogueItemProductMatch: {
        create: catalogueMatchCreate,
      },

      priceObservation: {
        create: priceObservationCreate,
      },

      productIdentifier: {
        findFirst: productIdentifierFindFirst,
      },

      productRetailer: {
        findFirst: productRetailerFindFirst,
      },

      product: {
        findMany: productFindMany,
      },
    } as any;

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      })
    );

    const adapter = new ShopritePublicationAdapter(fetchMock);

    const api = {
      prisma,
    } as any;

    const result = await ingestCatalogue(
      api,
      {
        catalogueSourceId: "source-shoprite-001",
        retailerId: "retailer-shoprite-001",
        channel: "PHYSICAL_CATALOGUE",
        sourceType: "WEB_PAGE",
        sourceUrl,
        countryCode: "ZA",
        province: "GAUTENG",
        region: "GAUTENG",
      },
      adapter
    );

    expect(fetchMock).toHaveBeenCalledOnce();

    expect(result.catalogueRunId).toBe("run-shoprite-001");
    expect(result.itemsDiscovered).toBeGreaterThanOrEqual(1);
    expect(result.itemsProcessed).toBe(result.itemsDiscovered);

    expect(result.itemsMatched).toBeGreaterThanOrEqual(1);
    expect(result.priceObservationsCreated).toBeGreaterThanOrEqual(1);

    expect(catalogueItemCreate).toHaveBeenCalled();

    const catalogueItemCall =
      catalogueItemCreate.mock.calls.at(0)?.[0];

    expect(catalogueItemCall.data.currency).toBe("ZAR");
    expect(catalogueItemCall.data.sourceReference).toBe(sourceUrl);
    expect(catalogueItemCall.data.extractionMethod).toBe("WEB_PARSER");

    expect(catalogueMatchCreate).toHaveBeenCalled();

    const matchCall =
      catalogueMatchCreate.mock.calls.at(0)?.[0];

    expect(matchCall.data.productId).toBe("product-redbull-001");
    expect(matchCall.data.status).toBe("CONFIRMED");

    expect(priceObservationCreate).toHaveBeenCalled();

    const observationCall =
      priceObservationCreate.mock.calls.at(0)?.[0];

    expect(observationCall.data.productId).toBe(
      "product-redbull-001"
    );

    expect(observationCall.data.retailerId).toBe(
      "retailer-shoprite-001"
    );

    expect(observationCall.data.price).toBe(19.99);
    expect(observationCall.data.currency).toBe("ZAR");
    expect(observationCall.data.sourceReference).toBe(sourceUrl);
    expect(observationCall.data.catalogueItemId).toBe(
      "catalogue-item-shoprite-001"
    );

    expect(observationCall.data.channel).toBe(
      "PHYSICAL_CATALOGUE"
    );

    expect(observationCall.data.extractionMethod).toBe(
      "WEB_PARSER"
    );

    const finalRunUpdate =
      catalogueRunUpdate.mock.calls.at(-1)?.[0];

    expect(finalRunUpdate.data.status).toBe("COMPLETED");
    expect(finalRunUpdate.data.metadata.adapterKey).toBe(
      "SHOPRITE_PUBLICATION"
    );
  });
