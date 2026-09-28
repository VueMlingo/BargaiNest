import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { evaluateBetterPrice } from "./intelligence-engine.service.js";
import { evaluatePriceEligibility } from "../price-eligibility/price-eligibility.service.js";

const priceComparisonSchema = z.object({
  productId: z.string().uuid(),
  currentRetailerId: z.string().uuid(),
});

export async function registerIntelligenceEngineRoutes(
  api: FastifyInstance
): Promise<void> {

  /*
   * --------------------------------------------------------------------------
   * RUN BETTER-PRICE INTELLIGENCE
   * --------------------------------------------------------------------------
   *
   * Builds the comparison from stored product/retailer price observations
   * and passes it through the deterministic intelligence engine.
   *
   * --------------------------------------------------------------------------
   */

  api.post("/intelligence/price-comparison", async (request, reply) => {
    const body = priceComparisonSchema.parse(request.body ?? {});

    const product = await api.prisma.product.findUnique({
      where: {
        id: body.productId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!product) {
      return reply.code(404).send({
        error: "PRODUCT_NOT_FOUND",
        message: "Product was not found",
      });
    }

    const currentRetailer = await api.prisma.retailer.findUnique({
      where: {
        id: body.currentRetailerId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!currentRetailer) {
      return reply.code(404).send({
        error: "RETAILER_NOT_FOUND",
        message: "Retailer was not found",
      });
    }

    /*
     * Catalogue-backed observations are the source of truth for
     * price intelligence.
     *
     * We deliberately require:
     *   - catalogueItemId
     *   - a confirmed product match for this product
     *
     * Freshness, validity window, confidence, extraction method,
     * channel and provenance are evaluated by the price-eligibility layer.
     */
    const currentObservations =
      await api.prisma.priceObservation.findMany({
        where: {
          productId: body.productId,
          retailerId: body.currentRetailerId,
          catalogueItemId: {
            not: null,
          },
        },
        orderBy: {
          observedAt: "desc",
        },
        include: {
          catalogueItem: {
            include: {
              matches: {
                where: {
                  productId: body.productId,
                },
                select: {
                  productId: true,
                  confidence: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    const currentObservation = currentObservations.find((observation) => {
      const match = observation.catalogueItem?.matches.find(
        (entry) => entry.status === "CONFIRMED"
      );

      if (!match) {
        return false;
      }

      return evaluatePriceEligibility({
        price: Number(observation.price),
        currency: observation.currency,
        observedAt: observation.observedAt,
        sourceReference: observation.sourceReference,
        catalogueItemId: observation.catalogueItemId,
        validFrom: observation.validFrom,
        validUntil: observation.validUntil,
        confidence:
          observation.confidence == null
            ? null
            : Number(observation.confidence),
        extractionMethod: observation.extractionMethod,
        channel: observation.channel,
        matchStatus: match.status,
      }).eligible;
    });

    if (!currentObservation) {
      return reply.code(404).send({
        error: "ELIGIBLE_CURRENT_PRICE_NOT_FOUND",
        message:
          "No eligible catalogue-backed price observation exists for the product at the current retailer",
      });
    }

    const alternativeObservations =
      await api.prisma.priceObservation.findMany({
        where: {
          productId: body.productId,
          retailerId: {
            not: body.currentRetailerId,
          },
          catalogueItemId: {
            not: null,
          },
        },
        orderBy: {
          observedAt: "desc",
        },
        include: {
          retailer: true,
          catalogueItem: {
            include: {
              matches: {
                where: {
                  productId: body.productId,
                },
                select: {
                  productId: true,
                  confidence: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    /*
     * Keep the latest ELIGIBLE catalogue observation per retailer.
     *
     * This is deliberately different from simply taking the newest
     * observation: a stale, expired or low-confidence observation must
     * never hide an older observation that is still valid.
     */
    const latestByRetailer = new Map<
      string,
      (typeof alternativeObservations)[number]
    >();

    for (const observation of alternativeObservations) {
      const match = observation.catalogueItem?.matches.find(
        (entry) => entry.status === "CONFIRMED"
      );

      if (!match) {
        continue;
      }

      const eligibility = evaluatePriceEligibility({
        price: Number(observation.price),
        currency: observation.currency,
        observedAt: observation.observedAt,
        sourceReference: observation.sourceReference,
        catalogueItemId: observation.catalogueItemId,
        validFrom: observation.validFrom,
        validUntil: observation.validUntil,
        confidence:
          observation.confidence == null
            ? null
            : Number(observation.confidence),
        extractionMethod: observation.extractionMethod,
        channel: observation.channel,
        matchStatus: match.status,
      });

      if (!eligibility.eligible) {
        continue;
      }

      if (!latestByRetailer.has(observation.retailerId)) {
        latestByRetailer.set(observation.retailerId, observation);
      }
    }

    const currentMatch = currentObservation.catalogueItem?.matches.find(
      (match) => match.status === "CONFIRMED"
    );

    const result = await evaluateBetterPrice(api, {
      productId: product.id,
      productName: product.name,
      currentRetailerId: currentRetailer.id,
      currentRetailerName: currentRetailer.name,
      currentPrice: Number(currentObservation.price),
      currentObservedAt: currentObservation.observedAt,
      currency: currentObservation.currency,
      currentProvenance: {
        sourceReference: currentObservation.sourceReference,
        catalogueItemId: currentObservation.catalogueItemId,
        validFrom: currentObservation.validFrom,
        validUntil: currentObservation.validUntil,
        confidence:
          currentObservation.confidence == null
            ? null
            : Number(currentObservation.confidence),
        extractionMethod: currentObservation.extractionMethod,
        channel: currentObservation.channel,
        matchStatus: currentMatch?.status ?? null,
      },
      alternatives: Array.from(latestByRetailer.values()).map(
        (observation) => {
          const confirmedMatch =
            observation.catalogueItem?.matches.find(
              (match) => match.status === "CONFIRMED"
            );

          return {
            retailerId: observation.retailerId,
            retailerName: observation.retailer.name,
            price: Number(observation.price),
            currency: observation.currency,
            observedAt: observation.observedAt,
            provenance: {
              sourceReference: observation.sourceReference,
              catalogueItemId: observation.catalogueItemId,
              validFrom: observation.validFrom,
              validUntil: observation.validUntil,
              confidence:
                observation.confidence == null
                  ? null
                  : Number(observation.confidence),
              extractionMethod: observation.extractionMethod,
              channel: observation.channel,
              matchStatus: confirmedMatch?.status ?? null,
            },
          };
        }
      ),
    });

    return result;
  });

  /*
   * --------------------------------------------------------------------------
   * LIST INTELLIGENCE SIGNALS
   * --------------------------------------------------------------------------
   */

  api.get("/intelligence/signals", async () => {
    return api.prisma.intelligenceSignal.findMany({
      orderBy: {
        observedAt: "desc",
      },
      include: {
        product: true,
        retailer: true,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * LIST INTELLIGENCE OPPORTUNITIES
   * --------------------------------------------------------------------------
   */

  api.get("/intelligence/opportunities", async () => {
    return api.prisma.intelligenceOpportunity.findMany({
      orderBy: {
        detectedAt: "desc",
      },
      include: {
        product: true,
        retailer: true,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * GET INTELLIGENCE OPPORTUNITY
   * --------------------------------------------------------------------------
   */

  api.get<{
    Params: {
      opportunityId: string;
    };
  }>(
    "/intelligence/opportunities/:opportunityId",
    async (request, reply) => {
      const opportunity =
        await api.prisma.intelligenceOpportunity.findUnique({
          where: {
            id: request.params.opportunityId,
          },
          include: {
            product: true,
            retailer: true,
          },
        });

      if (!opportunity) {
        return reply.code(404).send({
          error: "INTELLIGENCE_OPPORTUNITY_NOT_FOUND",
          message: "Intelligence opportunity was not found",
        });
      }

      return opportunity;
    }
  );
}
