import type { FastifyInstance } from "fastify";

import {
  ingestCatalogue,
  type CatalogueIngestionResult,
} from "./retail-catalogue.ingestion.service.js";

import {
  CatalogueAdapterRegistry,
} from "./retail-catalogue.adapter-registry.js";

import type {
  CatalogueSourceContext,
  CatalogueAdapter,
} from "./retail-catalogue.types.js";

export type CatalogueIngestionRunner = (
  api: FastifyInstance,
  context: CatalogueSourceContext,
  adapter: CatalogueAdapter
) => Promise<CatalogueIngestionResult>;

function buildSourceContext(source: {
  id: string;
  retailerId: string;
  channel: CatalogueSourceContext["channel"];
  sourceType: string;
  sourceUrl: string | null;
  region: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  storeCode: string | null;
}): CatalogueSourceContext {
  return {
    catalogueSourceId: source.id,
    retailerId: source.retailerId,
    channel: source.channel,
    sourceType: source.sourceType,

    ...(source.sourceUrl !== null && {
      sourceUrl: source.sourceUrl,
    }),

    ...(source.region !== null && {
      region: source.region,
    }),

    ...(source.countryCode !== null && {
      countryCode: source.countryCode,
    }),

    ...(source.province !== null && {
      province: source.province,
    }),

    ...(source.city !== null && {
      city: source.city,
    }),

    ...(source.storeCode !== null && {
      storeCode: source.storeCode,
    }),
  };
}

export async function ingestCatalogueSource(
  api: FastifyInstance,
  sourceId: string,
  registry: CatalogueAdapterRegistry,
  runner: CatalogueIngestionRunner = ingestCatalogue
): Promise<CatalogueIngestionResult> {
  const source = await api.prisma.catalogueSource.findUnique({
    where: {
      id: sourceId,
    },
  });

  if (!source) {
    throw new Error("CATALOGUE_SOURCE_NOT_FOUND");
  }

  if (!source.active) {
    throw new Error("CATALOGUE_SOURCE_INACTIVE");
  }

  if (!source.adapterKey?.trim()) {
    throw new Error("CATALOGUE_SOURCE_ADAPTER_KEY_MISSING");
  }

  const adapter = registry.resolve(source.adapterKey);

  const context = buildSourceContext(source);

  return runner(
    api,
    context,
    adapter
  );
}
