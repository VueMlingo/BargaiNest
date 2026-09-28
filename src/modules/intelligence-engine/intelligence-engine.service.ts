import type { FastifyInstance } from "fastify";

import { evaluatePriceEligibility } from "../price-eligibility/price-eligibility.service.js";
import { detectBetterPrice } from "./intelligence-engine.decision.js";
import type { PriceComparisonInput } from "./intelligence-engine.types.js";

export async function evaluateBetterPrice(
  api: FastifyInstance,
  input: PriceComparisonInput
) {
  const currentEligibility = evaluatePriceEligibility({
    price: input.currentPrice,
    currency: input.currency,
    observedAt: input.currentObservedAt,
    ...input.currentProvenance,
  });

  if (!currentEligibility.eligible) {
    return {
      detected: false,
      eligibility: {
        eligible: false,
        reasons: currentEligibility.reasons,
      },
    };
  }

  const eligibleAlternatives = input.alternatives.filter((alternative) => {
    const eligibility = evaluatePriceEligibility({
      price: alternative.price,
      currency: alternative.currency,
      observedAt: alternative.observedAt,
      ...alternative.provenance,
    });

    return eligibility.eligible;
  });

  const decision = detectBetterPrice({
    ...input,
    alternatives: eligibleAlternatives,
  });

  if (!decision.detected) {
    return {
      detected: false,
    };
  }

  const signal = await api.prisma.intelligenceSignal.create({
    data: {
      userId: null,
      productId: input.productId,
      retailerId: input.currentRetailerId,
      type: "PRICE",
      status: "ACTIVE",
      signalKey: `BETTER_PRICE:${input.productId}:${input.currentRetailerId}:${decision.alternativeRetailerId}`,
      value: decision.estimatedSaving ?? null,
      confidence: decision.confidence ?? null,
      metadata: {
        currentPrice: decision.currentPrice ?? null,
        alternativePrice: decision.alternativePrice ?? null,
        alternativeRetailerId: decision.alternativeRetailerId ?? null,
        alternativeRetailerName: decision.alternativeRetailerName ?? null,
        currency: decision.currency ?? null,
        score: decision.score ?? null,
        reason: decision.reason ?? null,
      },
      observedAt: new Date(),
    },
  });

  const opportunity = await api.prisma.intelligenceOpportunity.create({
    data: {
      userId: null,
      productId: input.productId,
      retailerId: decision.alternativeRetailerId ?? null,
      type: "BETTER_PRICE",
      status: "OPEN",
      title: decision.title ?? `Better price found for ${input.productName}`,
      description: decision.description ?? null,
      estimatedSaving: decision.estimatedSaving ?? null,
      currentPrice: decision.currentPrice ?? null,
      alternativePrice: decision.alternativePrice ?? null,
      currency: decision.currency ?? input.currency,
      score: decision.score ?? null,
      confidence: decision.confidence ?? null,
      metadata: {
        signalId: signal.id,
        alternativeRetailerId: decision.alternativeRetailerId ?? null,
        alternativeRetailerName: decision.alternativeRetailerName ?? null,
        reason: decision.reason ?? null,
      },
      detectedAt: new Date(),
    },
  });

  await api.prisma.intelligenceEvent.create({
    data: {
      userId: null,
      type: "SIGNAL_CREATED",
      entityType: "IntelligenceSignal",
      entityId: signal.id,
      metadata: {
        opportunityId: opportunity.id,
        productId: input.productId,
        type: "BETTER_PRICE",
      },
    },
  });

  await api.prisma.intelligenceEvent.create({
    data: {
      userId: null,
      type: "OPPORTUNITY_CREATED",
      entityType: "IntelligenceOpportunity",
      entityId: opportunity.id,
      metadata: {
        signalId: signal.id,
        productId: input.productId,
        type: "BETTER_PRICE",
      },
    },
  });

  return {
    detected: true,
    signal,
    opportunity,
    decision,
  };
}
