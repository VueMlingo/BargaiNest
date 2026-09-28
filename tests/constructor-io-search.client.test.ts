import { describe, expect, it, vi, afterEach } from "vitest";
import { ConstructorIoSearchClient } from "../src/modules/retail-catalogue/adapters/constructor-io-search.client.js";
import {
  ConstructorIoPriceLookupAdapter,
  PICK_N_PAY_PRICE_EXTRACTOR,
  makeWoolworthsPriceExtractor,
} from "../src/modules/retail-catalogue/adapters/constructor-io-price-lookup.adapter.js";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConstructorIoSearchClient", () => {
  it("builds a request to Constructor.io's real host, with the query and key present", async () => {
    mockFetchOnce(200, { response: { results: [], total_num_results: 0 } });
    const client = new ConstructorIoSearchClient({ apiKey: "test_key_123" });

    await client.search("milk");

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("ac.cnstrc.com");
    expect(calledUrl).toContain("/search/milk");
    expect(calledUrl).toContain("key=test_key_123");
  });

  it("normalizes a real-shaped response into the client's own result type", async () => {
    mockFetchOnce(200, {
      response: {
        results: [
          { value: "Full Cream Milk 1L", data: { id: "prod-1", priceValue: 21.99 } },
        ],
        total_num_results: 1,
      },
    });
    const client = new ConstructorIoSearchClient({ apiKey: "test_key" });

    const result = await client.search("milk");

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.value).toBe("Full Cream Milk 1L");
    expect(result.results[0]!.id).toBe("prod-1");
    expect(result.results[0]!.data.priceValue).toBe(21.99);
  });

  it("throws a clear, identifiable error on a non-2xx response, rather than silently returning empty", async () => {
    mockFetchOnce(403, {});
    const client = new ConstructorIoSearchClient({ apiKey: "test_key" });

    await expect(client.search("milk")).rejects.toThrow("CONSTRUCTOR_IO_REQUEST_FAILED:403");
  });

  it("handles a response with no results array at all without crashing", async () => {
    mockFetchOnce(200, { response: {} });
    const client = new ConstructorIoSearchClient({ apiKey: "test_key" });

    const result = await client.search("nonexistent");
    expect(result.results).toEqual([]);
  });
});

describe("ConstructorIoPriceLookupAdapter (full end-to-end lookup)", () => {
  it("Pick n Pay: returns priced items, skipping any with no price at all", async () => {
    mockFetchOnce(200, {
      response: {
        results: [
          { value: "Milk 1L", data: { id: "p1", priceValue: 21.99 } },
          { value: "Mystery item with no price", data: { id: "p2" } },
        ],
        total_num_results: 2,
      },
    });

    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "PICK_N_PAY_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: PICK_N_PAY_PRICE_EXTRACTOR,
    });

    const items = await adapter.lookup({} as any, { name: "milk" });

    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("Milk 1L");
    expect(items[0]!.price).toBe(21.99);
    expect(items[0]!.extractionMethod).toBe("API");
  });

  it("Woolworths: drops non-food results even when they have a price", async () => {
    mockFetchOnce(200, {
      response: {
        results: [
          { value: "Milk 1L", data: { id: "w1", p60: 24.99, prodtype: "Food" } },
          { value: "Socks 3-Pack", data: { id: "w2", p60: 89.99, prodtype: "Clothing" } },
        ],
        total_num_results: 2,
      },
    });

    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "WOOLWORTHS_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: makeWoolworthsPriceExtractor("p60"),
    });

    const items = await adapter.lookup({} as any, { name: "milk" });

    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("Milk 1L");
  });

  it("Woolworths: a shopper's province on the lookup query changes the price returned, end to end through the full adapter", async () => {
    mockFetchOnce(200, {
      response: {
        results: [
          { value: "Fresh Full Cream Milk 2 L", data: { id: "20011697", p10: 38.99, p30: 40.99, p60: 39.99, prodtype: "Food" } },
        ],
        total_num_results: 1,
      },
    });

    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "WOOLWORTHS_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: makeWoolworthsPriceExtractor("p30"), // configured default: Gauteng
    });

    // A Western Cape shopper's lookup should get the Western Cape
    // price (38.99), not the adapter's configured Gauteng default
    // (40.99) -- proving province flows all the way from the lookup
    // call through to the actual returned price.
    const items = await adapter.lookup({} as any, { name: "milk", province: "Western Cape" });

    expect(items).toHaveLength(1);
    expect(items[0]!.price).toBe(38.99);
  });

  it("returns an empty array (not an error) when the query has no name to search with", async () => {
    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "PICK_N_PAY_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: PICK_N_PAY_PRICE_EXTRACTOR,
    });

    const items = await adapter.lookup({} as any, {});
    expect(items).toEqual([]);
  });

  it("adapterKey matches what was configured, for correct registry resolution", () => {
    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "WOOLWORTHS_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: makeWoolworthsPriceExtractor("p60"),
    });
    expect(adapter.adapterKey).toBe("WOOLWORTHS_LIVE_SEARCH");
  });

  it("REAL-WORLD REQUIREMENT: serviceUrl override reaches the request -- Woolworths needs a dedicated host, confirmed live, not the shared default", async () => {
    mockFetchOnce(200, { response: { results: [], total_num_results: 0 } });

    const adapter = new ConstructorIoPriceLookupAdapter({
      adapterKey: "WOOLWORTHS_LIVE_SEARCH",
      apiKey: "test_key",
      extractor: makeWoolworthsPriceExtractor("p60"),
      serviceUrl: "https://wpkmgeuco-zone.cnstrc.com",
    });

    await adapter.lookup({} as any, { name: "milk" });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("wpkmgeuco-zone.cnstrc.com");
    expect(calledUrl).not.toContain("ac.cnstrc.com");
  });
});
