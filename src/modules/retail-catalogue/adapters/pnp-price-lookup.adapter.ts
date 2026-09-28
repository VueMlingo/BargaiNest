import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupContext,
  CataloguePriceLookupQuery,
} from "../retail-catalogue.price-lookup.types.js";

import type {
  RawCatalogueItem,
} from "../retail-catalogue.types.js";

const PNP_SEARCH_URL =
  "https://www.pnp.co.za/pnphybris/v2/pnp-spa/products/search";

const DEFAULT_PAGE_SIZE = 72;
const DEFAULT_TIMEOUT_MS = 15_000;

interface PnpProductResponse {
  code?: unknown;
  name?: unknown;
  brand?: unknown;
  price?: {
    value?: unknown;
    oldPrice?: unknown;
    currencyIso?: unknown;
    savings?: unknown;
    priceType?: unknown;
  };
  stock?: {
    stockLevelStatus?: unknown;
  };
  potentialPromotions?: unknown;
  quantityType?: unknown;
  defaultQuantityOfUom?: unknown;
  available?: unknown;
  inStockIndicator?: unknown;
  images?: Array<{
    url?: unknown;
  }>;
  [key: string]: unknown;
}

interface PnpSearchResponse {
  products?: unknown;
  [key: string]: unknown;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function mapAvailability(
  product: PnpProductResponse,
): NonNullable<RawCatalogueItem["availability"]> {
  const status = asString(product.stock?.stockLevelStatus)?.toUpperCase();

  if (
    product.available === false ||
    product.inStockIndicator === false ||
    status?.includes("OUTOFSTOCK") ||
    status?.includes("OUT_OF_STOCK")
  ) {
    return "OUT_OF_STOCK";
  }

  if (
    status?.includes("LIMITED") ||
    status?.includes("LOW")
  ) {
    return "LIMITED";
  }

  if (
    product.available === true ||
    product.inStockIndicator === true ||
    status?.includes("INSTOCK") ||
    status?.includes("IN_STOCK") ||
    status?.includes("AVAILABLE")
  ) {
    return "IN_STOCK";
  }

  return "UNKNOWN";
}

function hasValidPromotion(
  potentialPromotions: unknown,
): boolean {
  if (!Array.isArray(potentialPromotions)) {
    return false;
  }

  return potentialPromotions.some((promotion) => {
    if (!promotion || typeof promotion !== "object") {
      return false;
    }

    return (promotion as Record<string, unknown>).valid === true;
  });
}

function promotionText(
  product: PnpProductResponse,
): string | undefined {
  if (!Array.isArray(product.potentialPromotions)) {
    return undefined;
  }

  const texts = product.potentialPromotions
    .filter((promotion) => {
      if (!promotion || typeof promotion !== "object") {
        return false;
      }

      return (promotion as Record<string, unknown>).valid === true;
    })
    .map((promotion) => {
      if (!promotion || typeof promotion !== "object") {
        return undefined;
      }

      const value = promotion as Record<string, unknown>;

      return (
        asString(value.description) ??
        asString(value.name) ??
        asString(value.title) ??
        asString(value.message)
      );
    })
    .filter((value): value is string => Boolean(value));

  return texts.length > 0 ? texts.join("; ") : undefined;
}

function mapProduct(
  product: PnpProductResponse,
  sourceReference: string,
): RawCatalogueItem | null {
  const name = asString(product.name);
  const code = asString(product.code);

  if (!name || !code) {
    return null;
  }

  const price = asNumber(product.price?.value);
  const wasPrice = asNumber(product.price?.oldPrice);
  const savings = asNumber(product.price?.savings);
  const validPromotion = hasValidPromotion(
    product.potentialPromotions,
  );

  const isPromotion =
    validPromotion ||
    (wasPrice !== undefined &&
      price !== undefined &&
      wasPrice > price) ||
    (savings !== undefined && savings > 0);

  return {
    externalId: code,
    retailerSku: code,
    name,
    ...(() => {
      const brand = asString(product.brand);
      return brand ? { brand } : {};
    })(),
    ...(price !== undefined ? { price } : {}),
    ...(wasPrice !== undefined ? { wasPrice } : {}),
    currency:
      asString(product.price?.currencyIso) ?? "ZAR",
    isPromotion,
    ...(() => {
      const text = promotionText(product);
      return text ? { promotionText: text } : {};
    })(),
    availability: mapAvailability(product),
    sourceReference,
    extractionMethod: "WEB_PARSER",
    extractionConfidence: 0.95,
    rawData: {
      retailer: "PICK_N_PAY",
      code,
      name,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      potentialPromotions: product.potentialPromotions,
      quantityType: product.quantityType,
      defaultQuantityOfUom: product.defaultQuantityOfUom,
      available: product.available,
      inStockIndicator: product.inStockIndicator,
      images: product.images,
    },
  };
}

export class PnpPriceLookupAdapter
  implements CataloguePriceLookupAdapter
{
  readonly adapterKey = "PICK_N_PAY_LIVE_SEARCH";

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    fetchImpl: typeof fetch = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async lookup(
    context: CataloguePriceLookupContext,
    query: CataloguePriceLookupQuery,
  ): Promise<RawCatalogueItem[]> {
    const searchTerm = query.name?.trim();

    if (!searchTerm) {
      throw new Error("PICK_N_PAY_SEARCH_QUERY_MISSING");
    }

    const storeCode = context.storeCode?.trim();

    if (!storeCode) {
      throw new Error("PICK_N_PAY_STORE_CODE_MISSING");
    }

    const url = new URL(PNP_SEARCH_URL);

    url.searchParams.set("query", searchTerm);
    url.searchParams.set(
      "pageSize",
      String(DEFAULT_PAGE_SIZE),
    );
    url.searchParams.set("storeCode", storeCode);
    url.searchParams.set("lang", "en");
    url.searchParams.set("curr", "ZAR");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `PICK_N_PAY_SEARCH_HTTP_${response.status}`,
        );
      }

      const payload =
        (await response.json()) as PnpSearchResponse;

      if (!Array.isArray(payload.products)) {
        throw new Error(
          "PICK_N_PAY_SEARCH_RESPONSE_PRODUCTS_MISSING",
        );
      }

      return payload.products
        .filter(
          (product): product is PnpProductResponse =>
            Boolean(
              product &&
              typeof product === "object",
            ),
        )
        .map((product) =>
          mapProduct(product, url.toString()),
        )
        .filter(
          (item): item is RawCatalogueItem =>
            item !== null,
        );
    } finally {
      clearTimeout(timeout);
    }
  }
}
