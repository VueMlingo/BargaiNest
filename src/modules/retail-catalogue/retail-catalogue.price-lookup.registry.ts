import type {
  CataloguePriceLookupAdapter,
} from "./retail-catalogue.price-lookup.types.js";

export type CataloguePriceLookupAdapterFactory =
  () => CataloguePriceLookupAdapter;

export class CataloguePriceLookupRegistry {
  private readonly factories =
    new Map<
      string,
      CataloguePriceLookupAdapterFactory
    >();

  constructor(
    factories: Record<
      string,
      CataloguePriceLookupAdapterFactory
    > = {}
  ) {
    for (const [key, factory] of Object.entries(factories)) {
      this.register(key, factory);
    }
  }

  register(
    adapterKey: string,
    factory: CataloguePriceLookupAdapterFactory
  ): void {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error(
        "CATALOGUE_PRICE_LOOKUP_ADAPTER_KEY_MISSING"
      );
    }

    if (this.factories.has(key)) {
      throw new Error(
        `CATALOGUE_PRICE_LOOKUP_ADAPTER_ALREADY_REGISTERED:${key}`
      );
    }

    this.factories.set(key, factory);
  }

  has(adapterKey: string): boolean {
    return this.factories.has(adapterKey.trim());
  }

  resolve(
    adapterKey: string
  ): CataloguePriceLookupAdapter {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error(
        "CATALOGUE_PRICE_LOOKUP_ADAPTER_KEY_MISSING"
      );
    }

    const factory = this.factories.get(key);

    if (!factory) {
      throw new Error(
        `CATALOGUE_PRICE_LOOKUP_ADAPTER_NOT_FOUND:${key}`
      );
    }

    const adapter = factory();

    if (!adapter) {
      throw new Error(
        `CATALOGUE_PRICE_LOOKUP_ADAPTER_FACTORY_FAILED:${key}`
      );
    }

    if (adapter.adapterKey !== key) {
      throw new Error(
        `CATALOGUE_PRICE_LOOKUP_ADAPTER_KEY_MISMATCH:${key}`
      );
    }

    return adapter;
  }
}
