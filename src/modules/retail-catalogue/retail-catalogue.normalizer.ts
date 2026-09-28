import type {
  NormalizedCatalogueItem,
  RawCatalogueItem,
} from "./retail-catalogue.types.js";

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentifier(
  value: string | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").trim();

  return normalized || null;
}

function normalizeCurrency(
  value: string | undefined
): string {
  const currency = value?.trim().toUpperCase();

  return currency && currency.length === 3
    ? currency
    : "ZAR";
}

function normalizeMoney(
  value: number | undefined
): number | null {
  if (value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function normalizeConfidence(
  value: number | undefined
): number | null {
  if (value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(1, Math.max(0, value));
}

export function normalizeCatalogueItem(
  item: RawCatalogueItem
): NormalizedCatalogueItem {
  const rawName = item.name.trim();

  if (!rawName) {
    throw new Error(
      "CATALOGUE_ITEM_NAME_REQUIRED"
    );
  }

  return {
    externalId:
      item.externalId?.trim() || null,

    retailerSku:
      normalizeIdentifier(item.retailerSku),

    gtin:
      normalizeIdentifier(item.gtin),

    barcode:
      normalizeIdentifier(item.barcode),

    rawName,

    normalizedName:
      normalizeText(rawName),

    brand:
      item.brand?.trim() || null,

    packSize:
      item.packSize?.trim() || null,

    unit:
      item.unit?.trim() || null,

    category:
      item.category?.trim() || null,

    price:
      normalizeMoney(item.price),

    wasPrice:
      normalizeMoney(item.wasPrice),

    currency:
      normalizeCurrency(item.currency),

    isPromotion:
      item.isPromotion === true,

    promotionText:
      item.promotionText?.trim() || null,

    availability:
      item.availability ?? "UNKNOWN",

    validFrom:
      item.validFrom ?? null,

    validUntil:
      item.validUntil ?? null,

    sourceReference:
      item.sourceReference?.trim() || null,

    extractionMethod:
      item.extractionMethod,

    extractionConfidence:
      normalizeConfidence(
        item.extractionConfidence
      ),

    rawData:
      item.rawData ?? null,
  };
}
