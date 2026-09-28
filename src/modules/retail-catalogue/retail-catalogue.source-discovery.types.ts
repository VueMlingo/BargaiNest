import type { CatalogueChannel, CatalogueSourceType } from "@prisma/client";

export interface CatalogueSourceDiscoveryContext {
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  countryCode?: string;
  province?: string;
  city?: string;
}

export interface CatalogueSourceCandidate {
  code: string;
  name: string;
  channel: CatalogueChannel;
  sourceType: CatalogueSourceType;
  sourceUrl: string;
  adapterKey: string;
  description?: string;
  schedule?: string;
  region?: string;
  countryCode?: string;
  province?: string;
  city?: string;
  storeCode?: string;
  sourcePriority?: number;
}

export interface CatalogueSourceDiscoveryAdapter {
  readonly discoveryKey: string;

  discover(
    context: CatalogueSourceDiscoveryContext,
  ): Promise<CatalogueSourceCandidate[]>;
}
