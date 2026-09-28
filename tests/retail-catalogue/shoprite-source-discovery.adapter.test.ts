import { describe, expect, it, vi } from "vitest";
import { ShopriteSourceDiscoveryAdapter } from "../../src/modules/retail-catalogue/adapters/shoprite-source-discovery.adapter.js";

describe("Shoprite source discovery adapter", () => {
  it("discovers Shoprite publication URLs from the discovery page", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        `
          <html>
            <body>
              <a href="/deals/gnritebrandsavings07sep20sep2026/index.html">
                Ritebrand Savings
              </a>
              <a href="https://specials.shoprite.co.za/deals/rsamajordeals04sep06sep2026/index.html">
                Major Weekend Deals
              </a>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        },
      ),
    );

    const adapter = new ShopriteSourceDiscoveryAdapter(
      fetchImpl,
      "https://specials.shoprite.co.za",
    );

    const result = await adapter.discover({
      retailerId: "retailer-1",
      retailerCode: "SHOPRITE",
      retailerName: "Shoprite",
      countryCode: "ZA",
    });

    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      sourceUrl:
        "https://specials.shoprite.co.za/deals/gnritebrandsavings07sep20sep2026/index.html",
      channel: "PHYSICAL_CATALOGUE",
      sourceType: "WEB_PAGE",
      adapterKey: "SHOPRITE_PUBLICATION",
      countryCode: "ZA",
    });

    expect(result[1]).toMatchObject({
      sourceUrl:
        "https://specials.shoprite.co.za/deals/rsamajordeals04sep06sep2026/index.html",
      adapterKey: "SHOPRITE_PUBLICATION",
    });
  });

  it("deduplicates discovered publication URLs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        `
          <a href="/deals/testpublication/index.html">One</a>
          <a href="/deals/testpublication/index.html">Duplicate</a>
        `,
        { status: 200 },
      ),
    );

    const adapter = new ShopriteSourceDiscoveryAdapter(
      fetchImpl,
      "https://specials.shoprite.co.za",
    );

    const result = await adapter.discover({
      retailerId: "retailer-1",
      retailerCode: "SHOPRITE",
      retailerName: "Shoprite",
      countryCode: "ZA",
    });

    expect(result).toHaveLength(1);
  });

  it("rejects a failed discovery request", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Unavailable", { status: 503 }),
    );

    const adapter = new ShopriteSourceDiscoveryAdapter(
      fetchImpl,
      "https://specials.shoprite.co.za",
    );

    await expect(
      adapter.discover({
        retailerId: "retailer-1",
        retailerCode: "SHOPRITE",
        retailerName: "Shoprite",
        countryCode: "ZA",
      }),
    ).rejects.toThrow("SHOPRITE_DISCOVERY_HTTP_503");
  });

  it("rejects an empty discovery response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("   ", { status: 200 }),
    );

    const adapter = new ShopriteSourceDiscoveryAdapter(
      fetchImpl,
      "https://specials.shoprite.co.za",
    );

    await expect(
      adapter.discover({
        retailerId: "retailer-1",
        retailerCode: "SHOPRITE",
        retailerName: "Shoprite",
        countryCode: "ZA",
      }),
    ).rejects.toThrow("SHOPRITE_DISCOVERY_EMPTY");
  });
});
