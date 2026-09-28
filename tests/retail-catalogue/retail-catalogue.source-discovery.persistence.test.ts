import { describe, expect, it, vi } from "vitest";
import { persistDiscoveredCatalogueSources } from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.persistence.js";
import type { CatalogueSourceDiscoveryContext } from "../../src/modules/retail-catalogue/retail-catalogue.source-discovery.types.js";

const context: CatalogueSourceDiscoveryContext = {
  retailerId: "retailer-1",
  retailerCode: "TEST_RETAILER",
  retailerName: "Test Retailer",
  countryCode: "ZA",
  province: "Western Cape",
};

const candidate = {
  code: "TEST_ONLINE",
  name: "Test Online Store",
  channel: "ONLINE" as never,
  sourceType: "WEB_PAGE" as never,
  sourceUrl: "https://example.com",
  adapterKey: "test-adapter",
  sourcePriority: 10,
};

function createPrisma(existing: unknown = null) {
  return {
    catalogueSource: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({
        id: "source-1",
        code: "TEST_ONLINE",
      }),
      update: vi.fn().mockResolvedValue({
        id: "source-1",
        code: "TEST_ONLINE",
      }),
    },
  };
}

describe("persistDiscoveredCatalogueSources", () => {
  it("creates a new source", async () => {
    const prisma = createPrisma();

    const result = await persistDiscoveredCatalogueSources(
      prisma as never,
      context,
      [candidate],
    );

    expect(result.discovered).toBe(1);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
  });

  it("leaves an unchanged source alone", async () => {
    const existing = {
      id: "source-1",
      code: "TEST_ONLINE",
      retailerId: "retailer-1",
      name: "Test Online Store",
      channel: candidate.channel,
      sourceType: candidate.sourceType,
      sourceUrl: candidate.sourceUrl,
      description: null,
      schedule: null,
      adapterKey: candidate.adapterKey,
      region: null,
      countryCode: "ZA",
      province: "Western Cape",
      city: null,
      storeCode: null,
      sourcePriority: 10,
      active: true,
    };

    const prisma = createPrisma(existing);

    const result = await persistDiscoveredCatalogueSources(
      prisma as never,
      context,
      [candidate],
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(1);
    expect(prisma.catalogueSource.update).not.toHaveBeenCalled();
  });

  it("updates an existing source when its metadata changes", async () => {
    const existing = {
      id: "source-1",
      code: "TEST_ONLINE",
      retailerId: "retailer-1",
      name: "Old Name",
      channel: candidate.channel,
      sourceType: candidate.sourceType,
      sourceUrl: "https://old.example.com",
      description: null,
      schedule: null,
      adapterKey: candidate.adapterKey,
      region: null,
      countryCode: "ZA",
      province: "Western Cape",
      city: null,
      storeCode: null,
      sourcePriority: 10,
      active: true,
    };

    const prisma = createPrisma(existing);

    const result = await persistDiscoveredCatalogueSources(
      prisma as never,
      context,
      [candidate],
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
    expect(prisma.catalogueSource.update).toHaveBeenCalled();
  });

  it("does not delete sources absent from discovery", async () => {
    const prisma = createPrisma();

    await persistDiscoveredCatalogueSources(
      prisma as never,
      context,
      [],
    );

    expect(prisma.catalogueSource.create).not.toHaveBeenCalled();
    expect(prisma.catalogueSource.update).not.toHaveBeenCalled();
  });
});
