import type {
  RetailerOfferContext,
  RetailerOfferSourceAdapter,
} from "./retailer-offer.types.js";

export interface RetailerOfferSourceRegistry {
  has(adapterKey: string): boolean;

  resolve(
    adapterKey: string,
  ): RetailerOfferSourceAdapter;
}

export interface RetailerOfferSourceService {
  getOffers(
    adapterKey: string,
    context: RetailerOfferContext,
  ): Promise<Awaited<ReturnType<RetailerOfferSourceAdapter["getOffers"]>>>;
}
