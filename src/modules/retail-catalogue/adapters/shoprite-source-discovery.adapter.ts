import type {
  CatalogueSourceCandidate,
  CatalogueSourceDiscoveryAdapter,
  CatalogueSourceDiscoveryContext,
} from "../retail-catalogue.source-discovery.types.js";

const DEFAULT_DISCOVERY_URL = "https://specials.shoprite.co.za";

export class ShopriteSourceDiscoveryAdapter
  implements CatalogueSourceDiscoveryAdapter
{
  readonly discoveryKey = "SHOPRITE";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly discoveryUrl: string = DEFAULT_DISCOVERY_URL,
  ) {}

  async discover(
    context: CatalogueSourceDiscoveryContext,
  ): Promise<CatalogueSourceCandidate[]> {
    const response = await this.fetchImpl(this.discoveryUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "BargaiNest-CatalogueDiscovery/1.0 (+catalogue-discovery)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `SHOPRITE_DISCOVERY_HTTP_${response.status}`,
      );
    }

    const html = await response.text();

    if (!html.trim()) {
      throw new Error("SHOPRITE_DISCOVERY_EMPTY");
    }

    return this.extractCandidates(html, context);
  }

  private extractCandidates(
    html: string,
    context: CatalogueSourceDiscoveryContext,
  ): CatalogueSourceCandidate[] {
    const candidates: CatalogueSourceCandidate[] = [];
    const seen = new Set<string>();

    const pattern =
      /href=["'](https:\/\/specials\.shoprite\.co\.za\/deals\/[^"']+\/(?:index\.html)?|\/deals\/[^"']+\/(?:index\.html)?)["']/gi;

    for (const match of html.matchAll(pattern)) {
      const href = match[1];

      if (!href) continue;

      const sourceUrl = new URL(
        href,
        this.discoveryUrl,
      ).toString();

      if (seen.has(sourceUrl)) continue;

      seen.add(sourceUrl);

      const path = new URL(sourceUrl).pathname;
      const slug = path
        .replace(/^\/deals\//, "")
        .replace(/\/index\.html$/, "")
        .replace(/\/$/, "");

      if (!slug) continue;

      const name = this.humaniseSlug(slug);

      candidates.push({
        code: `SHOPRITE_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
        name,
        channel: "PHYSICAL_CATALOGUE",
        sourceType: "WEB_PAGE",
        sourceUrl,
        adapterKey: "SHOPRITE_PUBLICATION",
        description: `Shoprite publication discovered from ${this.discoveryUrl}`,
        countryCode: context.countryCode ?? "ZA",
        ...(context.province !== undefined && {
          province: context.province,
        }),
        ...(context.city !== undefined && {
          city: context.city,
        }),
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
      .replace(/\b\w/g, (character) => character.toUpperCase())
      .trim();
  }
}
