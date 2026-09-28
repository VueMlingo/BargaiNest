import type {
  RetailerOfferSourceAdapter,
} from "./retailer-offer.types.js";
import type {
  RetailerOfferSourceRegistry,
} from "./retailer-offer.source.js";

export type RetailerOfferSourceAdapterFactory =
  () => RetailerOfferSourceAdapter;

export class DefaultRetailerOfferSourceRegistry
  implements RetailerOfferSourceRegistry
{
  private readonly factories = new Map<
    string,
    RetailerOfferSourceAdapterFactory
  >();

  constructor(
    factories: Record<
      string,
      RetailerOfferSourceAdapterFactory
    > = {},
  ) {
    for (const [key, factory] of Object.entries(factories)) {
      this.register(key, factory);
    }
  }

  register(
    adapterKey: string,
    factory: RetailerOfferSourceAdapterFactory,
  ): void {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error(
        "RETAILER_OFFER_ADAPTER_KEY_MISSING",
      );
    }

    if (this.factories.has(key)) {
      throw new Error(
        `RETAILER_OFFER_ADAPTER_ALREADY_REGISTERED:${key}`,
      );
    }

    this.factories.set(key, factory);
  }

  has(adapterKey: string): boolean {
    return this.factories.has(adapterKey.trim());
  }

  resolve(
    adapterKey: string,
  ): RetailerOfferSourceAdapter {
    const key = adapterKey.trim();

    if (!key) {
      throw new Error(
        "RETAILER_OFFER_ADAPTER_KEY_MISSING",
      );
    }

    const factory = this.factories.get(key);

    if (!factory) {
      throw new Error(
        `RETAILER_OFFER_ADAPTER_NOT_FOUND:${key}`,
      );
    }

    const adapter = factory();

    if (!adapter) {
      throw new Error(
        `RETAILER_OFFER_ADAPTER_FACTORY_FAILED:${key}`,
      );
    }

    if (adapter.adapterKey !== key) {
      throw new Error(
        `RETAILER_OFFER_ADAPTER_KEY_MISMATCH:${key}`,
      );
    }

    return adapter;
  }
}
