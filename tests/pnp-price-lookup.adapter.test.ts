import { describe, expect, it, vi } from "vitest";
import type { CatalogueChannel } from "@prisma/client";
import type {
  CataloguePriceLookupContext,
} from "../src/modules/retail-catalogue/retail-catalogue.price-lookup.types.js";

import { PnpPriceLookupAdapter } from "../src/modules/retail-catalogue/adapters/pnp-price-lookup.adapter.js";

function context(
  storeCode?: string,
): CataloguePriceLookupContext {
  const value: CataloguePriceLookupContext = {
    catalogueSourceId: "source-1",
    retailerId: "retailer-1",
    channel: "ONLINE_STORE" as CatalogueChannel,
    sourceType: "LIVE_SEARCH",
    sourceUrl: "https://www.pnp.co.za",
    region: "Western Cape",
    countryCode: "ZA",
    province: "Western Cape",
    city: "Cape Town",
  };

  if (storeCode !== undefined) {
    value.storeCode = storeCode;
  }

  return value;
}

function response(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

describe("PnpPriceLookupAdapter", () => {
  it("sends the native PnP POST search request with store context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        products: [],
      }),
    );

    const adapter = new PnpPriceLookupAdapter(fetchMock);

    await adapter.lookup(
      context("WC21"),
      { name: "milk" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    if (!call) {
      throw new Error("Expected PnP fetch call was not recorded.");
    }

    const requestUrl = call[0];
    const options = call[1];

    const parsed = new URL(requestUrl);

    expect(parsed.origin).toBe("https://www.pnp.co.za");
    expect(parsed.pathname).toBe(
      "/pnphybris/v2/pnp-spa/products/search",
    );
    expect(parsed.searchParams.get("query")).toBe("milk");
    expect(parsed.searchParams.get("pageSize")).toBe("72");
    expect(parsed.searchParams.get("storeCode")).toBe("WC21");
    expect(parsed.searchParams.get("lang")).toBe("en");
    expect(parsed.searchParams.get("curr")).toBe("ZAR");

    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    expect(options.body).toBe("{}");
  });

  it("maps current price, old price, SKU, stock and valid promotion data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        products: [
          {
            code: "123456_EA",
            name: "Full Cream Milk 2L",
            brand: "Pick n Pay",
            price: {
              value: 39.99,
              oldPrice: 44.99,
              currencyIso: "ZAR",
              savings: 5,
              priceType: "PROMOTION",
            },
            stock: {
              stockLevelStatus: "INSTOCK",
            },
            potentialPromotions: [
              {
                valid: true,
                description: "Save R5",
              },
              {
                valid: false,
                description: "Expired promotion",
              },
            ],
            quantityType: "unit",
            defaultQuantityOfUom: 1,
          },
        ],
      }),
    );

    const adapter = new PnpPriceLookupAdapter(fetchMock);

    const items = await adapter.lookup(
      context("WC21"),
      { name: "milk" },
    );

    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item).toBeDefined();

    expect(item!.externalId).toBe("123456_EA");
    expect(item!.retailerSku).toBe("123456_EA");
    expect(item!.name).toBe("Full Cream Milk 2L");
    expect(item!.brand).toBe("Pick n Pay");
    expect(item!.price).toBe(39.99);
    expect(item!.wasPrice).toBe(44.99);
    expect(item!.currency).toBe("ZAR");
    expect(item!.availability).toBe("IN_STOCK");
    expect(item!.isPromotion).toBe(true);
    expect(item!.promotionText).toBe("Save R5");
    expect(item!.extractionMethod).toBe("WEB_PARSER");
    expect(item!.extractionConfidence).toBe(0.95);

    expect(item!.rawData).toMatchObject({
      retailer: "PICK_N_PAY",
      code: "123456_EA",
      quantityType: "unit",
      defaultQuantityOfUom: 1,
    });

    expect(item!.promotionText).not.toContain(
      "Expired promotion",
    );
  });

  it("rejects a missing shopping-intent query", async () => {
    const fetchMock = vi.fn();

    const adapter = new PnpPriceLookupAdapter(
      fetchMock,
    );

    await expect(
      adapter.lookup(
        context("WC21"),
        { name: "   " },
      ),
    ).rejects.toThrow(
      "PICK_N_PAY_SEARCH_QUERY_MISSING",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing store code", async () => {
    const fetchMock = vi.fn();

    const adapter = new PnpPriceLookupAdapter(
      fetchMock,
    );

    await expect(
      adapter.lookup(
        context(""),
        { name: "milk" },
      ),
    ).rejects.toThrow(
      "PICK_N_PAY_STORE_CODE_MISSING",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-successful PnP responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(
        {
          error: "server error",
        },
        false,
        500,
      ),
    );

    const adapter = new PnpPriceLookupAdapter(fetchMock);

    await expect(
      adapter.lookup(
        context("WC21"),
        { name: "milk" },
      ),
    ).rejects.toThrow(
      "PICK_N_PAY_SEARCH_HTTP_500",
    );
  });
});
