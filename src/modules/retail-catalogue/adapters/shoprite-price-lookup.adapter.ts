import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupContext,
  CataloguePriceLookupQuery,
} from "../retail-catalogue.price-lookup.types.js";

import type {
  RawCatalogueItem,
} from "../retail-catalogue.types.js";

import {
  ShopritePublicationAdapter,
} from "./shoprite-publication.adapter.js";

import { matchesCatalogueQuery } from "../retail-catalogue.matching.util.js";

export class ShopritePriceLookupAdapter
  implements CataloguePriceLookupAdapter
{
  readonly adapterKey = "SHOPRITE_PUBLICATION";

  private readonly publicationAdapter: ShopritePublicationAdapter;

  constructor(
    fetchImpl: typeof fetch = fetch,
    timeoutMs = 15_000,
  ) {
    this.publicationAdapter =
      new ShopritePublicationAdapter(
        fetchImpl,
        timeoutMs,
      );
  }

  async lookup(
    context: CataloguePriceLookupContext,
    query: CataloguePriceLookupQuery,
  ): Promise<RawCatalogueItem[]> {
    const items =
      await this.publicationAdapter.discover(
        context,
      );

    return items.filter((item) =>
      matchesCatalogueQuery(item, query),
    );
  }
}
