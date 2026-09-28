import type { PrismaClient } from "@prisma/client";
import type {
  CatalogueSourceCandidate,
  CatalogueSourceDiscoveryContext,
} from "./retail-catalogue.source-discovery.types.js";

export interface CatalogueSourceDiscoveryPersistenceResult {
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  sources: Array<{
    id: string;
    code: string;
    created: boolean;
  }>;
}

export async function persistDiscoveredCatalogueSources(
  prisma: PrismaClient,
  context: CatalogueSourceDiscoveryContext,
  candidates: CatalogueSourceCandidate[],
): Promise<CatalogueSourceDiscoveryPersistenceResult> {
  const result: CatalogueSourceDiscoveryPersistenceResult = {
    discovered: candidates.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    sources: [],
  };

  for (const candidate of candidates) {
    const code = candidate.code.trim();

    if (!code) {
      continue;
    }

    const existing = await prisma.catalogueSource.findUnique({
      where: { code },
    });

    const data = {
      retailerId: context.retailerId,
      code,
      name: candidate.name,
      channel: candidate.channel,
      sourceType: candidate.sourceType,
      sourceUrl: candidate.sourceUrl,
      description: candidate.description ?? null,
      schedule: candidate.schedule ?? null,
      adapterKey: candidate.adapterKey,
      region: candidate.region ?? null,
      countryCode: candidate.countryCode ?? context.countryCode ?? null,
      province: candidate.province ?? context.province ?? null,
      city: candidate.city ?? context.city ?? null,
      storeCode: candidate.storeCode ?? null,
      sourcePriority: candidate.sourcePriority ?? 100,
      active: true,
    };

    if (!existing) {
      const created = await prisma.catalogueSource.create({ data });

      result.created += 1;
      result.sources.push({
        id: created.id,
        code: created.code,
        created: true,
      });

      continue;
    }

    const changed =
      existing.retailerId !== data.retailerId ||
      existing.name !== data.name ||
      existing.channel !== data.channel ||
      existing.sourceType !== data.sourceType ||
      existing.sourceUrl !== data.sourceUrl ||
      existing.description !== data.description ||
      existing.schedule !== data.schedule ||
      existing.adapterKey !== data.adapterKey ||
      existing.region !== data.region ||
      existing.countryCode !== data.countryCode ||
      existing.province !== data.province ||
      existing.city !== data.city ||
      existing.storeCode !== data.storeCode ||
      existing.sourcePriority !== data.sourcePriority ||
      existing.active !== true;

    if (!changed) {
      result.unchanged += 1;
      result.sources.push({
        id: existing.id,
        code: existing.code,
        created: false,
      });
      continue;
    }

    const updated = await prisma.catalogueSource.update({
      where: { id: existing.id },
      data,
    });

    result.updated += 1;
    result.sources.push({
      id: updated.id,
      code: updated.code,
      created: false,
    });
  }

  return result;
}
