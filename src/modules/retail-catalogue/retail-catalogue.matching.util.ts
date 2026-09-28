/**
 * Shared text-normalisation and matching helpers used across catalogue
 * price-lookup and offer-matching adapters.
 *
 * Previously this logic was duplicated verbatim in
 * shoprite-price-lookup.adapter.ts and retailer-offer.service.ts.
 * Extracted here so every retailer adapter (and any future one) shares
 * one tested implementation instead of copy-pasting it per retailer.
 */

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenise(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter(Boolean),
  );
}

export function tokenOverlap(
  left: Set<string>,
  right: Set<string>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of left) {
    if (right.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(left.size, right.size);
}

/**
 * Generic minimal shape a raw catalogue item and a lookup query must
 * satisfy to be matched. Kept structural (not imported from
 * retail-catalogue.types.ts) so this util has no circular dependency
 * on the wider catalogue types.
 */
export interface MatchableCatalogueItem {
  gtin?: string;
  barcode?: string;
  retailerSku?: string;
  name: string;
  brand?: string;
  packSize?: string;
  unit?: string;
}

export interface MatchableCatalogueQuery {
  gtin?: string;
  barcode?: string;
  retailerSku?: string;
  name?: string;
  brand?: string;
  packSize?: string;
  unit?: string;
}

/**
 * Shared retailer-agnostic matching rule used by every price-lookup
 * adapter: identifier match wins outright; otherwise fall back to
 * name-token overlap with attribute-level disagreement rejecting
 * the candidate. Any retailer plugging into
 * CataloguePriceLookupRegistry should reuse this rather than writing
 * its own copy, so match behaviour stays consistent across retailers.
 */
export function matchesCatalogueQuery(
  item: MatchableCatalogueItem,
  query: MatchableCatalogueQuery,
): boolean {
  if (
    query.gtin &&
    item.gtin &&
    normalizeText(item.gtin) === normalizeText(query.gtin)
  ) {
    return true;
  }

  if (
    query.barcode &&
    item.barcode &&
    normalizeText(item.barcode) === normalizeText(query.barcode)
  ) {
    return true;
  }

  if (
    query.retailerSku &&
    item.retailerSku &&
    normalizeText(item.retailerSku) === normalizeText(query.retailerSku)
  ) {
    return true;
  }

  const queryName = query.name?.trim();

  if (!queryName) {
    return true;
  }

  const nameScore = tokenOverlap(
    tokenise(queryName),
    tokenise(item.name),
  );

  if (nameScore === 0) {
    return false;
  }

  if (
    query.brand &&
    item.brand &&
    normalizeText(item.brand) !== normalizeText(query.brand)
  ) {
    return false;
  }

  if (
    query.packSize &&
    item.packSize &&
    normalizeText(item.packSize) !== normalizeText(query.packSize)
  ) {
    return false;
  }

  if (
    query.unit &&
    item.unit &&
    normalizeText(item.unit) !== normalizeText(query.unit)
  ) {
    return false;
  }

  return nameScore >= 0.25;
}
