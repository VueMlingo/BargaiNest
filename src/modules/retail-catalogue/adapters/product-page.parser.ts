import type { RawCatalogueItem } from "../retail-catalogue.types.js";

/**
 * Retailer-agnostic current-price extraction from a single rendered
 * product page — either the raw HTML from a plain fetch (if the page
 * is server-rendered) or the post-render HTML from a headless browser
 * (if it isn't). The extraction logic doesn't care which; it just
 * needs HTML with the price actually present in it somewhere.
 *
 * Strategy, in priority order:
 *   1. JSON-LD structured data (schema.org Product/Offer) — the
 *      standard way e-commerce sites expose price for SEO. Stable
 *      across visual redesigns, high confidence when present.
 *   2. Conservative text-pattern fallback — low confidence, a
 *      starting point until confirmed against real markup per
 *      retailer.
 *
 * Originally written for Checkers only (checkers-product-page.adapter.ts
 * in an earlier revision); generalized here so all five retailers use
 * the same tested extraction logic instead of five near-identical
 * copies.
 */

export type ProductPageExtractionTier = "JSON_LD" | "TEXT_FALLBACK" | "NOT_FOUND";

export interface ProductPageParseResult {
  item: RawCatalogueItem | null;
  extractionTier: ProductPageExtractionTier;
}

interface ParsedJsonLdOffer {
  price?: number;
  priceCurrency?: string;
  availability?: string;
}

interface ParsedJsonLdProduct {
  name?: string;
  brand?: { name?: string } | string;
  sku?: string;
  gtin13?: string;
  gtin?: string;
  offers?: ParsedJsonLdOffer | ParsedJsonLdOffer[];
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw.trim()));
    } catch {
      // A page can carry multiple JSON-LD blocks (breadcrumbs, org
      // info, etc.) — skip malformed ones rather than throw.
    }
  }

  return blocks;
}

function findProductNode(blocks: unknown[]): ParsedJsonLdProduct | null {
  for (const block of blocks) {
    const candidates = Array.isArray(block) ? block : [block];

    for (const candidate of candidates) {
      if (
        candidate &&
        typeof candidate === "object" &&
        "@type" in candidate &&
        (candidate as { "@type": unknown })["@type"] === "Product"
      ) {
        return candidate as ParsedJsonLdProduct;
      }

      if (
        candidate &&
        typeof candidate === "object" &&
        "@graph" in candidate &&
        Array.isArray((candidate as { "@graph": unknown[] })["@graph"])
      ) {
        const graph = (candidate as { "@graph": unknown[] })["@graph"];
        const found = graph.find(
          (node) =>
            node &&
            typeof node === "object" &&
            (node as { "@type"?: unknown })["@type"] === "Product",
        );
        if (found) return found as ParsedJsonLdProduct;
      }
    }
  }

  return null;
}

function firstOffer(offers: ParsedJsonLdProduct["offers"]): ParsedJsonLdOffer | null {
  if (!offers) return null;
  return Array.isArray(offers) ? (offers[0] ?? null) : offers;
}

function extractViaJsonLd(html: string, sourceReference: string): RawCatalogueItem | null {
  const blocks = extractJsonLdBlocks(html);
  const product = findProductNode(blocks);
  if (!product || !product.name) return null;

  const offer = firstOffer(product.offers);
  const price = offer?.price;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;

  const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;

  return {
    name: product.name,
    ...(brand ? { brand } : {}),
    ...(product.sku ? { retailerSku: product.sku } : {}),
    ...(product.gtin13
      ? { gtin: product.gtin13 }
      : product.gtin
        ? { gtin: product.gtin }
        : {}),
    price,
    currency: offer?.priceCurrency ?? "ZAR",
    isPromotion: false,
    sourceReference,
    extractionMethod: "STRUCTURED",
    extractionConfidence: 0.95,
    rawData: { parser: "PRODUCT_PAGE_JSON_LD_V1", product },
  };
}

/**
 * ⚠️ Retailer-agnostic, but each retailer's real markup is UNVERIFIED
 * against this. Deliberately low confidence (0.4) so downstream
 * consumers (e.g. Best Basket Savings) can choose to exclude
 * fallback-tier prices from confident calculations until a retailer's
 * specific pattern has been confirmed and tightened.
 */
function extractViaTextFallback(html: string, sourceReference: string): RawCatalogueItem | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const priceLineIndex = text.findIndex((line) => /^R\s?\d{1,4}(?:[.,]\d{2})?$/.test(line));
  if (priceLineIndex === -1) return null;

  const priceLine = text[priceLineIndex];
  const price = priceLine ? Number(priceLine.replace(/^R\s?/, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(price)) return null;

  const name = text.slice(0, priceLineIndex).find((line) => line.length > 3) ?? null;
  if (!name) return null;

  return {
    name,
    price,
    currency: "ZAR",
    isPromotion: false,
    sourceReference,
    extractionMethod: "WEB_PARSER",
    extractionConfidence: 0.4,
    rawData: { parser: "PRODUCT_PAGE_TEXT_FALLBACK_V1_UNVERIFIED" },
  };
}

export function parseProductPage(html: string, sourceReference: string): ProductPageParseResult {
  const viaJsonLd = extractViaJsonLd(html, sourceReference);
  if (viaJsonLd) {
    return { item: viaJsonLd, extractionTier: "JSON_LD" };
  }

  const viaText = extractViaTextFallback(html, sourceReference);
  if (viaText) {
    return { item: viaText, extractionTier: "TEXT_FALLBACK" };
  }

  return { item: null, extractionTier: "NOT_FOUND" };
}
