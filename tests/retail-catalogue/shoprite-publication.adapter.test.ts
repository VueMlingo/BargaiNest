import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { ShopritePublicationAdapter } from "../../src/modules/retail-catalogue/adapters/shoprite-publication.adapter.js";

const fixturePath = resolve(
  process.cwd(),
  "tests/retail-catalogue/fixtures/shoprite-redbull.html"
);

const fixtureHtml = readFileSync(fixturePath, "utf8");

const context = {
  catalogueSourceId: "00000000-0000-0000-0000-000000000001",
  retailerId: "00000000-0000-0000-0000-000000000002",
  channel: "PHYSICAL_CATALOGUE" as const,
  sourceType: "WEB_PAGE",
  sourceUrl:
    "https://specials.shoprite.co.za/deals/gnredbullenergydrinksavings28aug13sep2026/index.html",
  countryCode: "ZA",
};

describe("Shoprite publication adapter", () => {
  it("fetches and parses a Shoprite publication", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(fixtureHtml, {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      })
    );

    const adapter = new ShopritePublicationAdapter(fetchMock);

    const items = await adapter.discover(context);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(context.sourceUrl);

    expect(items.length).toBeGreaterThanOrEqual(1);

    const redBull = items.find((item) =>
      item.name.toLowerCase().includes("red bull")
    );

    expect(redBull).toBeDefined();
    expect(redBull?.price).toBe(19.99);
    expect(redBull?.currency).toBe("ZAR");
    expect(redBull?.sourceReference).toBe(context.sourceUrl);
  });

  it("fails clearly when the source returns HTTP error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Not found", {
        status: 404,
      })
    );

    const adapter = new ShopritePublicationAdapter(fetchMock);

    await expect(adapter.discover(context)).rejects.toThrow(
      "SHOPRITE_SOURCE_HTTP_404"
    );
  });

  it("rejects an unavailable Shoprite publication", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        "<html><head><title>Shoprite | 404</title></head><body>Those deals are no longer available.</body></html>",
        {
          status: 200,
        }
      )
    );

    const adapter = new ShopritePublicationAdapter(fetchMock);

    await expect(adapter.discover(context)).rejects.toThrow(
      "SHOPRITE_SOURCE_UNAVAILABLE"
    );
  });

  it("rejects an empty response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("", {
        status: 200,
      })
    );

    const adapter = new ShopritePublicationAdapter(fetchMock);

    await expect(adapter.discover(context)).rejects.toThrow(
      "SHOPRITE_SOURCE_EMPTY"
    );
  });

  it("fails when no source URL is configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const adapter = new ShopritePublicationAdapter(fetchMock);

    const { sourceUrl: _sourceUrl, ...contextWithoutSourceUrl } = context;

    await expect(
      adapter.discover(contextWithoutSourceUrl)
    ).rejects.toThrow("SHOPRITE_SOURCE_URL_MISSING");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
