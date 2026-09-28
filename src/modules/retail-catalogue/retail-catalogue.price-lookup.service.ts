import type { FastifyInstance } from "fastify";

import {
  discoverCatalogueSources,
  type CatalogueSourceSelectionInput,
} from "./retail-catalogue.source-discovery.service.js";

import {
  CataloguePriceLookupRegistry,
} from "./retail-catalogue.price-lookup.registry.js";

import type {
  CataloguePriceLookupAdapter,
  CataloguePriceLookupQuery,
} from "./retail-catalogue.price-lookup.types.js";

import type {
  CatalogueSourceContext,
  RawCatalogueItem,
} from "./retail-catalogue.types.js";

import {
  resolveNearestRetailerBranch,
} from "../retailers/retailer-branch.resolver.js";

export interface CataloguePriceLookupAttempt {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  adapterKey: string | null;
  status:
    | "MATCHED"
    | "NO_MATCH"
    | "UNAVAILABLE"
    | "SKIPPED";
  itemsReturned: number;
  error?: string;
}

export interface CataloguePriceLookupSource {
  id: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  code: string;
  name: string;
  channel: CatalogueSourceContext["channel"];
  sourceType: string;
  sourceUrl: string | null;
  region: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  storeCode: string | null;
  adapterKey: string | null;
}

export interface CataloguePriceLookupMatch {
  item: RawCatalogueItem;
  source: CataloguePriceLookupSource;
}

export interface CataloguePriceLookupResult {
  items: RawCatalogueItem[];
  matches: CataloguePriceLookupMatch[];
  attempts: CataloguePriceLookupAttempt[];
  matchedSourceId: string | null;
  matchedSourceCode: string | null;
  sourcesAttempted: number;
  sourcesMatched: number;
  sourcesFailed: number;
}

function buildSourceContext(
  source: {
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
  },
  runtimeStoreCode?: string | null,
  runtimeProvince?: string | null,
): CatalogueSourceContext {
  const effectiveStoreCode =
    runtimeStoreCode ?? source.storeCode;
  const effectiveProvince =
    runtimeProvince ?? source.province;

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

    ...(effectiveProvince && {
      province: effectiveProvince,
    }),

    ...(source.city !== null && {
      city: source.city,
    }),

    ...(effectiveStoreCode && {
      storeCode: effectiveStoreCode,
    }),
  };
}

function normaliseLookupQuery(
  query: CataloguePriceLookupQuery,
): CataloguePriceLookupQuery {
  const normalised: CataloguePriceLookupQuery = {};

  for (const key of [
    "gtin",
    "barcode",
    "retailerSku",
    "name",
    "brand",
    "packSize",
    "unit",
    "province",
    "storeCode",
  ] as const) {
    const value = query[key];

    if (typeof value === "string" && value.trim()) {
      normalised[key] = value.trim();
    }
  }

  return normalised;
}

export async function lookupCurrentCataloguePrices(
  api: FastifyInstance,
  input: CatalogueSourceSelectionInput,
  query: CataloguePriceLookupQuery,
  registry: CataloguePriceLookupRegistry,
): Promise<CataloguePriceLookupResult> {
  const normalisedQuery =
    normaliseLookupQuery(query);

  const sources =
    await discoverCatalogueSources(
      api,
      {
        ...input,
      },
    );

  const attempts: CataloguePriceLookupAttempt[] = [];
  const matchedItems: RawCatalogueItem[] = [];
  const matches: CataloguePriceLookupMatch[] = [];

  for (const source of sources) {
    if (!source.adapterKey?.trim()) {
      attempts.push({
        sourceId: source.id,
        sourceCode: source.code,
        sourceName: source.name,
        adapterKey: null,
        status: "SKIPPED",
        itemsReturned: 0,
        error:
          "CATALOGUE_SOURCE_ADAPTER_KEY_MISSING",
      });

      continue;
    }

    if (!registry.has(source.adapterKey)) {
      attempts.push({
        sourceId: source.id,
        sourceCode: source.code,
        sourceName: source.name,
        adapterKey: source.adapterKey,
        status: "SKIPPED",
        itemsReturned: 0,
        error:
          `CATALOGUE_PRICE_LOOKUP_ADAPTER_NOT_REGISTERED:${source.adapterKey}`,
      });

      continue;
    }

    let adapter: CataloguePriceLookupAdapter;

    try {
      adapter = registry.resolve(
        source.adapterKey,
      );
    } catch (error) {
      attempts.push({
        sourceId: source.id,
        sourceCode: source.code,
        sourceName: source.name,
        adapterKey: source.adapterKey,
        status: "SKIPPED",
        itemsReturned: 0,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      continue;
    }


    let runtimeStoreCode =
      normalisedQuery.storeCode ?? source.storeCode;

    const runtimeProvince =
      normalisedQuery.province ?? source.province;

    /*
     * For consumer live-price lookups, resolve the
     * nearest active retailer branch from the user's
     * coordinates when the catalogue source does not
     * have a fixed store code.
     */
    if (
      !runtimeStoreCode &&
      source.channel === "ONLINE_STORE" &&
      input.latitude !== undefined &&
      input.longitude !== undefined
    ) {
      const nearestBranch =
        await resolveNearestRetailerBranch(
          api,
          source.retailerId,
          {
            latitude: input.latitude,
            longitude: input.longitude,
          },
        );

      if (!nearestBranch) {
        attempts.push({
          sourceId: source.id,
          sourceCode: source.code,
          sourceName: source.name,
          adapterKey: source.adapterKey,
          status: "SKIPPED",
          itemsReturned: 0,
          error:
            "RETAILER_BRANCH_WITH_LOCATION_AND_EXTERNAL_STORE_CODE_NOT_FOUND",
        });

        continue;
      }

      runtimeStoreCode =
        nearestBranch.externalStoreCode;
    }

    const context =
      buildSourceContext(
        source,
        runtimeStoreCode,
        runtimeProvince,
      );

    try {
      const items =
        await adapter.lookup(
          context,
          normalisedQuery,
        );

      if (items.length === 0) {
        attempts.push({
          sourceId: source.id,
          sourceCode: source.code,
          sourceName: source.name,
          adapterKey: source.adapterKey,
          status: "NO_MATCH",
          itemsReturned: 0,
        });

        continue;
      }

      attempts.push({
        sourceId: source.id,
        sourceCode: source.code,
        sourceName: source.name,
        adapterKey: source.adapterKey,
        status: "MATCHED",
        itemsReturned: items.length,
      });

      matchedItems.push(...items);

      matches.push(
        ...items.map((item) => ({
          item,
          source: {
            id: source.id,
            retailerId: source.retailerId,
            retailerCode: source.retailerCode,
            retailerName: source.retailerName,
            code: source.code,
            name: source.name,
            channel: source.channel,
            sourceType: source.sourceType,
            sourceUrl: source.sourceUrl,
            region: source.region,
            countryCode: source.countryCode,
            province: source.province,
            city: source.city,
            storeCode:
              runtimeStoreCode ??
              source.storeCode,
            adapterKey: source.adapterKey,
          },
        })),
      );
    } catch (error) {
      attempts.push({
        sourceId: source.id,
        sourceCode: source.code,
        sourceName: source.name,
        adapterKey: source.adapterKey,
        status: "UNAVAILABLE",
        itemsReturned: 0,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return {
    items: matchedItems,
    matches,
    attempts,
    matchedSourceId:
      matches[0]?.source.id ?? null,
    matchedSourceCode:
      matches[0]?.source.code ?? null,
    sourcesAttempted:
      attempts.filter(
        (attempt) =>
          attempt.status !== "SKIPPED",
      ).length,
    sourcesMatched:
      attempts.filter(
        (attempt) =>
          attempt.status === "MATCHED",
      ).length,
    sourcesFailed:
      attempts.filter(
        (attempt) =>
          attempt.status === "UNAVAILABLE",
      ).length,
  };
}
