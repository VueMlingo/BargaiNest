import { describe, expect, it, vi } from "vitest";

import {
  lookupCurrentCataloguePrices,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.service.js";

import {
  CataloguePriceLookupRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.registry.js";

import type {
  CataloguePriceLookupAdapter,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-lookup.types.js";

import type {
  RawCatalogueItem,
} from "../../src/modules/retail-catalogue/retail-catalogue.types.js";

function makeItem(
  price: number,
  sourceReference: string,
): RawCatalogueItem {
  return {
    externalId: `item-${price}`,
    name: "Full Cream Milk",
    packSize: "2L",
    unit: "L",
    price,
    currency: "ZAR",
    sourceReference,
    extractionMethod: "API",
  };
}

function makeSource(
  id: string,
  code: string,
  adapterKey: string,
  sourcePriority: number,
) {
  return {
    id,
    retailerId: "retailer-shoprite",
    code,
    name: code,
    channel: "ONLINE",
    sourceType: "API",
    sourceUrl: `https://example.com/${code}`,
    adapterKey,
    region: null,
    countryCode: "ZA",
    province: null,
    city: null,
    storeCode: null,
    sourcePriority,
    lastSuccessfulRunAt: new Date("2026-09-13T09:00:00Z"),
    latestRunStatus: "COMPLETED",
  };
}

function makeApi(
  sources: ReturnType<typeof makeSource>[],
) {
  return {
    prisma: {
      catalogueSource: {
        findMany: vi.fn().mockResolvedValue(
          sources.map((source) => ({
            ...source,
            retailer: {
              code: "SHOPRITE",
              name: "Shoprite",
            },
            runs: [
              {
                status: source.latestRunStatus,
                startedAt: source.lastSuccessfulRunAt,
              },
            ],
          })),
        ),
      },
    },
  } as any;
}

describe(
  "lookupCurrentCataloguePrices",
  () => {
    it(
      "falls back when the first source has no match",
      async () => {
        const firstAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-a",
          lookup: vi.fn().mockResolvedValue([]),
        };

        const secondAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-b",
          lookup: vi.fn().mockResolvedValue([
            makeItem(
              39.99,
              "source-b-product",
            ),
          ]),
        };

        const registry =
          new CataloguePriceLookupRegistry({
            "source-a": () => firstAdapter,
            "source-b": () => secondAdapter,
          });

        const api = makeApi([
          makeSource(
            "source-1",
            "shoprite-source-a",
            "source-a",
            1,
          ),
          makeSource(
            "source-2",
            "shoprite-source-b",
            "source-b",
            2,
          ),
        ]);

        const result =
          await lookupCurrentCataloguePrices(
            api,
            {
              retailerId: "retailer-shoprite",
            },
            {
              name: "Full Cream Milk",
              packSize: "2L",
            },
            registry,
          );

        expect(firstAdapter.lookup).toHaveBeenCalled();
        expect(secondAdapter.lookup).toHaveBeenCalled();

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.price).toBe(39.99);

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]?.item.price).toBe(39.99);
        expect(result.matches[0]?.source.id).toBe("source-2");
        expect(result.matches[0]?.source.retailerId).toBe(
          "retailer-shoprite",
        );
        expect(result.matches[0]?.source.code).toBe(
          "shoprite-source-b",
        );

        expect(result.attempts).toHaveLength(2);
        expect(result.attempts[0]?.status)
          .toBe("NO_MATCH");
        expect(result.attempts[1]?.status)
          .toBe("MATCHED");
      },
    );

    it(
      "falls back when the first source is unavailable",
      async () => {
        const firstAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-a",
          lookup: vi.fn().mockRejectedValue(
            new Error("SOURCE_UNAVAILABLE"),
          ),
        };

        const secondAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-b",
          lookup: vi.fn().mockResolvedValue([
            makeItem(
              42.5,
              "source-b-product",
            ),
          ]),
        };

        const registry =
          new CataloguePriceLookupRegistry({
            "source-a": () => firstAdapter,
            "source-b": () => secondAdapter,
          });

        const api = makeApi([
          makeSource(
            "source-1",
            "shoprite-source-a",
            "source-a",
            1,
          ),
          makeSource(
            "source-2",
            "shoprite-source-b",
            "source-b",
            2,
          ),
        ]);

        const result =
          await lookupCurrentCataloguePrices(
            api,
            {
              retailerId: "retailer-shoprite",
            },
            {
              name: "Full Cream Milk",
            },
            registry,
          );

        expect(result.items[0]?.price)
          .toBe(42.5);

        expect(result.attempts[0]?.status)
          .toBe("UNAVAILABLE");

        expect(result.attempts[1]?.status)
          .toBe("MATCHED");
      },
    );

    it(
      "skips a source whose adapter is not registered",
      async () => {
        const adapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-b",
          lookup: vi.fn().mockResolvedValue([
            makeItem(
              44.99,
              "source-b-product",
            ),
          ]),
        };

        const registry =
          new CataloguePriceLookupRegistry({
            "source-b": () => adapter,
          });

        const api = makeApi([
          makeSource(
            "source-1",
            "shoprite-source-a",
            "source-a",
            1,
          ),
          makeSource(
            "source-2",
            "shoprite-source-b",
            "source-b",
            2,
          ),
        ]);

        const result =
          await lookupCurrentCataloguePrices(
            api,
            {
              retailerId: "retailer-shoprite",
            },
            {
              name: "Full Cream Milk",
            },
            registry,
          );

        expect(
          result.attempts[0]?.status,
        ).toBe("SKIPPED");

        expect(
          result.attempts[0]?.error,
        ).toBe(
          "CATALOGUE_PRICE_LOOKUP_ADAPTER_NOT_REGISTERED:source-a",
        );

        expect(result.items[0]?.price)
          .toBe(44.99);
      },
    );

    it(
      "does not choose the cheapest price itself",
      async () => {
        const firstAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-a",
          lookup: vi.fn().mockResolvedValue([
            makeItem(
              35,
              "source-a-product",
            ),
          ]),
        };

        const secondAdapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-b",
          lookup: vi.fn().mockResolvedValue([
            makeItem(
              29,
              "source-b-product",
            ),
          ]),
        };

        const registry =
          new CataloguePriceLookupRegistry({
            "source-a": () => firstAdapter,
            "source-b": () => secondAdapter,
          });

        const api = makeApi([
          makeSource(
            "source-1",
            "shoprite-source-a",
            "source-a",
            1,
          ),
          makeSource(
            "source-2",
            "shoprite-source-b",
            "source-b",
            2,
          ),
        ]);

        const result =
          await lookupCurrentCataloguePrices(
            api,
            {
              retailerId: "retailer-shoprite",
            },
            {
              name: "Full Cream Milk",
            },
            registry,
          );

        expect(firstAdapter.lookup)
          .toHaveBeenCalled();

        expect(secondAdapter.lookup)
          .toHaveBeenCalled();

        expect(result.items)
          .toHaveLength(2);

        expect(result.items.map(
          (item) => item.price,
        ))
          .toEqual([35, 29]);

        expect(result.items.map(
          (item) => item.sourceReference,
        ))
          .toEqual([
            "source-a-product",
            "source-b-product",
          ]);

        expect(result.sourcesMatched)
          .toBe(2);

        expect(result.matchedSourceId)
          .toBe("source-1");

        expect(result.matchedSourceCode)
          .toBe("shoprite-source-a");
      },
    );

    it(
      "normalises lookup query values before passing them to adapters",
      async () => {
        const adapter: CataloguePriceLookupAdapter = {
          adapterKey: "source-a",
          lookup: vi.fn().mockResolvedValue([]),
        };

        const registry =
          new CataloguePriceLookupRegistry({
            "source-a": () => adapter,
          });

        const api = makeApi([
          makeSource(
            "source-1",
            "shoprite-source-a",
            "source-a",
            1,
          ),
        ]);

        await lookupCurrentCataloguePrices(
          api,
          {
            retailerId: "retailer-shoprite",
          },
          {
            name: "  Full Cream Milk  ",
            brand: " ",
            barcode: " 6001234567890 ",
            packSize: "",
          },
          registry,
        );

        expect(adapter.lookup)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              catalogueSourceId: "source-1",
            }),
            {
              name: "Full Cream Milk",
              barcode: "6001234567890",
            },
          );
      },
    );
  },
);
