import type { PageRenderer, SearchResultCandidate } from "./page-renderer.js";

/**
 * Lightest-weight renderer: a plain HTTP fetch, no JS execution.
 * Only correct for retailers confirmed to server-render the pages it's
 * asked to fetch (see RetailerSearchConfig.productPagesConfirmedServerRendered).
 * Using this for a client-rendered page will silently return an
 * incomplete shell — callers must gate on the confirmed flag, not
 * assume this always works.
 */
export class FetchPageRenderer implements PageRenderer {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async renderUrl(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "BargaiNest-CatalogueAdapter/1.0 (+catalogue-ingestion)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`FETCH_RENDERER_HTTP_${response.status}: ${url}`);
      }

      const html = await response.text();
      if (!html.trim()) {
        throw new Error(`FETCH_RENDERER_EMPTY: ${url}`);
      }

      return html;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * A plain fetch cannot "search" in the interactive sense — it can
   * only load whatever a given URL returns. This exists so
   * FetchPageRenderer satisfies the PageRenderer interface for
   * retailers where a confirmed, server-rendered search/category URL
   * exists (none confirmed as of this writing — see the checklist).
   * Until one is confirmed, this deliberately throws rather than
   * guessing at result-card markup with no evidence it exists.
   */
  async search(_searchUrl: string, _query: string): Promise<SearchResultCandidate[]> {
    throw new Error(
      "FETCH_RENDERER_SEARCH_NOT_SUPPORTED: no retailer has a confirmed " +
        "server-rendered search results page yet — use the headless " +
        "renderer for search, or confirm one and extend this renderer.",
    );
  }
}
