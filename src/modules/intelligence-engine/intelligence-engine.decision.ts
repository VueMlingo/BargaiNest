import {
  IntelligenceDecision,
  PriceComparisonInput,
} from "./intelligence-engine.types.js";

export function detectBetterPrice(
  input: PriceComparisonInput
): IntelligenceDecision {
  if (!input.alternatives.length) {
    return {
      detected: false,
    };
  }

  const validAlternatives = input.alternatives.filter(
    (alternative) =>
      Number.isFinite(alternative.price) &&
      alternative.price >= 0 &&
      alternative.retailerId !== input.currentRetailerId &&
      alternative.currency === input.currency
  );

  if (!validAlternatives.length) {
    return {
      detected: false,
    };
  }

  const bestAlternative = validAlternatives.reduce((best, current) =>
    current.price < best.price ? current : best
  );

  const saving = input.currentPrice - bestAlternative.price;

  if (saving <= 0) {
    return {
      detected: false,
    };
  }

  const savingPercentage =
    input.currentPrice > 0
      ? (saving / input.currentPrice) * 100
      : 0;

  const score = calculateOpportunityScore(
    saving,
    savingPercentage,
    bestAlternative.observedAt,
    input.currentObservedAt
  );

  const confidence = calculateConfidence(
    bestAlternative.observedAt,
    input.currentObservedAt
  );

  return {
    detected: true,
    type: "BETTER_PRICE",

    title: `Save ${formatCurrency(
      saving,
      input.currency
    )} on ${input.productName}`,

    description: `${input.productName} is available for ${
      bestAlternative.price
    } ${input.currency} at ${
      bestAlternative.retailerName ?? "another retailer"
    }, compared with ${
      input.currentPrice
    } ${input.currency} at ${
      input.currentRetailerName ?? "the current retailer"
    }.`,

    currentPrice: input.currentPrice,
    alternativePrice: bestAlternative.price,
    estimatedSaving: roundMoney(saving),

    currency: input.currency,

    alternativeRetailerId: bestAlternative.retailerId,

    alternativeRetailerName:
      bestAlternative.retailerName ?? "another retailer",

    score,
    confidence,

    reason: `A lower observed price exists at ${
      bestAlternative.retailerName ?? "another retailer"
    }.`,
  };
}

/**
 * --------------------------------------------------------------------------
 * OPPORTUNITY SCORE
 * --------------------------------------------------------------------------
 *
 * Maximum score = 100
 *
 * Score consists of:
 *
 *   Saving percentage = up to 80 points
 *   Absolute saving   = up to 10 points
 *   Freshness         = freshness adjustment
 *
 * Freshness intentionally has a smaller influence than the saving itself.
 *
 * --------------------------------------------------------------------------
 */
function calculateOpportunityScore(
  saving: number,
  savingPercentage: number,
  alternativeObservedAt: Date,
  currentObservedAt: Date
): number {
  let percentageScore = 0;

  if (savingPercentage < 5) {
    percentageScore = 10;
  } else if (savingPercentage < 10) {
    percentageScore = 25;
  } else if (savingPercentage < 15) {
    percentageScore = 40;
  } else if (savingPercentage < 25) {
    percentageScore = 60;
  } else {
    percentageScore = 80;
  }

  const absoluteSavingScore = Math.min(
    10,
    Math.max(0, saving * 2)
  );

  const freshnessScore = calculateFreshnessScore(
    alternativeObservedAt,
    currentObservedAt
  );

  return Math.min(
    100,
    Math.max(
      0,
      roundScore(
        percentageScore +
          absoluteSavingScore +
          freshnessScore
      )
    )
  );
}

/**
 * --------------------------------------------------------------------------
 * PRICE FRESHNESS
 * --------------------------------------------------------------------------
 *
 * Freshness is based on the MOST RECENT observation.
 *
 *   0–1 day   = +6
 *   1–3 days  = +4
 *   3–7 days  = +2
 *   7–14 days = -1
 *   14+ days  = -4
 *
 * The freshness component is deliberately an adjustment rather than
 * a large independent score. This prevents stale prices from receiving
 * the same opportunity score as fresh prices.
 *
 * --------------------------------------------------------------------------
 */
function calculateFreshnessScore(
  alternativeObservedAt: Date,
  currentObservedAt: Date
): number {
  const latestObservation = Math.max(
    alternativeObservedAt.getTime(),
    currentObservedAt.getTime()
  );

  const ageInDays =
    (Date.now() - latestObservation) /
    (1000 * 60 * 60 * 24);

  if (ageInDays <= 1) {
    return 6;
  }

  if (ageInDays <= 3) {
    return 4;
  }

  if (ageInDays <= 7) {
    return 2;
  }

  if (ageInDays <= 14) {
    return -1;
  }

  return -4;
}

/**
 * --------------------------------------------------------------------------
 * CONFIDENCE
 * --------------------------------------------------------------------------
 *
 * Confidence is represented as 0–1.
 *
 * Confidence is also based on the MOST RECENT observation.
 *
 *   0–1 day   = 1.00
 *   1–3 days  = 0.90
 *   3–7 days  = 0.75
 *   7–14 days = 0.50
 *   14+ days  = 0.25
 *
 * --------------------------------------------------------------------------
 */
function calculateConfidence(
  alternativeObservedAt: Date,
  currentObservedAt: Date
): number {
  const latestObservation = Math.max(
    alternativeObservedAt.getTime(),
    currentObservedAt.getTime()
  );

  const ageInDays =
    (Date.now() - latestObservation) /
    (1000 * 60 * 60 * 24);

  if (ageInDays <= 1) {
    return 1;
  }

  if (ageInDays <= 3) {
    return 0.9;
  }

  if (ageInDays <= 7) {
    return 0.75;
  }

  if (ageInDays <= 14) {
    return 0.5;
  }

  return 0.25;
}

/**
 * --------------------------------------------------------------------------
 * FORMATTING HELPERS
 * --------------------------------------------------------------------------
 */

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrency(
  value: number,
  currency: string
): string {
  return `${roundMoney(value).toFixed(2)} ${currency}`;
}
