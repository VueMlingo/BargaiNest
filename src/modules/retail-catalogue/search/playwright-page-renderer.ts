import { chromium, type Browser } from "playwright";
import type { PageRenderer, SearchResultCandidate } from "./page-renderer.js";
import type { RetailerSearchConfig } from "./retailer-search.config.js";

/**
 * Headless-browser renderer for retailer sites confirmed (or assumed,
 * pending confirmation) to need real JS execution — e.g. Woolworths,
 * whose product pages were confirmed this session to have NO price in
 * the raw server response.
 *
 * IMPORTANT — not executable in the sandbox this was written in:
 * this repo's Playwright browser binary could not be installed here
 * (network restricted to package registries; Chromium's download host
 * isn't reachable). This file typechecks cleanly against Playwright's
 * real type definitions, and its control flow is covered by
 * retailer-search.adapter.test.ts via a fake PageRenderer — but the
 * actual browser automation below has NOT been run against a real
 * browser or a real retailer site. Test this for real in your
 * environment before trusting it in production.
 *
 * Deployment note for Cloud Run: this needs a browser binary present
 * in the container. Either:
 *   - use `mcr.microsoft.com/playwright:v1.*-noble` as your base image
 *     (has Chromium + all system deps preinstalled), or
 *   - run `npx playwright install --with-deps chromium` as a build
 *     step in your own Dockerfile.
 * Either way, expect a meaningfully larger container image, slower
 * cold starts, and higher memory requirements than the rest of this
 * backend currently needs — budget Cloud Run min-instances/memory
 * accordingly rather than deploying this to the same tight limits as
 * the plain-fetch adapters.
 */
export class PlaywrightPageRenderer implements PageRenderer {
  private browserPromise: Promise<Browser> | null = null;

  constructor(private readonly timeoutMs = 20_000) {}

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true });
    }
    return this.browserPromise;
  }

  async renderUrl(url: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({
      userAgent: "BargaiNest-CatalogueAdapter/1.0 (+catalogue-ingestion)",
    });

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: this.timeoutMs });
      return await page.content();
    } finally {
      await page.close();
    }
  }

  /**
   * Generic, config-driven search: open the search URL (or homepage),
   * optionally type the query into a search box, then read result
   * cards off the rendered page using the selectors supplied in
   * `config`. Every selector is a guess until confirmed per retailer
   * — see RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md.
   */
  async searchWithConfig(
    config: RetailerSearchConfig,
    query: string,
  ): Promise<SearchResultCandidate[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({
      userAgent: "BargaiNest-CatalogueAdapter/1.0 (+catalogue-ingestion)",
    });

    try {
      const url = config.buildSearchUrl(query);
      await page.goto(url, { waitUntil: "networkidle", timeout: this.timeoutMs });

      if (config.searchInputSelector) {
        await page.fill(config.searchInputSelector, query);
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle", { timeout: this.timeoutMs });
      }

      const cards = await page.$$(config.resultCardSelector);
      const candidates: SearchResultCandidate[] = [];

      for (const card of cards.slice(0, config.maxResultsToConfirm)) {
        const nameEl = await card.$(config.resultNameSelector);
        const linkEl = await card.$(config.resultLinkSelector);
        if (!nameEl || !linkEl) continue;

        const name = (await nameEl.textContent())?.trim();
        const href = await linkEl.getAttribute("href");
        if (!name || !href) continue;

        let priceHint: number | null = null;
        if (config.resultPriceSelector) {
          const priceEl = await card.$(config.resultPriceSelector);
          const priceText = (await priceEl?.textContent())?.trim();
          const parsed = priceText ? Number(priceText.replace(/[^0-9.]/g, "")) : NaN;
          priceHint = Number.isFinite(parsed) ? parsed : null;
        }

        candidates.push({
          name,
          productUrl: new URL(href, url).toString(),
          priceHint,
        });
      }

      return candidates;
    } finally {
      await page.close();
    }
  }

  /** Satisfies the PageRenderer interface for callers that don't have
   *  a full RetailerSearchConfig on hand — most call sites should
   *  prefer `searchWithConfig` directly. */
  async search(searchUrl: string, query: string): Promise<SearchResultCandidate[]> {
    return this.searchWithConfig(
      {
        retailerKey: "UNKNOWN",
        confidenceNote: "generic search() call without a full config",
        productPagesConfirmedServerRendered: false,
        buildSearchUrl: () => searchUrl,
        resultCardSelector: "[data-product-card]",
        resultNameSelector: "[data-product-name]",
        resultLinkSelector: "a",
        maxResultsToConfirm: 5,
      },
      query,
    );
  }

  async close(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
