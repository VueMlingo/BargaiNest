import type { RawCatalogueItem } from "../retail-catalogue.types.js";

/**
 * Generic parser for retailer "specials publication" pages that render
 * as a flattened block of text (common with digital flipbook/brochure
 * platforms — Shoprite's specials.shoprite.co.za is one example).
 *
 * This is a generalisation of the logic originally written only for
 * Shoprite (see shoprite-publication.parser.ts). It is deliberately
 * conservative: it extracts only (price, name) pairs it can find with
 * reasonable confidence and never invents a price.
 *
 * IMPORTANT: the container selector and validity-text phrasing are
 * retailer-specific and MUST be verified against that retailer's real
 * page before this parser is trusted in production. See
 * RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md.
 */

export interface FlattenedSpecialsParseOptions {
  /** Regex used to find the wrapping element with all page text.
   *  Falls back to the whole document if it doesn't match. */
  containerPattern?: RegExp;
  /** Phrase(s) that indicate a page/region restriction, e.g.
   *  "prices apply to <retailer> stores in ...". */
  regionPhrase?: RegExp;
  /** Currency code to stamp on every parsed item. */
  currency?: string;
  /** Confidence score to attach to parsed items (0-1). */
  confidence?: number;
}

export interface FlattenedSpecialsParseResult {
  title: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  region: string | null;
  countryCode: string;
  items: RawCatalogueItem[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;

  const match = value.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );

  if (!match) return null;

  const day = match[1];
  const month = match[2];
  const year = match[3];

  if (!day || !month || !year) return null;

  const monthIndex = MONTHS.indexOf(month.toLowerCase());
  if (monthIndex < 0) return null;

  return new Date(Date.UTC(Number(year), monthIndex, Number(day), 23, 59, 59, 999));
}

function parseValidity(text: string): { validFrom: Date | null; validUntil: Date | null } {
  const range = text.match(
    /valid\s+from\s+(?:\w+\s+)?(\d{1,2}\s+\w+)\s+until\s+(?:\w+\s+)?(\d{1,2}\s+\w+\s+(\d{4}))/i,
  );

  if (range) {
    const firstDate = range[1];
    const secondDate = range[2];
    const year = range[3];

    if (firstDate && secondDate && year) {
      return {
        validFrom: parseDate(firstDate + " " + year),
        validUntil: parseDate(secondDate),
      };
    }
  }

  return { validFrom: null, validUntil: null };
}

function extractRegion(text: string, regionPhrase?: RegExp): string | null {
  if (!regionPhrase) return null;
  const match = text.match(regionPhrase);
  const region = match?.[1]?.trim();
  return region || null;
}

function parsePriceToken(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/^R/i, "").replace(/\s/g, "");

  if (/^\d+\.\d{1,2}$/.test(normalized)) {
    const price = Number(normalized);
    return Number.isFinite(price) ? price : null;
  }

  // Some flipbook renderers flatten "R19.99" to "1999".
  if (/^\d{4}$/.test(normalized)) {
    const price = Number(normalized) / 100;
    if (price >= 1 && price <= 9999) {
      return price;
    }
  }

  return null;
}

const METADATA_PREFIXES =
  /^(save|prices|offers|valid|prices apply|customer care|vat included)/i;

function extractItems(
  text: string,
  sourceReference: string,
  validFrom: Date | null,
  validUntil: Date | null,
  currency: string,
  confidence: number,
): RawCatalogueItem[] {
  const items: RawCatalogueItem[] = [];

  const pattern =
    /(?:^|\s)(?:[A-Z0-9]{6,}\/[A-Z])?\s*(R?\d{1,4}(?:\.\d{1,2})?)\s+([A-Z][^.!?]{5,160}?)(?=\s+(?:R?\d{1,4}(?:\.\d{1,2})?)\s+|$)/g;

  for (const match of text.matchAll(pattern)) {
    const priceToken = match[1];
    const productName = match[2];

    if (!priceToken || !productName) continue;

    const trimmedProductName = productName.trim();
    const publicationYear = validFrom?.getUTCFullYear() ?? validUntil?.getUTCFullYear();

    const looksLikePublicationMetadata =
      METADATA_PREFIXES.test(trimmedProductName) ||
      /lower prices|prices you can trust|offers valid|valid from/i.test(trimmedProductName) ||
      /^[a-z0-9 ]*\bsavings\b/i.test(trimmedProductName) ||
      /^[A-Z0-9]{6,}\/[A-Z]$/.test(trimmedProductName);

    if (
      publicationYear !== undefined &&
      /^(19|20)\d{2}$/.test(priceToken) &&
      Number(priceToken) === publicationYear &&
      looksLikePublicationMetadata
    ) {
      continue;
    }

    const price = parsePriceToken(priceToken);
    const name = productName.replace(/\s+/g, " ").trim();

    if (price === null || !name) continue;
    if (METADATA_PREFIXES.test(name)) continue;

    items.push({
      name,
      currency,
      price,
      isPromotion: true,
      sourceReference,
      extractionMethod: "WEB_PARSER",
      extractionConfidence: confidence,
      ...(validFrom !== null && { validFrom }),
      ...(validUntil !== null && { validUntil }),
      rawData: {
        parser: "GENERIC_FLIPBOOK_SPECIALS_V1",
        matchedText: match[0].trim(),
      },
    });
  }

  return items;
}

export function parseFlattenedSpecialsPage(
  html: string,
  sourceReference: string,
  options: FlattenedSpecialsParseOptions = {},
): FlattenedSpecialsParseResult {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const containerMatch = options.containerPattern
    ? html.match(options.containerPattern)
    : null;

  const rawText = containerMatch?.[1] ?? html;
  const text = cleanText(rawText);

  const title = titleMatch?.[1] ? cleanText(titleMatch[1]) : null;

  const validity = parseValidity(text);
  const region = extractRegion(text, options.regionPhrase);

  const items = extractItems(
    text,
    sourceReference,
    validity.validFrom,
    validity.validUntil,
    options.currency ?? "ZAR",
    options.confidence ?? 0.75, // slightly lower default than Shoprite's tuned 0.8 until verified per-retailer
  );

  return {
    title,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    region,
    countryCode: "ZA",
    items,
  };
}
