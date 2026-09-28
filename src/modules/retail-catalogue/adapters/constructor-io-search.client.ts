/**
 * Constructor.io is a third-party search-as-a-service platform used
 * by both Pick n Pay and Woolworths for their own site search --
 * confirmed by directly probing both retailers' pages for references
 * to cnstrc.com, per RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md and
 * this module's own doc (CONSTRUCTOR-IO-PRICE-LOOKUP.md). This client
 * only implements Constructor.io's own generic, documented, public
 * search request/response shape -- nothing retailer-specific lives
 * here. Constructor.io's documentation states plainly that its
 * search/browse/autocomplete endpoints are public and require no
 * authentication beyond a client key, and that key is meant to be
 * embedded in a site's own page JavaScript (the same key powering
 * that site's own search bar).
 *
 * What's genuinely confirmed (Constructor.io's own public API shape)
 * vs. what's retailer-specific and comes from third-party research,
 * not independently verified against a live response by this code,
 * is documented in CONSTRUCTOR-IO-PRICE-LOOKUP.md -- read that before
 * trusting a price from this path in a user-facing flow.
 */

export interface ConstructorIoSearchResult {
  /** Constructor.io's own product identifier for this result. */
  id: string | null;
  /** The result's display name/title. */
  value: string;
  /** Arbitrary per-item metadata the retailer's own catalogue feed
   *  populates -- this is where price fields live, under whatever
   *  keys that specific retailer's feed uses. Never assume a key
   *  exists without checking. */
  data: Record<string, unknown>;
}

export interface ConstructorIoSearchResponse {
  results: ConstructorIoSearchResult[];
  totalResults: number;
}

export interface ConstructorIoClientConfig {
  /** The retailer's own public Constructor.io client key -- found by
   *  inspecting network requests to cnstrc.com while using that
   *  retailer's own search bar. Public by design (Constructor.io's
   *  own docs confirm this), not a secret credential, but still
   *  retailer-specific and not something this code can supply a
   *  correct default for. */
  apiKey: string;
  /** Constructor.io's own service host. Stable across all customers
   *  of the platform -- this is not retailer-specific. */
  serviceUrl?: string;
}

const DEFAULT_SERVICE_URL = "https://ac.cnstrc.com";

export class ConstructorIoSearchClient {
  constructor(private readonly config: ConstructorIoClientConfig) {}

  async search(query: string, resultsPerPage = 30): Promise<ConstructorIoSearchResponse> {
    const serviceUrl = this.config.serviceUrl ?? DEFAULT_SERVICE_URL;
    const url = new URL(`${serviceUrl}/search/${encodeURIComponent(query)}`);
    url.searchParams.set("key", this.config.apiKey);
    url.searchParams.set("num_results_per_page", String(resultsPerPage));
    // c/_dt are Constructor.io's own client-version/cache-busting
    // params, sent by every real client -- included so this request
    // doesn't stand out as obviously not coming from a browser.
    url.searchParams.set("c", "bargainest-backend-1.0.0");
    url.searchParams.set("_dt", String(Date.now()));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BargaiNest price lookup)",
      },
    });

    if (!response.ok) {
      throw new Error(`CONSTRUCTOR_IO_REQUEST_FAILED:${response.status}`);
    }

    const body = (await response.json()) as {
      response?: { results?: unknown[]; total_num_results?: number };
    };

    const rawResults = body.response?.results ?? [];

    return {
      results: rawResults.map((raw) => normalizeResult(raw)),
      totalResults: body.response?.total_num_results ?? rawResults.length,
    };
  }
}

function normalizeResult(raw: unknown): ConstructorIoSearchResult {
  const record = (raw ?? {}) as Record<string, unknown>;
  const data = (record.data ?? {}) as Record<string, unknown>;

  return {
    id: typeof data.id === "string" ? data.id : null,
    value: typeof record.value === "string" ? record.value : "",
    data,
  };
}
