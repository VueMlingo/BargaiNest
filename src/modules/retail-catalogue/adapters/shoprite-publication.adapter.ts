import type {
  CatalogueAdapter,
  CatalogueSourceContext,
  RawCatalogueItem,
} from "../retail-catalogue.types.js";
import { parseShopritePublication } from "./shoprite-publication.parser.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export class ShopritePublicationAdapter implements CatalogueAdapter {
  readonly adapterKey = "SHOPRITE_PUBLICATION";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  async discover(
    context: CatalogueSourceContext
  ): Promise<RawCatalogueItem[]> {
    if (!context.sourceUrl) {
      throw new Error("SHOPRITE_SOURCE_URL_MISSING");
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const response = await this.fetchImpl(context.sourceUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "BargaiNest-CatalogueAdapter/1.0 (+catalogue-ingestion)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `SHOPRITE_SOURCE_HTTP_${response.status}`
        );
      }

      const html = await response.text();

      if (!html.trim()) {
        throw new Error("SHOPRITE_SOURCE_EMPTY");
      }

      if (
        /those deals are no longer available/i.test(html) ||
        /<title[^>]*>\s*Shoprite\s*\|\s*404/i.test(html)
      ) {
        throw new Error("SHOPRITE_SOURCE_UNAVAILABLE");
      }

      const parsed = parseShopritePublication(
        html,
        context.sourceUrl
      );

      return parsed.items;
    } finally {
      clearTimeout(timeout);
    }
  }
}
