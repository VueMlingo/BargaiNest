import { describe, expect, it, vi } from "vitest";
import { RetailerSearchPriceAdapter } from "../../src/modules/retail-catalogue/search/retailer-search.adapter.js";
import type { RetailerSearchConfig } from "../../src/modules/retail-catalogue/search/retailer-search.config.js";
import type { PageRenderer, SearchResultCandidate } from "../../src/modules/retail-catalogue/search/page-renderer.js";

const JSON_LD_PRODUCT_HTML = (name: string, price: number) => `
<html><head>
<script type="application/ld+json">
{ "@type": "Product", "name": "${name}", "offers": { "price": ${price} } }
</script>
</head></html>
`;

function makeConfig(overrides: Partial<RetailerSearchConfig> = {}): RetailerSearchConfig {
  return {
    retailerKey: "TEST_RETAILER",
    confidenceNote: "test config",
    productPagesConfirmedServerRendered: false,
    buildSearchUrl: (q) => `https://example.co.za/search?q=${q}`,
    resultCardSelector: ".card",
    resultNameSelector: ".name",
    resultLinkSelector: "a",
    maxResultsToConfirm: 5,
    ...overrides,
  };
}

describe("RetailerSearchPriceAdapter", () => {
  it("throws when the query has no search term rather than silently returning nothing", async () => {
    const config = makeConfig();
    const fakeBrowserRenderer = {
      searchWithConfig: vi.fn(),
      renderUrl: vi.fn(),
      search: vi.fn(),
    };
    const adapter = new RetailerSearchPriceAdapter(config, {
      browserRenderer: fakeBrowserRenderer as never,
    });

    await expect(adapter.lookup({} as never, {})).rejects.toThrow(
      "TEST_RETAILER_SEARCH_QUERY_MISSING",
    );
  });

  it("searches, then confirms each candidate via its product page, using the browser renderer for both when not confirmed server-rendered", async () => {
    const config = makeConfig({ productPagesConfirmedServerRendered: false });

    const candidates: SearchResultCandidate[] = [
      { name: "Full Cream Milk 1L", productUrl: "https://example.co.za/p/1" },
      { name: "Low Fat Milk 1L", productUrl: "https://example.co.za/p/2" },
    ];

    const renderUrl = vi
      .fn()
      .mockResolvedValueOnce(JSON_LD_PRODUCT_HTML("Full Cream Milk 1L", 21.99))
      .mockResolvedValueOnce(JSON_LD_PRODUCT_HTML("Low Fat Milk 1L", 19.99));

    const fakeBrowserRenderer = {
      searchWithConfig: vi.fn().mockResolvedValue(candidates),
      renderUrl,
      search: vi.fn(),
    };
    const fakeFetchRenderer: PageRenderer = {
      renderUrl: vi.fn(),
      search: vi.fn(),
    };

    const adapter = new RetailerSearchPriceAdapter(config, {
      browserRenderer: fakeBrowserRenderer as never,
      fetchRenderer: fakeFetchRenderer,
    });

    const items = await adapter.lookup({} as never, { name: "milk" });

    expect(fakeBrowserRenderer.searchWithConfig).toHaveBeenCalledWith(config, "milk");
    expect(renderUrl).toHaveBeenCalledTimes(2);
    expect(fakeFetchRenderer.renderUrl).not.toHaveBeenCalled();
    expect(items).toHaveLength(2);
    expect(items[0]?.price).toBe(21.99);
    expect(items[1]?.price).toBe(19.99);
  });

  it("uses the (cheaper) fetch renderer for per-product confirmation when the retailer is confirmed server-rendered", async () => {
    const config = makeConfig({ productPagesConfirmedServerRendered: true });

    const candidates: SearchResultCandidate[] = [
      { name: "Full Cream Milk 1L", productUrl: "https://example.co.za/p/1" },
    ];

    const fakeBrowserRenderer = {
      searchWithConfig: vi.fn().mockResolvedValue(candidates),
      renderUrl: vi.fn(),
      search: vi.fn(),
    };
    const fetchRenderUrl = vi
      .fn()
      .mockResolvedValue(JSON_LD_PRODUCT_HTML("Full Cream Milk 1L", 21.99));
    const fakeFetchRenderer: PageRenderer = {
      renderUrl: fetchRenderUrl,
      search: vi.fn(),
    };

    const adapter = new RetailerSearchPriceAdapter(config, {
      browserRenderer: fakeBrowserRenderer as never,
      fetchRenderer: fakeFetchRenderer,
    });

    const items = await adapter.lookup({} as never, { name: "milk" });

    // Search itself still goes through the browser renderer — no
    // retailer has a confirmed server-rendered search page.
    expect(fakeBrowserRenderer.searchWithConfig).toHaveBeenCalled();
    expect(fakeBrowserRenderer.renderUrl).not.toHaveBeenCalled();
    // But per-product confirmation uses the cheap fetch renderer.
    expect(fetchRenderUrl).toHaveBeenCalledWith("https://example.co.za/p/1");
    expect(items).toHaveLength(1);
  });

  it("skips a candidate whose product page yields no extractable price, rather than throwing", async () => {
    const config = makeConfig();
    const candidates: SearchResultCandidate[] = [
      { name: "Mystery Item", productUrl: "https://example.co.za/p/unparseable" },
    ];

    const fakeBrowserRenderer = {
      searchWithConfig: vi.fn().mockResolvedValue(candidates),
      renderUrl: vi.fn().mockResolvedValue("<html><body>nothing here</body></html>"),
      search: vi.fn(),
    };

    const adapter = new RetailerSearchPriceAdapter(config, {
      browserRenderer: fakeBrowserRenderer as never,
    });

    const items = await adapter.lookup({} as never, { name: "mystery" });
    expect(items).toHaveLength(0);
  });
});
