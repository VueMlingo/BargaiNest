import type {
  CatalogueAdapter,
  CatalogueSourceContext,
  RawCatalogueItem,
} from "../retail-catalogue.types.js";

/**
 * Shoprite published specials adapter.
 *
 * IMPORTANT:
 * - This adapter does not invent products or prices.
 * - It consumes retailer-published catalogue content.
 * - It intentionally returns only data that has been explicitly extracted.
 *
 * The initial implementation supports a controlled text/HTML payload.
 * The source-fetch/parsing layer can later be replaced or extended for
 * the retailer's actual publication format without changing ingestion.
 */

export interface ShopriteSpecialsPayload {
  sourceReference: string;

  validFrom?: Date;
  validUntil?: Date;

  items: Array<{
    externalId?: string;
    retailerSku?: string;

    gtin?: string;
    barcode?: string;

    name: string;
    brand?: string;
    packSize?: string;
    unit?: string;
    category?: string;

    price?: number;
    wasPrice?: number;

    promotionText?: string;

    rawData?: unknown;
  }>;
}

export function parseShopriteSpecialsPayload(
  payload: ShopriteSpecialsPayload
): RawCatalogueItem[] {
  return payload.items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      name: item.name,
      currency: "ZAR",
      isPromotion: true,
      sourceReference: payload.sourceReference,
      extractionMethod: "PDF_TEXT",
      extractionConfidence: 0.95,

      ...(item.externalId !== undefined && {
        externalId: item.externalId,
      }),
      ...(item.retailerSku !== undefined && {
        retailerSku: item.retailerSku,
      }),
      ...(item.gtin !== undefined && {
        gtin: item.gtin,
      }),
      ...(item.barcode !== undefined && {
        barcode: item.barcode,
      }),
      ...(item.brand !== undefined && {
        brand: item.brand,
      }),
      ...(item.packSize !== undefined && {
        packSize: item.packSize,
      }),
      ...(item.unit !== undefined && {
        unit: item.unit,
      }),
      ...(item.category !== undefined && {
        category: item.category,
      }),
      ...(item.price !== undefined && {
        price: item.price,
      }),
      ...(item.wasPrice !== undefined && {
        wasPrice: item.wasPrice,
      }),
      ...(item.promotionText !== undefined && {
        promotionText: item.promotionText,
      }),
      ...(payload.validFrom !== undefined && {
        validFrom: payload.validFrom,
      }),
      ...(payload.validUntil !== undefined && {
        validUntil: payload.validUntil,
      }),
      ...(item.rawData !== undefined && {
        rawData: item.rawData,
      }),
    }));
}

export class ShopriteSpecialsAdapter implements CatalogueAdapter {
  readonly adapterKey = "SHOPRITE_SPECIALS";

  constructor(
    private readonly payloadProvider: (
      context: CatalogueSourceContext
    ) => Promise<ShopriteSpecialsPayload>
  ) {}

  async discover(
    context: CatalogueSourceContext
  ): Promise<RawCatalogueItem[]> {
    const payload = await this.payloadProvider(context);

    return parseShopriteSpecialsPayload(payload);
  }
}
