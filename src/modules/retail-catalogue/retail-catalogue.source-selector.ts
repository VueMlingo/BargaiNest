import type {
  CatalogueChannel,
  CatalogueRunStatus,
  CatalogueSourceType,
} from "@prisma/client";

export interface CatalogueSourceSelectionInput {
  now?: Date;
  retailerId?: string;
  countryCode?: string;
  province?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  channel?: CatalogueChannel;
  sourceType?: CatalogueSourceType;
  limit?: number;
}

export interface CatalogueSourceSelectionResult {
  id: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  code: string;
  name: string;
  channel: CatalogueChannel;
  sourceType: CatalogueSourceType;
  sourceUrl: string | null;
  adapterKey: string | null;
  region: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  storeCode: string | null;
  sourcePriority: number;
  lastSuccessfulRunAt: Date | null;
  latestRunStatus: CatalogueRunStatus | null;
}

interface CatalogueSourceRecord {
  id: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  code: string;
  name: string;
  channel: CatalogueChannel;
  sourceType: CatalogueSourceType;
  sourceUrl: string | null;
  adapterKey: string | null;
  region: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  storeCode: string | null;
  sourcePriority: number;
  lastSuccessfulRunAt: Date | null;
  latestRunStatus: CatalogueRunStatus | null;
}

function matchesGeography(
  source: CatalogueSourceRecord,
  input: CatalogueSourceSelectionInput
): boolean {
  if (
    input.countryCode &&
    source.countryCode &&
    source.countryCode !== input.countryCode
  ) {
    return false;
  }

  if (
    input.province &&
    source.province &&
    source.province !== input.province
  ) {
    return false;
  }

  if (
    input.city &&
    source.city &&
    source.city !== input.city
  ) {
    return false;
  }

  return true;
}

function healthScore(
  source: CatalogueSourceRecord
): number {
  switch (source.latestRunStatus) {
    case "COMPLETED":
      return 0;

    case "PARTIAL":
      return 1;

    case "RUNNING":
      return 2;

    case "FAILED":
      return 3;

    case null:
      return 4;

    default:
      return 4;
  }
}

function freshnessScore(
  source: CatalogueSourceRecord,
  now: Date
): number {
  if (!source.lastSuccessfulRunAt) {
    return Number.POSITIVE_INFINITY;
  }

  return now.getTime() - source.lastSuccessfulRunAt.getTime();
}

export function selectCatalogueSources(
  sources: CatalogueSourceRecord[],
  input: CatalogueSourceSelectionInput = {}
): CatalogueSourceSelectionResult[] {
  const now = input.now ?? new Date();

  const filtered = sources.filter((source) => {
    if (input.retailerId && source.retailerId !== input.retailerId) {
      return false;
    }

    if (input.channel && source.channel !== input.channel) {
      return false;
    }

    if (input.sourceType && source.sourceType !== input.sourceType) {
      return false;
    }

    return matchesGeography(source, input);
  });

  filtered.sort((a, b) => {
    const healthDifference =
      healthScore(a) - healthScore(b);

    if (healthDifference !== 0) {
      return healthDifference;
    }

    const freshnessDifference =
      freshnessScore(a, now) - freshnessScore(b, now);

    if (freshnessDifference !== 0) {
      return freshnessDifference;
    }

    return a.sourcePriority - b.sourcePriority;
  });

  const limit = input.limit ?? filtered.length;

  return filtered.slice(0, limit);
}
