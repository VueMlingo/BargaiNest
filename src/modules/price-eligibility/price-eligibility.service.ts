export interface PriceEligibilityInput {
  price: number;
  currency: string;
  observedAt: Date;

  sourceReference?: string | null;
  catalogueItemId?: string | null;

  validFrom?: Date | null;
  validUntil?: Date | null;

  confidence?: number | null;
  extractionMethod?: string | null;
  channel?: string | null;

  matchStatus?: "PROPOSED" | "CONFIRMED" | "REJECTED" | null;
}

export interface PriceEligibilityPolicy {
  maxAgeHours: number;
  minimumConfidence: number;
  requireSource: boolean;
  requireConfirmedMatch: boolean;
}

export interface PriceEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export const DEFAULT_PRICE_ELIGIBILITY_POLICY: PriceEligibilityPolicy = {
  maxAgeHours: 72,
  minimumConfidence: 0.7,
  requireSource: true,
  requireConfirmedMatch: true,
};

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function evaluatePriceEligibility(
  input: PriceEligibilityInput,
  now: Date = new Date(),
  policy: PriceEligibilityPolicy = DEFAULT_PRICE_ELIGIBILITY_POLICY
): PriceEligibilityResult {
  const reasons: string[] = [];

  if (!Number.isFinite(input.price) || input.price < 0) {
    reasons.push("INVALID_PRICE");
  }

  if (!input.currency || input.currency.trim().length !== 3) {
    reasons.push("INVALID_CURRENCY");
  }

  if (!isValidDate(input.observedAt)) {
    reasons.push("INVALID_OBSERVED_AT");
  } else {
    if (input.observedAt.getTime() > now.getTime()) {
      reasons.push("OBSERVATION_IN_FUTURE");
    }

    const ageMs = now.getTime() - input.observedAt.getTime();
    const maxAgeMs = policy.maxAgeHours * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      reasons.push("STALE_OBSERVATION");
    }
  }

  if (isValidDate(input.validFrom) && input.validFrom.getTime() > now.getTime()) {
    reasons.push("NOT_YET_VALID");
  }

  if (isValidDate(input.validUntil) && input.validUntil.getTime() <= now.getTime()) {
    reasons.push("EXPIRED");
  }

  if (policy.requireSource) {
    const hasSource =
      Boolean(input.sourceReference?.trim()) ||
      Boolean(input.catalogueItemId?.trim());

    if (!hasSource) {
      reasons.push("MISSING_SOURCE_PROVENANCE");
    }
  }

  if (policy.requireConfirmedMatch && input.matchStatus !== "CONFIRMED") {
    reasons.push("PRODUCT_MATCH_NOT_CONFIRMED");
  }

  if (
    input.confidence === null ||
    input.confidence === undefined ||
    !Number.isFinite(input.confidence) ||
    input.confidence < policy.minimumConfidence
  ) {
    reasons.push("INSUFFICIENT_CONFIDENCE");
  }

  if (!input.extractionMethod?.trim()) {
    reasons.push("MISSING_EXTRACTION_METHOD");
  }

  if (!input.channel?.trim()) {
    reasons.push("MISSING_CHANNEL");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
