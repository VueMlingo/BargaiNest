import type {
  NormalizedCatalogueItem,
  RawCatalogueItem,
} from "./retail-catalogue.types.js";
import { extractPackSize } from "../shopping-intent/pack-size.util.js";

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

    /*
     * BN-029/031: Pick n Pay's Hybris adapter and Woolworths'
     * Constructor.io adapter never populate a structured packSize at
     * all (confirmed directly in both adapters' source) -- only the
     * raw product name, which usually has the size embedded in free
     * text ("Clover Fresh Milk 2L"). Falling back to extracting it
     * from rawName here, using the exact same logic that parses the
     * user's own shopping-list text (shopping-intent.service.ts, via
     * this shared util), is what makes retailer-offer.service.ts's
     * pack-size matching actually able to match these retailers at
     * all once the user's request has an explicit size -- without
     * this, every offer from these two retailers was a guaranteed
     * "weak match" rejection whenever that was the case, regardless
     * of whether the product itself was otherwise correct.
     */
    packSize:
      item.packSize?.trim() || extractPackSize(rawName),

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
