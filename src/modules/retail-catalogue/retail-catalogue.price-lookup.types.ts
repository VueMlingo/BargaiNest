import type {
  RawCatalogueItem,
  CatalogueSourceContext,
} from "./retail-catalogue.types.js";

/**
 * Identifies the product/retailer item whose current price
 * BargaiNest wants to retrieve.
 *
 * Multiple identifiers may be supplied. The retailer adapter
 * decides which identifiers it can use.
 */
export interface CataloguePriceLookupQuery {
  gtin?: string;
  barcode?: string;
  retailerSku?: string;

  name?: string;
  brand?: string;
  packSize?: string;
  unit?: string;

  /**
   * The shopper's own South African province, when known (e.g.
   * resolved from their delivery address/postal code by the
   * frontend's location service). Optional and adapter-agnostic --
   * most adapters ignore it entirely. Confirmed necessary for
   * Woolworths, whose Constructor.io response prices every product
   * for three real geographic zones at once (see
   * CONSTRUCTOR-IO-PRICE-LOOKUP.md) -- without a province, an
   * adapter falls back to whatever its own configured default is.
   */
  province?: string;

  /**
   * A specific retailer store identifier, when known -- e.g. Pick n
   * Pay's own store codes ("WC21"), confirmed live to be accepted
   * directly by their search API and to return that specific store's
   * real price. Deliberately kept separate from `province`: a store
   * code identifies one specific store, not a broad region, and the
   * two concepts shouldn't be conflated even though both describe
   * "where is this shopper." See PNP-HYBRIS-PRICE-LOOKUP.md.
   */
  storeCode?: string;
}

/**
 * Context supplied to a current-price lookup adapter.
 *
 * The source context identifies the specific retailer-published
 * source being queried.
 */
export interface CataloguePriceLookupContext
  extends CatalogueSourceContext {}

/**
 * A retailer/source adapter capable of current-price lookup.
 *
 * The adapter returns retailer-published observations only.
 * It must never invent or estimate a price.
 *
 * Multiple results are allowed because a source may return
 * several candidate records for the same query.
 */
export interface CataloguePriceLookupAdapter {
  readonly adapterKey: string;

  lookup(
    context: CataloguePriceLookupContext,
    query: CataloguePriceLookupQuery,
  ): Promise<RawCatalogueItem[]>;
}
