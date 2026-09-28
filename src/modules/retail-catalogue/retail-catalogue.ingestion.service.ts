import type { FastifyInstance } from "fastify";

import { normalizeCatalogueItem } from "./retail-catalogue.normalizer.js";
import { resolveCatalogueProduct } from "./retail-catalogue.product-resolver.js";

import type {
  CatalogueAdapter,
  CatalogueSourceContext,
  RawCatalogueItem,
} from "./retail-catalogue.types.js";

export interface CatalogueIngestionResult {
  catalogueRunId: string;
  itemsDiscovered: number;
  itemsProcessed: number;
  itemsMatched: number;
  itemsUnmatched: number;
  priceObservationsCreated: number;
}

/**
 * Ingest a retailer catalogue through the complete catalogue pipeline.
 *
 * Important architectural rules:
 *
 * - Retailer adapters are the source of catalogue data.
 * - BargaiNest never invents prices.
 * - CatalogueItems preserve the retailer-published source data.
 * - Only CONFIRMED product matches can create PriceObservations.
 * - Proposed/unmatched products remain available for later review.
 * - Existing ProductRetailer.currentPrice is not used as catalogue truth.
 */
export async function ingestCatalogue(
  api: FastifyInstance,
  context: CatalogueSourceContext,
  adapter: CatalogueAdapter
): Promise<CatalogueIngestionResult> {

  const startedAt = new Date();

  const catalogueSource =
    await api.prisma.catalogueSource.findUnique({
      where: {
        id: context.catalogueSourceId,
      },
    });

  if (!catalogueSource) {
    throw new Error("CATALOGUE_SOURCE_NOT_FOUND");
  }

  if (!catalogueSource.active) {
    throw new Error("CATALOGUE_SOURCE_INACTIVE");
  }

  if (catalogueSource.retailerId !== context.retailerId) {
    throw new Error(
      "CATALOGUE_SOURCE_RETAILER_MISMATCH"
    );
  }

  const catalogueRun =
    await api.prisma.catalogueRun.create({
      data: {
        catalogueSourceId: context.catalogueSourceId,
        status: "RUNNING",
        startedAt,
      },
    });

  try {
    /*
     * ------------------------------------------------------------------------
     * SOURCE DISCOVERY
     * ------------------------------------------------------------------------
     */

    const rawItems: RawCatalogueItem[] =
      await adapter.discover(context);

    await api.prisma.catalogueRun.update({
      where: {
        id: catalogueRun.id,
      },
      data: {
        retrievedAt: new Date(),
        itemsDiscovered: rawItems.length,
      },
    });

    let itemsProcessed = 0;
    let itemsMatched = 0;
    let itemsUnmatched = 0;
    let priceObservationsCreated = 0;

    /*
     * ------------------------------------------------------------------------
     * ITEM PROCESSING
     * ------------------------------------------------------------------------
     */

    for (const rawItem of rawItems) {
      try {
        const item =
          normalizeCatalogueItem(rawItem);

        const resolution =
          await resolveCatalogueProduct(
            api,
            context.retailerId,
            item
          );

        /*
         * Store the retailer catalogue item regardless of whether
         * BargaiNest can currently resolve it to a Product.
         *
         * This preserves the source evidence for future matching.
         */

        const catalogueItem =
          await api.prisma.catalogueItem.create({
            data: {
              catalogueRunId: catalogueRun.id,

              externalId: item.externalId,
              retailerSku: item.retailerSku,

              gtin: item.gtin,
              barcode: item.barcode,

              rawName: item.rawName,
              normalizedName: item.normalizedName,

              brand: item.brand,
              packSize: item.packSize,
              unit: item.unit,
              category: item.category,

              price: item.price,
              wasPrice: item.wasPrice,

              currency: item.currency,

              isPromotion: item.isPromotion,
              promotionText: item.promotionText,

              validFrom: item.validFrom,
              validUntil: item.validUntil,

              sourceReference:
                item.sourceReference,

              extractionMethod:
                item.extractionMethod,

              extractionConfidence:
                item.extractionConfidence,

              rawData: item.rawData === null ? null : JSON.parse(JSON.stringify(item.rawData)),
            },
          });

        /*
         * Store the product resolution separately.
         *
         * Even proposed matches are retained because they represent
         * useful intelligence for later manual/automated review.
         */

        if (resolution.productId) {
          await api.prisma.catalogueItemProductMatch.create({
            data: {
              catalogueItemId: catalogueItem.id,
              productId: resolution.productId,
              confidence: resolution.confidence,
              method: resolution.method,
              status: resolution.status,
              reason: resolution.reason,
            },
          });
        }

        if (
          resolution.productId &&
          resolution.status === "CONFIRMED"
        ) {
          itemsMatched += 1;
        } else {
          itemsUnmatched += 1;
        }

        /*
         * --------------------------------------------------------------------
         * VERIFIED PRICE OBSERVATION
         * --------------------------------------------------------------------
         *
         * A price observation is created only when:
         *
         * 1. A retailer actually supplied a price.
         * 2. The price is valid.
         * 3. The catalogue item has a confirmed product identity.
         *
         * This prevents fuzzy/proposed matches from becoming financial claims.
         */

        if (
          item.price !== null &&
          Number.isFinite(item.price) &&
          item.price >= 0 &&
          resolution.productId &&
          resolution.status === "CONFIRMED"
        ) {
          await api.prisma.priceObservation.create({
            data: {
              productId: resolution.productId,
              retailerId: context.retailerId,

              price: item.price,
              currency: item.currency,

              observedAt: new Date(),

              source:
                catalogueSource.name,

              sourceReference:
                item.sourceReference ??
                catalogueSource.sourceUrl ??
                null,

              channel:
                context.channel,

              validFrom:
                item.validFrom,

              validUntil:
                item.validUntil,

              isPromotion:
                item.isPromotion,

              promotionText:
                item.promotionText,

              confidence:
                item.extractionConfidence,

              extractionMethod:
                item.extractionMethod,

              catalogueItemId:
                catalogueItem.id,
            },
          });

          priceObservationsCreated += 1;
        }

        itemsProcessed += 1;
      } catch (error) {
        /*
         * A malformed individual catalogue item must not destroy the
         * complete catalogue run.
         *
         * The run continues and the final status becomes PARTIAL.
         */

        itemsProcessed += 1;

        console.error(
          "Catalogue item processing failed",
          {
            catalogueRunId: catalogueRun.id,
            error,
          }
        );
      }
    }

    const status =
      itemsProcessed === rawItems.length
        ? "COMPLETED"
        : "PARTIAL";

    await api.prisma.catalogueSource.update({
      where: {
        id: context.catalogueSourceId,
      },
      data: {
        lastSuccessfulRunAt: new Date(),
      },
    });

    await api.prisma.catalogueRun.update({
      where: {
        id: catalogueRun.id,
      },
      data: {
        status,
        completedAt: new Date(),
        itemsProcessed,
        itemsMatched,
        itemsUnmatched,
        metadata: {
          adapterKey: adapter.adapterKey,
          channel: context.channel,
          sourceType: context.sourceType,
          retailerId: context.retailerId,
          priceObservationsCreated,
        },
      },
    });

    return {
      catalogueRunId: catalogueRun.id,
      itemsDiscovered: rawItems.length,
      itemsProcessed,
      itemsMatched,
      itemsUnmatched,
      priceObservationsCreated,
    };
  } catch (error) {
    await api.prisma.catalogueRun.update({
      where: {
        id: catalogueRun.id,
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown catalogue ingestion error",
      },
    });

    throw error;
  }
}
