import { describe, expect, it, vi } from "vitest";

import {
  CatalogueAdapterRegistry,
} from "../../src/modules/retail-catalogue/retail-catalogue.adapter-registry.js";

import {
  ingestCatalogueSource,
} from "../../src/modules/retail-catalogue/retail-catalogue.orchestrator.js";

import type {
  CatalogueAdapter,
  CatalogueSourceContext,
} from "../../src/modules/retail-catalogue/retail-catalogue.types.js";

function createAdapter(adapterKey: string): CatalogueAdapter {
  return {
    adapterKey,
    discover: async () => [],
  };
}

function createApi(source: Record<string, unknown>) {
  return {
    prisma: {
      catalogueSource: {
        findUnique: vi.fn().mockResolvedValue(source),
      },
    },
  } as any;
}

describe("ingestCatalogueSource", () => {
  it("loads the source, resolves its adapter and passes the correct context to ingestion", async () => {
    const source = {
      id: "source-1",
      retailerId: "retailer-1",
      active: true,
      adapterKey: "TEST_SOURCE",
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: "https://example.com/catalogue",
      region: "Gauteng",
      countryCode: "ZA",
      province: "Gauteng",
      city: "Johannesburg",
      storeCode: "STORE-1",
    };

    const adapter = createAdapter("TEST_SOURCE");

    const registry = new CatalogueAdapterRegistry({
      TEST_SOURCE: () => adapter,
    });

    const runner = vi.fn().mockResolvedValue({
      catalogueRunId: "run-1",
      itemsDiscovered: 10,
      itemsProcessed: 10,
      itemsMatched: 8,
      itemsUnmatched: 2,
      priceObservationsCreated: 8,
    });

    const result = await ingestCatalogueSource(
      createApi(source),
      "source-1",
      registry,
      runner
    );

    expect(result).toEqual({
      catalogueRunId: "run-1",
      itemsDiscovered: 10,
      itemsProcessed: 10,
      itemsMatched: 8,
      itemsUnmatched: 2,
      priceObservationsCreated: 8,
    });

    expect(runner).toHaveBeenCalledTimes(1);

    const firstCall = runner.mock.calls[0];
    expect(firstCall).toBeDefined();
    const context = firstCall![1] as CatalogueSourceContext;

    expect(context).toEqual({
      catalogueSourceId: "source-1",
      retailerId: "retailer-1",
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: "https://example.com/catalogue",
      region: "Gauteng",
      countryCode: "ZA",
      province: "Gauteng",
      city: "Johannesburg",
      storeCode: "STORE-1",
    });

    expect(firstCall![2]).toBe(adapter);
  });

  it("rejects a missing source", async () => {
    const api = {
      prisma: {
        catalogueSource: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    } as any;

    const registry = new CatalogueAdapterRegistry();

    await expect(
      ingestCatalogueSource(api, "missing-source", registry)
    ).rejects.toThrow("CATALOGUE_SOURCE_NOT_FOUND");
  });

  it("rejects an inactive source", async () => {
    const source = {
      id: "source-1",
      retailerId: "retailer-1",
      active: false,
      adapterKey: "TEST_SOURCE",
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: null,
      region: null,
      countryCode: "ZA",
      province: null,
      city: null,
      storeCode: null,
    };

    const registry = new CatalogueAdapterRegistry();

    await expect(
      ingestCatalogueSource(
        createApi(source),
        "source-1",
        registry
      )
    ).rejects.toThrow("CATALOGUE_SOURCE_INACTIVE");
  });

  it("rejects a source without an adapter key", async () => {
    const source = {
      id: "source-1",
      retailerId: "retailer-1",
      active: true,
      adapterKey: null,
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: null,
      region: null,
      countryCode: "ZA",
      province: null,
      city: null,
      storeCode: null,
    };

    const registry = new CatalogueAdapterRegistry();

    await expect(
      ingestCatalogueSource(
        createApi(source),
        "source-1",
        registry
      )
    ).rejects.toThrow(
      "CATALOGUE_SOURCE_ADAPTER_KEY_MISSING"
    );
  });

  it("fails when the source adapter is unknown", async () => {
    const source = {
      id: "source-1",
      retailerId: "retailer-1",
      active: true,
      adapterKey: "UNKNOWN_SOURCE",
      channel: "ONLINE_STORE",
      sourceType: "WEB_PAGE",
      sourceUrl: null,
      region: null,
      countryCode: "ZA",
      province: null,
      city: null,
      storeCode: null,
    };

    const registry = new CatalogueAdapterRegistry();

    await expect(
      ingestCatalogueSource(
        createApi(source),
        "source-1",
        registry
      )
    ).rejects.toThrow(
      "CATALOGUE_ADAPTER_NOT_FOUND:UNKNOWN_SOURCE"
    );
  });
});
