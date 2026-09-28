import { describe, expect, it, vi } from "vitest";
import { browsePromotions, browsePromotionsForRetailer } from "../src/modules/promotions/promotions.service.js";
import type { PromotionRetailerConfig } from "../src/modules/promotions/promotions.service.js";

function makeConfig(overrides: Partial<PromotionRetailerConfig> = {}): PromotionRetailerConfig {
  return {
    retailerCode: "TEST_RETAILER",
    retailerName: "Test Retailer",
    retailerId: "test-retailer",
    discoveryAdapter: { discoveryKey: "TEST", discover: vi.fn().mockResolvedValue([]) },
    publicationAdapterFactory: () => ({ adapterKey: "TEST_PUB", discover: vi.fn().mockResolvedValue([]) }),
    ...overrides,
  };
}

describe("browsePromotionsForRetailer", () => {
  it("returns only items flagged isPromotion, filtering out regular priced items", async () => {
    const config = makeConfig({
      discoveryAdapter: {
        discoveryKey: "TEST",
        discover: vi.fn().mockResolvedValue([
          { code: "src-1", name: "Specials Page", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://example.com/specials", adapterKey: "TEST_PUB" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "TEST_PUB",
        discover: vi.fn().mockResolvedValue([
          { name: "Milk on special", price: 19.99, isPromotion: true, extractionMethod: "WEB_PARSER" },
          { name: "Regular bread", price: 15.0, isPromotion: false, extractionMethod: "WEB_PARSER" },
        ]),
      }),
    });

    const promotions = await browsePromotionsForRetailer(config);

    expect(promotions).toHaveLength(1);
    expect(promotions[0]!.name).toBe("Milk on special");
    expect(promotions[0]!.retailerCode).toBe("TEST_RETAILER");
  });

  it("filters by search term, case-insensitively", async () => {
    const config = makeConfig({
      discoveryAdapter: {
        discoveryKey: "TEST",
        discover: vi.fn().mockResolvedValue([
          { code: "src-1", name: "Specials", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://example.com/specials", adapterKey: "TEST_PUB" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "TEST_PUB",
        discover: vi.fn().mockResolvedValue([
          { name: "Full Cream MILK 1L", price: 19.99, isPromotion: true, extractionMethod: "WEB_PARSER" },
          { name: "White Bread", price: 15.0, isPromotion: true, extractionMethod: "WEB_PARSER" },
        ]),
      }),
    });

    const promotions = await browsePromotionsForRetailer(config, { searchTerm: "milk" });

    expect(promotions).toHaveLength(1);
    expect(promotions[0]!.name).toContain("MILK");
  });

  it("bounds cost: only fetches the first N discovered sources", async () => {
    const publicationDiscover = vi.fn().mockResolvedValue([]);
    const config = makeConfig({
      discoveryAdapter: {
        discoveryKey: "TEST",
        discover: vi.fn().mockResolvedValue([
          { code: "s1", name: "S1", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/1", adapterKey: "P" },
          { code: "s2", name: "S2", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/2", adapterKey: "P" },
          { code: "s3", name: "S3", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/3", adapterKey: "P" },
          { code: "s4", name: "S4", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/4", adapterKey: "P" },
        ]),
      },
      publicationAdapterFactory: () => ({ adapterKey: "P", discover: publicationDiscover }),
    });

    await browsePromotionsForRetailer(config, { maxSourcesPerRetailer: 2 });

    expect(publicationDiscover).toHaveBeenCalledTimes(2);
  });

  it("skips a source that fails to fetch/parse, rather than failing the whole browse", async () => {
    const config = makeConfig({
      discoveryAdapter: {
        discoveryKey: "TEST",
        discover: vi.fn().mockResolvedValue([
          { code: "bad", name: "Bad", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/bad", adapterKey: "P" },
          { code: "good", name: "Good", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/good", adapterKey: "P" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "P",
        discover: vi.fn(async (context: { sourceUrl?: string }) => {
          if (context.sourceUrl === "https://x/bad") throw new Error("fetch failed");
          return [{ name: "Good Deal", price: 10, isPromotion: true, extractionMethod: "WEB_PARSER" as const }];
        }),
      }),
    });

    const onError = vi.fn();
    const promotions = await browsePromotionsForRetailer(config, {}, onError);

    expect(onError).toHaveBeenCalledWith("https://x/bad", expect.any(Error));
    expect(promotions).toHaveLength(1);
    expect(promotions[0]!.name).toBe("Good Deal");
  });

  it("drops an item with no valid price rather than showing a broken promotion", async () => {
    const config = makeConfig({
      discoveryAdapter: {
        discoveryKey: "TEST",
        discover: vi.fn().mockResolvedValue([
          { code: "s1", name: "S1", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://x/1", adapterKey: "P" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "P",
        discover: vi.fn().mockResolvedValue([
          { name: "No price item", isPromotion: true, extractionMethod: "WEB_PARSER" },
        ]),
      }),
    });

    const promotions = await browsePromotionsForRetailer(config);
    expect(promotions).toHaveLength(0);
  });
});

describe("browsePromotions", () => {
  it("aggregates promotions across multiple retailer configs", async () => {
    const configA = makeConfig({
      retailerCode: "A",
      discoveryAdapter: {
        discoveryKey: "A",
        discover: vi.fn().mockResolvedValue([
          { code: "a1", name: "A1", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://a/1", adapterKey: "P" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "P",
        discover: vi.fn().mockResolvedValue([{ name: "Deal A", price: 5, isPromotion: true, extractionMethod: "WEB_PARSER" }]),
      }),
    });
    const configB = makeConfig({
      retailerCode: "B",
      discoveryAdapter: {
        discoveryKey: "B",
        discover: vi.fn().mockResolvedValue([
          { code: "b1", name: "B1", channel: "PHYSICAL_CATALOGUE", sourceType: "WEB_PAGE", sourceUrl: "https://b/1", adapterKey: "P" },
        ]),
      },
      publicationAdapterFactory: () => ({
        adapterKey: "P",
        discover: vi.fn().mockResolvedValue([{ name: "Deal B", price: 7, isPromotion: true, extractionMethod: "WEB_PARSER" }]),
      }),
    });

    const promotions = await browsePromotions([configA, configB]);

    expect(promotions).toHaveLength(2);
    expect(promotions.map((p) => p.retailerCode).sort()).toEqual(["A", "B"]);
  });
});
