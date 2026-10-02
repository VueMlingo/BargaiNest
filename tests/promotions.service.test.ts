import { describe, expect, it, vi } from "vitest";
import { browsePromotions, browsePromotionsForRetailer, browsePromotionsViaLiveSearch } from "../src/modules/promotions/promotions.service.js";
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

describe("browsePromotionsViaLiveSearch (BN-030)", () => {
  function makeAdapter(responses: Record<string, any[]>) {
    return {
      adapterKey: "TEST_LIVE_SEARCH",
      lookup: async (_context: any, query: { name?: string }) => responses[query.name ?? ""] ?? [],
    };
  }

  it("searches each category and keeps only items the adapter itself reports as promotional", async () => {
    const adapter = makeAdapter({
      Milk: [
        { name: "Full Cream Milk 2L", price: 25, currency: "ZAR", isPromotion: true, extractionMethod: "API" },
        { name: "Low Fat Milk 1L", price: 15, currency: "ZAR", isPromotion: false, extractionMethod: "API" },
      ],
      Bread: [
        { name: "White Bread 700g", price: 18, currency: "ZAR", isPromotion: true, extractionMethod: "API" },
      ],
    });

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "PICK_N_PAY", retailerName: "Pick n Pay", adapter: adapter as any, context: {} as any },
      {},
      undefined,
      ["Milk", "Bread"],
    );

    expect(result).toHaveLength(2);
    expect(result.some((p) => p.name === "Low Fat Milk 1L")).toBe(false);
    expect(result.every((p) => p.retailerCode === "PICK_N_PAY")).toBe(true);
  });

  it("extracts packSize from the product name when the adapter doesn't supply one (exactly the PnP/Woolworths case)", async () => {
    const adapter = makeAdapter({
      Milk: [{ name: "Clover Fresh Milk 2L", price: 25, currency: "ZAR", isPromotion: true, extractionMethod: "API" }],
    });

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "WOOLWORTHS", retailerName: "Woolworths", adapter: adapter as any, context: {} as any },
      {},
      undefined,
      ["Milk"],
    );

    expect(result[0]!.packSize).toBe("2l");
  });

  it("BN-030: one category's search failing does not prevent the others from being tried, and does not fail the whole browse", async () => {
    const adapter = {
      adapterKey: "TEST_LIVE_SEARCH",
      lookup: async (_context: any, query: { name?: string }) => {
        if (query.name === "Milk") throw new Error("Milk search failed");
        return [{ name: "White Bread 700g", price: 18, currency: "ZAR", isPromotion: true, extractionMethod: "API" }];
      },
    };
    const errors: Array<[string, unknown]> = [];

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "PICK_N_PAY", retailerName: "Pick n Pay", adapter: adapter as any, context: {} as any },
      {},
      (source, error) => errors.push([source, error]),
      ["Milk", "Bread"],
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("White Bread 700g");
    expect(errors).toHaveLength(1);
    expect(errors[0]![0]).toContain("Milk");
  });

  it("BN-030 fix: a real search term is sent to the adapter's search AS THE QUERY itself, not used only to post-filter a fixed set of default categories -- searching for a term outside the defaults (e.g. 'chicken') must actually search for it, not silently return nothing", async () => {
    const adapter = makeAdapter({
      chicken: [
        { name: "Chicken Breasts 1kg", price: 65, currency: "ZAR", isPromotion: true, extractionMethod: "API" },
      ],
      // The old (buggy) behaviour would have searched these default
      // categories instead and found nothing for "chicken" at all.
      Milk: [{ name: "Full Cream Milk 2L", price: 25, currency: "ZAR", isPromotion: true, extractionMethod: "API" }],
    });

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "PICK_N_PAY", retailerName: "Pick n Pay", adapter: adapter as any, context: {} as any },
      { searchTerm: "chicken" },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Chicken Breasts 1kg");
  });

  it("with no search term at all, falls back to the default categories (the general 'browse specials' case)", async () => {
    const adapter = makeAdapter({
      Milk: [{ name: "Full Cream Milk 2L", price: 25, currency: "ZAR", isPromotion: true, extractionMethod: "API" }],
      Bread: [{ name: "White Bread 700g", price: 18, currency: "ZAR", isPromotion: true, extractionMethod: "API" }],
      Cola: [], Tea: [], Sugar: [],
    });

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "PICK_N_PAY", retailerName: "Pick n Pay", adapter: adapter as any, context: {} as any },
      {},
    );

    expect(result).toHaveLength(2);
  });

  it("an item missing a usable price is skipped, same as browsePromotionsForRetailer's existing behaviour", async () => {
    const adapter = makeAdapter({
      Milk: [{ name: "Full Cream Milk 2L", currency: "ZAR", isPromotion: true, extractionMethod: "API" } as any],
    });

    const result = await browsePromotionsViaLiveSearch(
      { retailerCode: "PICK_N_PAY", retailerName: "Pick n Pay", adapter: adapter as any, context: {} as any },
      {},
      undefined,
      ["Milk"],
    );

    expect(result).toHaveLength(0);
  });
});

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
