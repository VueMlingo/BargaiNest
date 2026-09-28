import type { PrismaClient } from "@prisma/client";
import {
  CatalogueSourceDiscoveryRegistry,
} from "./retail-catalogue.source-discovery.registry.js";
import { persistDiscoveredCatalogueSources } from "./retail-catalogue.source-discovery.persistence.js";
import type {
  CatalogueSourceDiscoveryContext,
} from "./retail-catalogue.source-discovery.types.js";

export interface DiscoverCatalogueSourcesInput {
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  countryCode?: string;
  province?: string;
  city?: string;
  discoveryKey: string;
}

export async function discoverAndPersistCatalogueSources(
  prisma: PrismaClient,
  registry: CatalogueSourceDiscoveryRegistry,
  input: DiscoverCatalogueSourcesInput,
) {
  const adapter = registry.resolve(input.discoveryKey);

  const context: CatalogueSourceDiscoveryContext = {
    retailerId: input.retailerId,
    retailerCode: input.retailerCode,
    retailerName: input.retailerName,
    ...(input.countryCode !== undefined && { countryCode: input.countryCode }),
    ...(input.province !== undefined && { province: input.province }),
    ...(input.city !== undefined && { city: input.city }),
  };

  const candidates = await adapter.discover(context);

  return persistDiscoveredCatalogueSources(
    prisma,
    context,
    candidates,
  );
}
