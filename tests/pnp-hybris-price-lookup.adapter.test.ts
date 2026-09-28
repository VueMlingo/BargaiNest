import { describe, expect, it, vi, afterEach } from "vitest";
import { PnpHybrisPriceLookupAdapter } from "../src/modules/retail-catalogue/adapters/pnp-hybris-price-lookup.adapter.js";

/**
 * All fixtures below are taken from a REAL live response
 * (2026-09-21, storeCode "WC21", query "milk", via
 * scripts/probe-pnp-hybris.mjs against the real endpoint) -- not
 * constructed samples. Confirmed at the same time: this endpoint
 * works as a plain server-to-server POST, no session cookie, no
 * auth token, nothing.
 */

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

const REAL_PRODUCT_ON_PROMOTION = {
  available: true,
  averageRating: 5,
  brandSellerId: "PICK N PAY",
  code: "000000000000349246_CS",
  name: "PnP UHT Full Cream Milk 6 x 1L",
  numberOfReviews: 5,
  price: {
    average: false,
    currencyIso: "ZAR",
    formattedValue: "R97.99",
    oldPrice: 99.99,
    oldPriceFormattedValue: "R99.99",
    onlineOnlyPrice: false,
    priceType: "BUY",
    savings: 2,
    savingsFormattedValue: "R2.00",
    value: 97.99,
  },
  productDisplayBadges: [{ displayGroup: "group4", displayName: "SAVE" }],
  productIdForTracking: "000000000000349246_CS",
  quantityType: "NORMAL",
  sponsoredProduct: false,
  stock: { stockLevelStatus: "inStock" },
};

describe("PnpHybrisPriceLookupAdapter", () => {
  it("builds the real confirmed request shape: POST, storeCode, query, ZAR currency", async () => {
    mockFetchOnce(200, { products: [] });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");

    await adapter.lookup({} as any, { name: "milk" });

    const [calledUrl, calledOptions] = (global.fetch as any).mock.calls[0];
    expect(calledUrl).toContain("www.pnp.co.za/pnphybris/v2/pnp-spa/products/search");
    expect(calledUrl).toContain("storeCode=WC21");
    expect(calledUrl).toContain("query=milk");
    expect(calledUrl).toContain("curr=ZAR");
    expect(calledOptions.method).toBe("POST");
  });

  it("REAL DATA: extracts price, wasPrice, and isPromotion correctly from an actual promoted product", async () => {
    mockFetchOnce(200, { products: [REAL_PRODUCT_ON_PROMOTION] });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");

    const items = await adapter.lookup({} as any, { name: "milk" });

    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("PnP UHT Full Cream Milk 6 x 1L");
    expect(items[0]!.price).toBe(97.99);
    expect(items[0]!.wasPrice).toBe(99.99);
    expect(items[0]!.isPromotion).toBe(true);
    expect(items[0]!.promotionText).toBe("SAVE");
    expect(items[0]!.extractionMethod).toBe("API");
  });

  it("REAL-SHAPED: a product with savings of 0 is correctly NOT flagged as a promotion, even with priceType 'BUY' present", async () => {
    // priceType alone is not a reliable signal -- confirmed by the
    // Constructor.io equivalent bug (priceConditionType:"PROMOTION"
    // on almost every item). savings must be a genuine positive
    // number.
    const nonPromotedProduct = {
      ...REAL_PRODUCT_ON_PROMOTION,
      code: "different-product",
      price: {
        ...REAL_PRODUCT_ON_PROMOTION.price,
        value: 45.99,
        oldPrice: 45.99,
        savings: 0,
      },
      productDisplayBadges: [],
    };

    mockFetchOnce(200, { products: [nonPromotedProduct] });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");
    const items = await adapter.lookup({} as any, { name: "milk" });

    expect(items[0]!.isPromotion).toBe(false);
    expect(items[0]!.wasPrice).toBeUndefined();
  });

  it("uses query.storeCode over the adapter's configured default when supplied", async () => {
    mockFetchOnce(200, { products: [] });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21"); // default

    await adapter.lookup({} as any, { name: "milk", storeCode: "GC02" });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("storeCode=GC02");
    expect(calledUrl).not.toContain("storeCode=WC21");
  });

  it("falls back to the configured default store code when none is supplied on the query", async () => {
    mockFetchOnce(200, { products: [] });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");

    await adapter.lookup({} as any, { name: "milk" });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("storeCode=WC21");
  });

  it("returns an empty array (not an error) when the query has no name to search with", async () => {
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");
    const items = await adapter.lookup({} as any, {});
    expect(items).toEqual([]);
  });

  it("skips a product with no usable price rather than inventing one", async () => {
    mockFetchOnce(200, {
      products: [{ code: "no-price-product", name: "Mystery Item" }],
    });
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");

    const items = await adapter.lookup({} as any, { name: "milk" });

    expect(items).toEqual([]);
  });

  it("throws a clear, identifiable error on a non-2xx response, rather than silently returning empty", async () => {
    mockFetchOnce(403, {});
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");

    await expect(adapter.lookup({} as any, { name: "milk" })).rejects.toThrow(
      "PNP_HYBRIS_REQUEST_FAILED:403",
    );
  });

  it("adapterKey is fixed to PICK_N_PAY_LIVE_SEARCH, for correct registry resolution", () => {
    const adapter = new PnpHybrisPriceLookupAdapter("WC21");
    expect(adapter.adapterKey).toBe("PICK_N_PAY_LIVE_SEARCH");
  });
});
