import type {
  CatalogueChannel,
  CatalogueExtractionMethod,
} from "@prisma/client";

/**
 * Coarse stock status a retailer source may expose. Most current
 * sources (specials brochures, basic product pages) don't carry this
 * at all — UNKNOWN is the honest default, not an assumption of stock.
 */
export type CatalogueAvailabilityStatus =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "LIMITED"
  | "UNKNOWN";

/**
 * Raw item discovered by a retailer catalogue adapter.
 *
 * This represents retailer-published information only.
 * The catalogue pipeline must never invent a price.
 */
export interface RawCatalogueItem {
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

  currency?: string;

  isPromotion?: boolean;
  promotionText?: string;

  availability?: CatalogueAvailabilityStatus;

  validFrom?: Date;
  validUntil?: Date;

  sourceReference?: string;

  extractionMethod: CatalogueExtractionMethod;
  extractionConfidence?: number;

  rawData?: unknown;
}

/**
 * Normalised representation used by the matching layer.
 */
export interface NormalizedCatalogueItem {
  externalId: string | null;
  retailerSku: string | null;

  gtin: string | null;
  barcode: string | null;

  rawName: string;
  normalizedName: string;

  brand: string | null;
  packSize: string | null;
  unit: string | null;
  category: string | null;

  price: number | null;
  wasPrice: number | null;

  currency: string;

  isPromotion: boolean;
  promotionText: string | null;

  availability: CatalogueAvailabilityStatus;

  validFrom: Date | null;
  validUntil: Date | null;

  sourceReference: string | null;

  extractionMethod: CatalogueExtractionMethod;
  extractionConfidence: number | null;

  rawData: unknown | null;
}

/**
 * Context supplied to a catalogue adapter.
 */
export interface CatalogueSourceContext {
  catalogueSourceId: string;
  retailerId: string;

  channel: CatalogueChannel;
  sourceType: string;

  sourceUrl?: string;
  region?: string;
  countryCode?: string;
  province?: string;
  city?: string;
  storeCode?: string;
}

/**
 * A source adapter discovers retailer-published catalogue items.
 *
 * Adapters do not create Products and do not create PriceObservations.
 * Those responsibilities belong to the catalogue ingestion pipeline.
 */
export interface CatalogueAdapter {
  readonly adapterKey: string;

  discover(
    context: CatalogueSourceContext
  ): Promise<RawCatalogueItem[]>;
}

/**
 * Result of resolving a catalogue item against the BargaiNest
 * product foundation.
 */
export interface ProductResolution {
  productId: string | null;

  confidence: number;

  method:
    | "GTIN"
    | "BARCODE"
    | "RETAILER_SKU"
    | "EXACT_NAME"
    | "NORMALIZED_NAME"
    | "BRAND_NAME_SIZE"
    | "FUZZY"
    | "SEMANTIC"
    | "MANUAL";

  status: "PROPOSED" | "CONFIRMED" | "REJECTED";

  reason: string;
}
