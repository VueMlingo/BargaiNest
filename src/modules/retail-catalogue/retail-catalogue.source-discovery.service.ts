import type { FastifyInstance } from "fastify";
import type {
  CatalogueChannel,
  CatalogueSourceType,
} from "@prisma/client";

import {
  selectCatalogueSources,
  type CatalogueSourceSelectionResult,
} from "./retail-catalogue.source-selector.js";

import type {
  CatalogueSourceSelectionInput,
} from "./retail-catalogue.source-selector.js";

export type {
  CatalogueSourceSelectionInput,
} from "./retail-catalogue.source-selector.js";

export async function discoverCatalogueSources(
  api: FastifyInstance,
  input: CatalogueSourceSelectionInput = {}
): Promise<CatalogueSourceSelectionResult[]> {
  const sources = await api.prisma.catalogueSource.findMany({
    where: {
      active: true,
      ...(input.retailerId && {
        retailerId: input.retailerId,
      }),
      ...(input.channel && {
        channel: input.channel as CatalogueChannel,
      }),
      ...(input.sourceType && {
        sourceType: input.sourceType as CatalogueSourceType,
      }),
      ...(input.countryCode && {
        countryCode: input.countryCode,
      }),
      ...(input.province && {
        OR: [
          { province: null },
          { province: input.province },
        ],
      }),
      ...(input.city && {
        OR: [
          { city: null },
          { city: input.city },
        ],
      }),
    },
    include: {
      retailer: {
        select: {
          code: true,
          name: true,
        },
      },
      runs: {
        select: {
          status: true,
          startedAt: true,
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 1,
      },
    },
  });

  const sourceRecords = sources.map((source) => ({
    id: source.id,
    retailerId: source.retailerId,
    retailerCode: source.retailer.code,
    retailerName: source.retailer.name,
    code: source.code,
    name: source.name,
    channel: source.channel,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    adapterKey: source.adapterKey,
    region: source.region,
    countryCode: source.countryCode,
    province: source.province,
    city: source.city,
    storeCode: source.storeCode,
    sourcePriority: source.sourcePriority,
    lastSuccessfulRunAt: source.lastSuccessfulRunAt,
    latestRunStatus: source.runs[0]?.status ?? null,
  }));

  return selectCatalogueSources(
    sourceRecords,
    input
  );
}
