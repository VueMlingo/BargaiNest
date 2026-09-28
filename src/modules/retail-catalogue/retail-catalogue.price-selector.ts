/**
 * Price Selection Foundation
 *
 * PriceObservation records are historical evidence.
 * This selector determines which observation is currently
 * usable for a retailer/product comparison.
 *
 * Important:
 * - We do NOT choose the cheapest observation blindly.
 * - We first eliminate observations that are not currently valid.
 * - Among valid observations, we prefer the most current evidence.
 * - Confidence is used as a tie-breaker.
 * - Currency must match when a requested currency is supplied.
 *
 * This layer deliberately knows nothing about Prisma, Products,
 * Shopping Lists, Best Basket, or retailer adapters.
 */

export interface PriceSelectionObservation {
  id: string;
  productId: string;
  retailerId: string;
  price: number | string;
  currency: string;
  observedAt: Date;
  source?: string | null;
  sourceReference?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  confidence?: number | string | null;
  isPromotion?: boolean;
}

export interface PriceSelectionInput {
  now?: Date;
  retailerId?: string;
  currency?: string;
  minimumConfidence?: number;
}

export interface SelectedPriceObservation {
  observation: PriceSelectionObservation;
  ageInHours: number;
  currentlyValid: boolean;
}

export interface PriceSelectionResult {
  selected: SelectedPriceObservation | null;
  eligibleCount: number;
  rejectedCount: number;
  reason:
    | "SELECTED"
    | "NO_OBSERVATIONS"
    | "NO_ELIGIBLE_OBSERVATIONS";
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function isCurrentlyValid(
  observation: PriceSelectionObservation,
  now: Date,
): boolean {
  if (observation.validFrom && observation.validFrom.getTime() > now.getTime()) {
    return false;
  }

  if (observation.validUntil && observation.validUntil.getTime() < now.getTime()) {
    return false;
  }

  return true;
}

function getAgeInHours(
  observation: PriceSelectionObservation,
  now: Date,
): number {
  return Math.max(
    0,
    (now.getTime() - observation.observedAt.getTime()) /
      (1000 * 60 * 60),
  );
}

function confidenceValue(
  observation: PriceSelectionObservation,
): number {
  const confidence = toNumber(observation.confidence);

  if (confidence === null) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Determines which currently valid observation should represent
 * a product's price at a specific retailer.
 *
 * Ranking:
 *   1. Most recent observation
 *   2. Higher extraction confidence
 *   3. More recent validFrom
 *   4. Stable observation ID as final deterministic tie-breaker
 *
 * Price itself is deliberately NOT a ranking criterion.
 */
export function selectBestRetailerPrice(
  observations: PriceSelectionObservation[],
  input: PriceSelectionInput = {},
): PriceSelectionResult {
  const now = input.now ?? new Date();

  const candidates = observations.filter((observation) => {
    if (
      input.retailerId &&
      observation.retailerId !== input.retailerId
    ) {
      return false;
    }

    if (
      input.currency &&
      observation.currency !== input.currency
    ) {
      return false;
    }

    const price = toNumber(observation.price);

    if (price === null || price < 0) {
      return false;
    }

    const confidence = confidenceValue(observation);

    if (
      input.minimumConfidence !== undefined &&
      confidence < input.minimumConfidence
    ) {
      return false;
    }

    if (!isCurrentlyValid(observation, now)) {
      return false;
    }

    return true;
  });

  if (!observations.length) {
    return {
      selected: null,
      eligibleCount: 0,
      rejectedCount: 0,
      reason: "NO_OBSERVATIONS",
    };
  }

  if (!candidates.length) {
    return {
      selected: null,
      eligibleCount: 0,
      rejectedCount: observations.length,
      reason: "NO_ELIGIBLE_OBSERVATIONS",
    };
  }

  candidates.sort((a, b) => {
    const observedAtDifference =
      b.observedAt.getTime() - a.observedAt.getTime();

    if (observedAtDifference !== 0) {
      return observedAtDifference;
    }

    const confidenceDifference =
      confidenceValue(b) - confidenceValue(a);

    if (confidenceDifference !== 0) {
      return confidenceDifference;
    }

    const aValidFrom =
      a.validFrom?.getTime() ?? Number.NEGATIVE_INFINITY;

    const bValidFrom =
      b.validFrom?.getTime() ?? Number.NEGATIVE_INFINITY;

    const validFromDifference =
      bValidFrom - aValidFrom;

    if (validFromDifference !== 0) {
      return validFromDifference;
    }

    return a.id.localeCompare(b.id);
  });

  const selectedObservation = candidates[0];

  if (!selectedObservation) {
    return {
      selected: null,
      eligibleCount: 0,
      rejectedCount: observations.length,
      reason: "NO_ELIGIBLE_OBSERVATIONS",
    };
  }

  return {
    selected: {
      observation: selectedObservation,
      ageInHours: getAgeInHours(selectedObservation, now),
      currentlyValid: true,
    },
    eligibleCount: candidates.length,
    rejectedCount: observations.length - candidates.length,
    reason: "SELECTED",
  };
}

/**
 * Selects one current price for each retailer represented
 * in the supplied observations.
 *
 * This is the bridge between price selection and Best Basket:
 *
 *   historical observations
 *           ↓
 *   current price per retailer
 *           ↓
 *   retailer comparison / basket optimisation
 */
export function selectCurrentPricesByRetailer(
  observations: PriceSelectionObservation[],
  input: Omit<PriceSelectionInput, "retailerId"> = {},
): Map<string, SelectedPriceObservation> {
  const retailerIds = new Set(
    observations.map((observation) => observation.retailerId),
  );

  const selected = new Map<string, SelectedPriceObservation>();

  for (const retailerId of retailerIds) {
    const result = selectBestRetailerPrice(observations, {
      ...input,
      retailerId,
    });

    if (result.selected) {
      selected.set(retailerId, result.selected);
    }
  }

  return selected;
}
