import { describe, expect, it, vi } from "vitest";
import { discoverAndPersistCatalogueSources } from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.orchestrator.js";
import { CatalogueSourceDiscoveryRegistry } from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.registry.js";

describe("discoverAndPersistCatalogueSources", () => {
  it("resolves the adapter and persists discovered sources", async () => {
    const discover = vi.fn().mockResolvedValue([]);

    const registry = new CatalogueSourceDiscoveryRegistry({
      test: () => ({
        discoveryKey: "test",
        discover,
      }),
    });

    const prisma = {
      catalogueSource: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as never;

    const result = await discoverAndPersistCatalogueSources(
      prisma,
      registry,
      {
        retailerId: "retailer-1",
        retailerCode: "TEST",
        retailerName: "Test Retailer",
        countryCode: "ZA",
        province: "Western Cape",
        discoveryKey: "test",
      },
    );

    expect(discover).toHaveBeenCalledWith({
      retailerId: "retailer-1",
      retailerCode: "TEST",
      retailerName: "Test Retailer",
      countryCode: "ZA",
      province: "Western Cape",
      city: undefined,
    });

    expect(result.discovered).toBe(0);
  });

  it("rejects an unknown discovery adapter", async () => {
    const registry = new CatalogueSourceDiscoveryRegistry();

    const prisma = {} as never;

    await expect(
      discoverAndPersistCatalogueSources(prisma, registry, {
        retailerId: "retailer-1",
        retailerCode: "TEST",
        retailerName: "Test Retailer",
        discoveryKey: "missing",
      }),
    ).rejects.toThrow(
      "CATALOGUE_SOURCE_DISCOVERY_NOT_FOUND:missing",
    );
  });
});
