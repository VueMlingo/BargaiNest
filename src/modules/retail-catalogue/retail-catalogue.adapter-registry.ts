import type { CatalogueAdapter } from "./retail-catalogue.types.js";

export type CatalogueAdapterFactory = () => CatalogueAdapter;

export class CatalogueAdapterRegistry {
  private readonly factories = new Map<string, CatalogueAdapterFactory>();

  constructor(
    factories: Record<string, CatalogueAdapterFactory> = {}
  ) {
    for (const [key, factory] of Object.entries(factories)) {
      this.register(key, factory);
    }
  }

  register(
    adapterKey: string,
    factory: CatalogueAdapterFactory
  ): void {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error("CATALOGUE_ADAPTER_KEY_MISSING");
    }

    if (this.factories.has(key)) {
      throw new Error(
        `CATALOGUE_ADAPTER_ALREADY_REGISTERED:${key}`
      );
    }

    this.factories.set(key, factory);
  }

  has(adapterKey: string): boolean {
    return this.factories.has(adapterKey);
  }

  resolve(adapterKey: string): CatalogueAdapter {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error("CATALOGUE_ADAPTER_KEY_MISSING");
    }

    const factory = this.factories.get(key);

    if (!factory) {
      throw new Error(
        `CATALOGUE_ADAPTER_NOT_FOUND:${key}`
      );
    }

    const adapter = factory();

    if (!adapter) {
      throw new Error(
        `CATALOGUE_ADAPTER_FACTORY_FAILED:${key}`
      );
    }

    if (adapter.adapterKey !== key) {
      throw new Error(
        `CATALOGUE_ADAPTER_KEY_MISMATCH:${key}`
      );
    }

    return adapter;
  }
}
