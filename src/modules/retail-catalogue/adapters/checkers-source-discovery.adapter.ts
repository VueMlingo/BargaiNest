import type {
  CatalogueSourceCandidate,
  CatalogueSourceDiscoveryAdapter,
  CatalogueSourceDiscoveryContext,
} from "../retail-catalogue.source-discovery.types.js";

/**
 * ⚠️ UNVERIFIED — do not enable in production until confirmed.
 *
 * Checkers is part of the Shoprite Group, so it is worth checking
 * whether it shares Shoprite's specials.shoprite.co.za-style
 * flipbook publication platform under its own domain. That has NOT
 * been confirmed — the real discovery URL below is a best guess
 * based on the Shoprite naming convention, not a verified endpoint.
 *
 * Checkers also operates Sixty60 (checkers.co.za / app), a full
 * e-commerce storefront with real per-SKU pricing. That is likely a
 * better long-term data source than a specials brochure, but it is
 * almost certainly a JS-rendered app backed by an internal API, which
 * this plain-fetch adapter shape cannot reach. See
 * RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md before building further.
 */
const GUESSED_DISCOVERY_URL = "https://specials.checkers.co.za";

export class CheckersSourceDiscoveryAdapter
  implements CatalogueSourceDiscoveryAdapter
{
  readonly discoveryKey = "CHECKERS";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly discoveryUrl: string = GUESSED_DISCOVERY_URL,
  ) {}

  async discover(
    context: CatalogueSourceDiscoveryContext,
  ): Promise<CatalogueSourceCandidate[]> {
    const response = await this.fetchImpl(this.discoveryUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "BargaiNest-CatalogueDiscovery/1.0 (+catalogue-discovery)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `CHECKERS_DISCOVERY_UNVERIFIED_URL_HTTP_${response.status}: ` +
          `${this.discoveryUrl} has not been confirmed as a real Checkers ` +
          `specials source. See RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md.`,
      );
    }

    const html = await response.text();

    if (!html.trim()) {
      throw new Error("CHECKERS_DISCOVERY_EMPTY");
    }

    return this.extractCandidates(html, context);
  }

  private extractCandidates(
    html: string,
    context: CatalogueSourceDiscoveryContext,
  ): CatalogueSourceCandidate[] {
    const candidates: CatalogueSourceCandidate[] = [];
    const seen = new Set<string>();

    // Mirrors the Shoprite /deals/<slug>/ pattern as a starting guess.
    // MUST be re-verified against the real Checkers page structure.
    const pattern =
      /href=["'](https:\/\/specials\.checkers\.co\.za\/deals\/[^"']+\/(?:index\.html)?|\/deals\/[^"']+\/(?:index\.html)?)["']/gi;

    for (const match of html.matchAll(pattern)) {
      const href = match[1];
      if (!href) continue;

      const sourceUrl = new URL(href, this.discoveryUrl).toString();
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);

      const path = new URL(sourceUrl).pathname;
      const slug = path.replace(/^\/deals\//, "").replace(/\/index\.html$/, "").replace(/\/$/, "");
      if (!slug) continue;

      candidates.push({
        code: `CHECKERS_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
        name: this.humaniseSlug(slug),
        channel: "PHYSICAL_CATALOGUE",
        sourceType: "WEB_PAGE",
        sourceUrl,
        adapterKey: "CHECKERS_PUBLICATION",
        description: `Checkers publication discovered from ${this.discoveryUrl} (UNVERIFIED)`,
        countryCode: context.countryCode ?? "ZA",
        ...(context.province !== undefined && { province: context.province }),
        ...(context.city !== undefined && { city: context.city }),
        sourcePriority: 100,
      });
    }

    return candidates;
  }

  private humaniseSlug(slug: string): string {
    return slug
      .replace(/([a-z])(\d)/gi, "$1 $2")
      .replace(/(\d)([a-z])/gi, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}
