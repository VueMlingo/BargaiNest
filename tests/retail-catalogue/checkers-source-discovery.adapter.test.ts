import { describe, expect, it, vi } from "vitest";
import { CheckersSourceDiscoveryAdapter } from "../../src/modules/retail-catalogue/adapters/checkers-source-discovery.adapter.js";

describe("CheckersSourceDiscoveryAdapter (unverified skeleton)", () => {
  const context = {
    retailerId: "retailer-1",
    retailerCode: "CHECKERS",
    retailerName: "Checkers",
  };

  it("throws a descriptive, non-silent error when the guessed URL 404s", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const adapter = new CheckersSourceDiscoveryAdapter(fetchImpl as unknown as typeof fetch);

    await expect(adapter.discover(context)).rejects.toThrow(
      /CHECKERS_DISCOVERY_UNVERIFIED_URL_HTTP_404/,
    );
  });

  it("extracts candidates if the guessed URL happens to serve a Shoprite-shaped page", async () => {
    const html = `<a href="/deals/some-checkers-deal/index.html">deal</a>`;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    });

    const adapter = new CheckersSourceDiscoveryAdapter(
      fetchImpl as unknown as typeof fetch,
      "https://specials.checkers.co.za",
    );

    const candidates = await adapter.discover(context);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.adapterKey).toBe("CHECKERS_PUBLICATION");
    expect(candidates[0]?.description).toMatch(/UNVERIFIED/);
  });

  it("throws on an empty response body rather than returning an empty result silently", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "   ",
    });

    const adapter = new CheckersSourceDiscoveryAdapter(fetchImpl as unknown as typeof fetch);

    await expect(adapter.discover(context)).rejects.toThrow("CHECKERS_DISCOVERY_EMPTY");
  });
});
