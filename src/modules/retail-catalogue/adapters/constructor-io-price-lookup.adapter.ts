import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupContext,
  CataloguePriceLookupQuery,
} from "../retail-catalogue.price-lookup.types.js";
import type { RawCatalogueItem } from "../retail-catalogue.types.js";
import {
  ConstructorIoSearchClient,
  type ConstructorIoSearchResult,
} from "./constructor-io-search.client.js";

/**
 * Extracts price from a Constructor.io result's per-item `data`
 * object, and reports how confident that extraction is. Two
 * retailers on the same platform can (and here, do) use completely
 * different field names, because that per-item data comes from each
 * retailer's own catalogue feed into Constructor.io, not from
 * Constructor.io itself.
 */
export interface PriceExtractor {
  extractPrice(
    data: Record<string, unknown>,
    query?: CataloguePriceLookupQuery,
  ): {
    price: number | null;
    wasPrice: number | null;
    isPromotion: boolean;
    promotionText: string | null;
  };
  /** True if this result belongs to the department this lookup cares
   *  about (e.g. food) -- some retailers' Constructor.io index mixes
   *  departments (Woolworths: food, clothing, and beauty all in one
   *  index), so a search for a grocery item can otherwise return a
   *  completely unrelated product. */
  isRelevantDepartment(data: Record<string, unknown>): boolean;
}

/**
 * Pick n Pay's field names. `priceValue`/`priceConditionType`/
 * `promotionDisplayType`/`oldPriceValue` are CONFIRMED against a real
 * live response (2026-09-21, key found via the site's own search bar,
 * query "milk") -- not third-party research for this retailer. See
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md for the full response that confirmed
 * this and the real bug it caught in an earlier version of this logic.
 */
export const PICK_N_PAY_PRICE_EXTRACTOR: PriceExtractor = {
  extractPrice(data) {
    const price = toNumber(data.priceValue);
    // CORRECTED after seeing a real response: priceConditionType is
    // "PROMOTION" on almost every result, including ones with no
    // discount at all -- it is NOT a usable promotion flag by itself.
    // Only promotionDisplayType (e.g. "SMART_SHOPPER") or
    // promotionBadgeDisplay being genuinely present indicates a real
    // loyalty promotion. oldPriceValue is a real, confirmed field --
    // used as wasPrice only when an actual promotion is detected.
    const hasRealPromotion =
      typeof data.promotionDisplayType === "string" || typeof data.promotionBadgeDisplay === "string";
    const wasPrice = hasRealPromotion ? toNumber(data.oldPriceValue) : null;
    const promotionText =
      hasRealPromotion &&
      (typeof data.promotionTextMessage === "string" || typeof data.promotionBadgeDisplay === "string")
        ? String(data.promotionTextMessage ?? data.promotionBadgeDisplay)
        : null;

    return {
      price,
      wasPrice,
      isPromotion: hasRealPromotion,
      promotionText,
    };
  },
  isRelevantDepartment() {
    // Not reported as a mixed-department index anywhere in the
    // source research (unlike Woolworths) -- no filter applied
    // unless/until real data shows otherwise.
    return true;
  },
};

/**
 * A SEPARATE, real problem confirmed by the same live response, not
 * previously known from the third-party research this was built
 * from: the exact same product can carry several DIFFERENT real
 * prices at once, each tagged with which specific stores it applies
 * to (Constructor.io's `variations[]` array, each with its own
 * `availability` facet listing store codes) -- a real "milk" search
 * returned 99.99, 94.99, 97.99, and 104.99 for the identical product,
 * varying by store. This is Pick n Pay's own version of the same
 * problem Woolworths has with p10/p30/p60, just shaped as a list of
 * store-tagged variants instead of three fixed fields.
 *
 * The top-level `data.priceValue` this extractor reads is just
 * whichever variation Constructor.io happens to place first --
 * NOT necessarily what a specific shopper actually pays at their own
 * store. This is not yet resolved; see CONSTRUCTOR-IO-PRICE-LOOKUP.md.
 */

/**
 * Maps a South African province name to the Woolworths Constructor.io
 * zone that serves it.
 *
 * ONLY these three provinces are confirmed -- by directly comparing
 * real displayed prices at real delivery addresses in each against
 * the API's own values, cross-validated across two products (see
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md for the full evidence). The other
 * six South African provinces (Eastern Cape, Free State, Limpopo,
 * Mpumalanga, North West, Northern Cape) are deliberately NOT guessed
 * at here -- grouping them onto one of the three known zones by
 * assumed logistics/distribution proximity would be a plausible
 * story, not a confirmed fact, and presenting a guess as a mapping
 * risks a shopper in an unconfirmed province being shown a
 * confidently-wrong price instead of an honestly-uncertain one.
 * Unrecognised or unknown provinces fall back to `fallbackZone`
 * (the adapter's own configured default) instead.
 *
 * Matching is case-insensitive and tolerant of common variants
 * ("KZN", "Western Cape", "western-cape") but requires a real,
 * recognisable province name or code -- it does not attempt to
 * geocode a raw address or postal code itself. That resolution (e.g.
 * turning a delivery address or postal code into a province name) is
 * expected to happen upstream, in the location service mentioned in
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md, before this function is called.
 */
export function resolveWoolworthsZoneFromProvince(
  province: string | undefined,
  fallbackZone: "p10" | "p30" | "p60",
): "p10" | "p30" | "p60" {
  if (!province) return fallbackZone;

  const normalised = province.trim().toLowerCase().replace(/[\s_-]+/g, " ");

  if (normalised === "western cape" || normalised === "wc") {
    return "p10";
  }

  if (normalised === "gauteng" || normalised === "gp") {
    return "p30";
  }

  if (
    normalised === "kwazulu natal" ||
    normalised === "kwazulu-natal" ||
    normalised === "kzn"
  ) {
    return "p60";
  }

  // Deliberately not guessed -- see the doc comment above.
  return fallbackZone;
}

/**
 * Woolworths' field names, per the same third-party research, except
 * the price-zone mapping below which is now CONFIRMED by this
 * project against real data.
 *
 * p10/p30/p60 are real geographic pricing zones -- confirmed
 * 2026-09-21 by comparing actual displayed prices at three different
 * real delivery addresses against the API's own values, across two
 * different products to cross-validate the result: p10 = Western
 * Cape, p30 = Gauteng, p60 = KwaZulu-Natal.
 *
 * `defaultZone` is used only when no province is supplied on a given
 * lookup call (via `query.province`) -- when a province IS supplied,
 * this extractor resolves the real zone for that specific shopper on
 * every call, rather than using one fixed zone for every user. See
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md for the full picture, including why
 * per-user resolution -- not a better global default -- is the actual
 * fix here.
 */
export function makeWoolworthsPriceExtractor(defaultZone: "p10" | "p30" | "p60"): PriceExtractor {
  return {
    extractPrice(data, query) {
      const zoneKey = resolveWoolworthsZoneFromProvince(query?.province, defaultZone);
      const wasPriceKey = `${zoneKey}_wp`;

      const regularPrice = toNumber(data[zoneKey]);
      const wasPriceRaw = toNumber(data[wasPriceKey]);
      // The research found `p*_wp` is 0 on products the site itself
      // flags as promoted, i.e. it is NOT the loyalty/promo price --
      // so it's never treated as one here either.
      const wasPrice = wasPriceRaw && wasPriceRaw > 0 ? wasPriceRaw : null;

      const promoText = typeof data.promo === "string" ? data.promo : Array.isArray(data.promo) ? data.promo.filter((entry): entry is string => typeof entry === "string").join(" ") : null;
      const loyaltyPrice = promoText ? parseLoyaltyPriceFromPromoText(promoText, regularPrice) : null;

      return {
        price: loyaltyPrice ?? regularPrice,
        wasPrice: loyaltyPrice ? regularPrice : wasPrice,
        isPromotion: loyaltyPrice !== null,
        promotionText: promoText,
      };
    },
    isRelevantDepartment(data) {
      // Confirmed in the source research: a query like "socks"
      // returns hundreds of results, all with prodtype "Clothing" --
      // Woolworths' Constructor.io index mixes food with clothing and
      // beauty. `prodtype` is on every product but isn't one of the
      // facets the response advertises, so this is a client-side
      // filter, not something Constructor.io itself can be asked to
      // do via a filter parameter.
      const prodtype = typeof data.prodtype === "string" ? data.prodtype.toLowerCase() : "";
      return prodtype === "" || prodtype.includes("food") || prodtype.includes("grocery");
    },
  };
}

/**
 * Parses a loyalty/promo price out of marketing copy, e.g.
 * "Now R99.99 Save R27" against a regular price of 126.99 --
 * confirmed by the source research's own approach: 126.99 - 27 =
 * 99.99, so the "Now" price is corroborated by arithmetic rather than
 * trusted on its own. A reworded string, or one that doesn't check
 * out arithmetically, yields null -- an unparseable promo is treated
 * as "no loyalty price", never as a guess.
 */
function parseLoyaltyPriceFromPromoText(promoText: string, regularPrice: number | null): number | null {
  const nowMatch = promoText.match(/now\s*r?\s*(\d+(?:[.,]\d{1,2})?)/i);
  const saveMatch = promoText.match(/save\s*r?\s*(\d+(?:[.,]\d{1,2})?)/i);

  if (!nowMatch) return null;

  const nowPrice = Number(nowMatch[1]!.replace(",", "."));
  if (!Number.isFinite(nowPrice) || nowPrice <= 0) return null;

  if (regularPrice === null) {
    // Nothing to corroborate against -- still refuse rather than
    // trust the parsed value alone, matching "never invent a price".
    return null;
  }

  // A parsed value that isn't actually below the regular price is
  // refused outright, per the source research's own rule.
  if (nowPrice >= regularPrice) return null;

  if (saveMatch) {
    const savedAmount = Number(saveMatch[1]!.replace(",", "."));
    if (Number.isFinite(savedAmount)) {
      const expected = regularPrice - savedAmount;
      // Allow a cent of rounding slack, not an exact-to-the-cent match.
      if (Math.abs(expected - nowPrice) > 0.01) {
        return null;
      }
    }
  }

  return nowPrice;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export interface ConstructorIoPriceLookupConfig {
  adapterKey: string;
  apiKey: string;
  extractor: PriceExtractor;
  /** Override Constructor.io's shared default host -- required for
   *  Woolworths, which uses its own dedicated tenant subdomain rather
   *  than the shared ac.cnstrc.com host (confirmed live 2026-09-21). */
  serviceUrl?: string;
}

export class ConstructorIoPriceLookupAdapter implements CataloguePriceLookupAdapter {
  readonly adapterKey: string;
  private readonly client: ConstructorIoSearchClient;
  private readonly extractor: PriceExtractor;

  constructor(config: ConstructorIoPriceLookupConfig) {
    this.adapterKey = config.adapterKey;
    this.client = new ConstructorIoSearchClient({
      apiKey: config.apiKey,
      ...(config.serviceUrl ? { serviceUrl: config.serviceUrl } : {}),
    });
    this.extractor = config.extractor;
  }

  async lookup(
    _context: CataloguePriceLookupContext,
    query: CataloguePriceLookupQuery,
  ): Promise<RawCatalogueItem[]> {
    const searchText = query.name;
    if (!searchText) return [];

    const response = await this.client.search(searchText);

    const items: RawCatalogueItem[] = [];
    for (const result of response.results) {
      if (!this.extractor.isRelevantDepartment(result.data)) continue;

      const extracted = this.extractor.extractPrice(result.data, query);
      if (extracted.price === null) continue;

      items.push(toRawCatalogueItem(result, extracted));
    }

    return items;
  }
}

function toRawCatalogueItem(
  result: ConstructorIoSearchResult,
  extracted: ReturnType<PriceExtractor["extractPrice"]>,
): RawCatalogueItem {
  return {
    ...(result.id !== null ? { externalId: result.id } : {}),
    name: result.value,
    ...(extracted.price !== null ? { price: extracted.price } : {}),
    ...(extracted.wasPrice !== null ? { wasPrice: extracted.wasPrice } : {}),
    currency: "ZAR",
    isPromotion: extracted.isPromotion,
    ...(extracted.promotionText !== null ? { promotionText: extracted.promotionText } : {}),
    // Confirmed as an "API" extraction (structured JSON from a real
    // search-as-a-service response), not WEB_PARSER -- this is not
    // HTML scraping.
    extractionMethod: "API" as RawCatalogueItem["extractionMethod"],
    extractionConfidence: 0.95,
    rawData: result.data,
  };
}
