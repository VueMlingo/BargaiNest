import type { RetailerSearchConfig } from "./retailer-search.config.js";

/**
 * All five retailer configs in one place. Every selector below is a
 * best-effort guess pending confirmation against real markup — see
 * RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md for the exact confidence
 * level per retailer and how to verify/fix each one. Do not treat
 * "code exists" as "code confirmed correct" for any of these.
 */

export const CHECKERS_CONFIG: RetailerSearchConfig = {
  retailerKey: "CHECKERS_LIVE_SEARCH",
  confidenceNote:
    "Product pages CONFIRMED server-rendered this session (real prices " +
    "fetched from raw HTML for two products). Search UI/selectors NOT " +
    "confirmed — guessed from common e-commerce search-page conventions.",
  productPagesConfirmedServerRendered: true,
  buildSearchUrl: (query) => `https://www.checkers.co.za/search?q=${encodeURIComponent(query)}`,
  resultCardSelector: '[data-testid="product-card"], .product-item, .product-tile',
  resultNameSelector: '[data-testid="product-name"], .product-name, .product-title',
  resultLinkSelector: 'a[href*="/product/"], a[href*="/p/"]',
  resultPriceSelector: '[data-testid="product-price"], .product-price, .price',
  maxResultsToConfirm: 5,
};

export const SHOPRITE_CONFIG: RetailerSearchConfig = {
  retailerKey: "SHOPRITE_LIVE_SEARCH",
  confidenceNote:
    "Same corporate group and (plausibly) same commerce platform as " +
    "Checkers, so INFERRED — not independently confirmed — that " +
    "shoprite.co.za product pages are also server-rendered. Verify with " +
    "the same curl check used for Checkers before trusting the fetch " +
    "path here. Search selectors are an unverified guess, same as " +
    "every other retailer in this file.",
  productPagesConfirmedServerRendered: true, // inferred by platform similarity, not independently confirmed — verify first
  buildSearchUrl: (query) => `https://www.shoprite.co.za/search?q=${encodeURIComponent(query)}`,
  resultCardSelector: '[data-testid="product-card"], .product-item, .product-tile',
  resultNameSelector: '[data-testid="product-name"], .product-name, .product-title',
  resultLinkSelector: 'a[href*="/product/"], a[href*="/p/"]',
  resultPriceSelector: '[data-testid="product-price"], .product-price, .price',
  maxResultsToConfirm: 5,
};

export const WOOLWORTHS_CONFIG: RetailerSearchConfig = {
  retailerKey: "WOOLWORTHS_LIVE_SEARCH",
  confidenceNote:
    "CONFIRMED this session that product pages have NO price in the " +
    "raw server response (fetched a real product page — full " +
    "breadcrumbs/description present, price absent) — genuinely needs " +
    "the headless renderer for both search AND per-product confirmation, " +
    "unlike Checkers. Category URLs follow /browse/... and /cat/_/N-xxx " +
    "patterns; search URL and all selectors below are unverified guesses.",
  productPagesConfirmedServerRendered: false,
  buildSearchUrl: (query) =>
    `https://www.woolworths.co.za/search?q=${encodeURIComponent(query)}`,
  resultCardSelector: ".product-list-item, [data-testid='product-card']",
  resultNameSelector: ".product-list-item__name, [data-testid='product-name']",
  resultLinkSelector: "a",
  resultPriceSelector: ".product-list-item__price, [data-testid='product-price']",
  maxResultsToConfirm: 5,
};

export const PICK_N_PAY_CONFIG: RetailerSearchConfig = {
  retailerKey: "PICK_N_PAY_LIVE_SEARCH",
  confidenceNote:
    "Not checked this session at all — neither a real product URL nor " +
    "server-rendering was confirmed or ruled out. Defaulting to " +
    "assuming a headless browser is needed (safer default than assuming " +
    "server-rendering with zero evidence). Search URL and selectors are " +
    "unverified guesses, most likely wrong.",
  productPagesConfirmedServerRendered: false,
  buildSearchUrl: (query) => `https://www.pnp.co.za/search?q=${encodeURIComponent(query)}`,
  resultCardSelector: ".product-tile, [data-testid='product-tile']",
  resultNameSelector: ".product-tile__name, [data-testid='product-name']",
  resultLinkSelector: "a",
  resultPriceSelector: ".product-tile__price, [data-testid='product-price']",
  maxResultsToConfirm: 5,
};

export const SPAR_CONFIG: RetailerSearchConfig = {
  retailerKey: "SPAR_LIVE_SEARCH",
  confidenceNote:
    "Not checked this session at all. SPAR is a franchise model — " +
    "online infrastructure may vary by region/store in ways the other " +
    "four don't, so even the domain below (spar2u.co.za, SPAR's " +
    "delivery service) is a guess at the right target, not a confirmed " +
    "one. Treat this config as the least trustworthy of the five.",
  productPagesConfirmedServerRendered: false,
  buildSearchUrl: (query) => `https://www.spar2u.co.za/search?q=${encodeURIComponent(query)}`,
  resultCardSelector: ".product-card, [data-testid='product-card']",
  resultNameSelector: ".product-card__name, [data-testid='product-name']",
  resultLinkSelector: "a",
  resultPriceSelector: ".product-card__price, [data-testid='product-price']",
  maxResultsToConfirm: 5,
};

export const ALL_RETAILER_CONFIGS: RetailerSearchConfig[] = [
  CHECKERS_CONFIG,
  SHOPRITE_CONFIG,
  WOOLWORTHS_CONFIG,
  PICK_N_PAY_CONFIG,
  SPAR_CONFIG,
];
