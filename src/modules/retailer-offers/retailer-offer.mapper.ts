import type {
  CataloguePriceLookupMatch,
} from "../retail-catalogue/retail-catalogue.price-lookup.service.js";

import {
  normalizeCatalogueItem,
} from "../retail-catalogue/retail-catalogue.normalizer.js";

import type {
  RetailerOffer,
} from "./retailer-offer.types.js";

function toIsoDate(value: Date | null): string | null {
  return value instanceof Date
    ? value.toISOString()
    : null;
}

export function mapCatalogueMatchToRetailerOffer(
  match: CataloguePriceLookupMatch,
): RetailerOffer | null {
  const item =
    normalizeCatalogueItem(match.item);

  if (
    item.price === null ||
    !Number.isFinite(item.price) ||
    item.price < 0
  ) {
    return null;
  }

  const confidence =
    item.extractionConfidence ?? 0;

  if (
    !Number.isFinite(confidence) ||
    confidence <= 0
  ) {
    return null;
  }

  return {
    retailer: {
      id: match.source.retailerId,
      code: match.source.retailerCode,
      name: match.source.retailerName,
    },

    name: item.rawName,

    brand: item.brand,
    packSize: item.packSize,
    unit: item.unit,
    category: item.category,

    price: item.price,
    currency: item.currency,

    wasPrice: item.wasPrice,

    isPromotion: item.isPromotion,
    promotionText: item.promotionText,

    validFrom: toIsoDate(item.validFrom),
    validUntil: toIsoDate(item.validUntil),

    // Previously dropped entirely -- item.availability was already
    // computed by normalizeCatalogueItem() on every call, just never
    // read here.
    availability: item.availability ?? "UNKNOWN",

    source: {
      type:
        match.source.sourceType === "API"
          ? "API"
          : "PUBLIC",
      adapterKey:
        match.source.adapterKey ??
        "UNKNOWN",
      url: match.source.sourceUrl,
      observedAt: new Date().toISOString(),
    },

    confidence,
  };
}

export function mapCatalogueMatchesToRetailerOffers(
  matches: CataloguePriceLookupMatch[],
): RetailerOffer[] {
  return matches
    .map(mapCatalogueMatchToRetailerOffer)
    .filter(
      (offer): offer is RetailerOffer =>
        offer !== null,
    );
}
