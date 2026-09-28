import type { CatalogueSourceDiscoveryAdapter } from "./retail-catalogue.source-discovery.types.js";

export type CatalogueSourceDiscoveryAdapterFactory =
  () => CatalogueSourceDiscoveryAdapter;

export class CatalogueSourceDiscoveryRegistry {
  private readonly factories = new Map<
    string,
    CatalogueSourceDiscoveryAdapterFactory
  >();

  constructor(
    factories: Record<string, CatalogueSourceDiscoveryAdapterFactory> = {},
  ) {
    for (const [key, factory] of Object.entries(factories)) {
      this.register(key, factory);
    }
  }

  register(
    discoveryKey: string,
    factory: CatalogueSourceDiscoveryAdapterFactory,
  ): void {
    const key = discoveryKey.trim();

    if (!key) {
      throw new Error("CATALOGUE_SOURCE_DISCOVERY_KEY_MISSING");
    }

    if (this.factories.has(key)) {
      throw new Error(
        `CATALOGUE_SOURCE_DISCOVERY_ALREADY_REGISTERED:${key}`,
      );
    }

    this.factories.set(key, factory);
  }

  has(discoveryKey: string): boolean {
    return this.factories.has(discoveryKey.trim());
  }

  resolve(discoveryKey: string): CatalogueSourceDiscoveryAdapter {
    const key = discoveryKey.trim();

    if (!key) {
      throw new Error("CATALOGUE_SOURCE_DISCOVERY_KEY_MISSING");
    }

    const factory = this.factories.get(key);

    if (!factory) {
      throw new Error(
        `CATALOGUE_SOURCE_DISCOVERY_NOT_FOUND:${key}`,
      );
    }

    const adapter = factory();

    if (!adapter) {
      throw new Error(
        `CATALOGUE_SOURCE_DISCOVERY_FACTORY_FAILED:${key}`,
      );
    }

    if (adapter.discoveryKey !== key) {
      throw new Error(
        `CATALOGUE_SOURCE_DISCOVERY_KEY_MISMATCH:${key}`,
      );
    }

    return adapter;
  }
}
