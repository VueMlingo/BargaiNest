import type {
  MatchedOffer,
  RetailerOffer,
  RetailerOfferContext,
} from "./retailer-offer.types.js";

import type {
  RetailerOfferSourceRegistry,
} from "./retailer-offer.source.js";

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter(Boolean),
  );
}

function tokenOverlap(
  left: Set<string>,
  right: Set<string>,
): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of left) {
    if (right.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(left.size, right.size);
}

function containsNormalizedPhrase(
  value: string,
  phrase: string,
): boolean {
  const normalizedValue = ` ${normalizeText(value)} `;
  const normalizedPhrase = ` ${normalizeText(phrase)} `;

  return normalizedValue.includes(normalizedPhrase);
}

function inferOfferVariant(
  offer: RetailerOffer,
): string | null {
  const searchableText = [
    offer.name,
    offer.category ?? "",
  ].join(" ");

  const normalized = normalizeText(searchableText);

  if (
    /\bfull cream\b/.test(normalized) ||
    /\bfullcream\b/.test(normalized)
  ) {
    return "full cream";
  }

  if (
    /\blow fat\b/.test(normalized) ||
    /\blowfat\b/.test(normalized)
  ) {
    return "low fat";
  }

  if (/\bwhite\b/.test(normalized)) {
    return "white";
  }

  if (/\bbrown\b/.test(normalized)) {
    return "brown";
  }

  return null;
}

function offerMatchesRequestedBrand(
  intentBrand: string,
  offer: RetailerOffer,
): boolean {
  const requestedBrand = normalizeText(intentBrand);

  if (offer.brand) {
    return normalizeText(offer.brand) === requestedBrand;
  }

  /*
   * Some public retailer sources may not populate a dedicated brand
   * field. In that case, allow the canonical brand to be identified
   * from the product name.
   *
   * "coke" is treated as an alias of Coca-Cola by the shopping-intent
   * vocabulary, so recognise it here as well.
   */
  if (requestedBrand === "coca cola" || requestedBrand === "coca-cola") {
    return (
      containsNormalizedPhrase(offer.name, "coca cola") ||
      containsNormalizedPhrase(offer.name, "coca-cola") ||
      containsNormalizedPhrase(offer.name, "coke")
    );
  }

  return containsNormalizedPhrase(
    offer.name,
    requestedBrand,
  );
}

function buildWeakMatch(
  offer: RetailerOffer,
  reason: string,
): MatchedOffer {
  return {
    offer,
    matchScore: 0,
    matchQuality: "WEAK",
    matchReason: reason,
  };
}

function scoreOffer(
  context: RetailerOfferContext,
  offer: RetailerOffer,
): MatchedOffer {
  const intent = context.intent;

  const intentTokens = tokenise(intent.normalizedText);
  const offerTokens = tokenise(offer.name);

  let score = tokenOverlap(intentTokens, offerTokens);
  const reasons: string[] = [];

  if (score >= 0.9) {
    reasons.push("name tokens closely match");
  } else if (score >= 0.6) {
    reasons.push("name tokens strongly overlap");
  } else if (score > 0) {
    reasons.push("some name tokens match");
  }

  /*
   * Explicit brand constraints are hard compatibility constraints.
   *
   * Example:
   *   "coke" -> Coca-Cola
   *   "Coca-Cola 2L" -> Coca-Cola
   *   "Coca-Cola 2L" -> Pepsi 2L = incompatible
   */
  if (intent.attributes.brand) {
    if (
      !offerMatchesRequestedBrand(
        intent.attributes.brand,
        offer,
      )
    ) {
      return buildWeakMatch(
        offer,
        "requested brand does not match",
      );
    }

    score += 0.2;
    reasons.push("brand matches");
  }

  /*
   * Explicit variant constraints are also hard constraints.
   *
   * Generic "milk" can match different variants.
   * "full cream milk" must not silently become low-fat milk.
   */
  if (intent.attributes.variant) {
    const requestedVariant =
      normalizeText(intent.attributes.variant);

    const offerVariant =
      inferOfferVariant(offer);

    if (
      !offerVariant ||
      normalizeText(offerVariant) !== requestedVariant
    ) {
      return buildWeakMatch(
        offer,
        "requested variant does not match",
      );
    }

    score += 0.1;
    reasons.push("variant matches");
  }

  /*
   * Explicit pack size is a hard constraint.
   *
   * Generic "milk" can compare different sizes.
   * "milk 2L" must not become a 1L product.
   */
  if (intent.attributes.packSize) {
    const requestedPackSize =
      normalizeText(intent.attributes.packSize);

    const offerPackSize =
      offer.packSize
        ? normalizeText(offer.packSize)
        : null;

    if (
      !offerPackSize ||
      offerPackSize !== requestedPackSize
    ) {
      return buildWeakMatch(
        offer,
        "requested pack size does not match",
      );
    }

    score += 0.15;
    reasons.push("pack size matches");
  }

  score = Math.min(1, Math.max(0, score));

  let matchQuality: MatchedOffer["matchQuality"];

  if (score >= 0.9) {
    matchQuality = "EXACT";
  } else if (score >= 0.75) {
    matchQuality = "STRONG";
  } else if (score >= 0.5) {
    matchQuality = "GOOD";
  } else {
    matchQuality = "WEAK";
  }

  if (reasons.length === 0) {
    reasons.push("limited information available for matching");
  }

  return {
    offer,
    matchScore: score,
    matchQuality,
    matchReason: reasons.join("; "),
  };
}

export async function getRetailerOffers(
  registry: RetailerOfferSourceRegistry,
  adapterKey: string,
  context: RetailerOfferContext,
): Promise<RetailerOffer[]> {
  const adapter = registry.resolve(adapterKey);

  const offers = await adapter.getOffers(context);

  return offers.filter(
    (offer) =>
      Number.isFinite(offer.price) &&
      offer.price >= 0 &&
      Number.isFinite(offer.confidence) &&
      offer.confidence >= 0 &&
      offer.confidence <= 1,
  );
}

export function matchOffersToIntent(
  context: RetailerOfferContext,
  offers: RetailerOffer[],
): MatchedOffer[] {
  return offers
    .map((offer) => scoreOffer(context, offer))
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore,
    );
}
