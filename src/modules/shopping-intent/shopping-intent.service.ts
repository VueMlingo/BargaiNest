import type {
  ShoppingIntent,
  ShoppingIntentAttributes,
  ShoppingIntentSpecificity,
} from "./shopping-intent.types.js";

import {
  SHOPPING_BRAND_VOCABULARY,
} from "./shopping-intent.vocabulary.js";

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeText(value);

  return normalized || undefined;
}

function inferSpecificity(
  attributes: ShoppingIntentAttributes,
): ShoppingIntentSpecificity {
  if (
    attributes.brand ||
    attributes.variant ||
    attributes.packSize ||
    attributes.unit
  ) {
    return "specific";
  }

  return "generic";
}

function inferBrand(
  normalizedText: string,
): string | undefined {
  for (const entry of SHOPPING_BRAND_VOCABULARY) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeText(alias);

      if (
        normalizedText === normalizedAlias ||
        normalizedText.includes(` ${normalizedAlias} `) ||
        normalizedText.startsWith(`${normalizedAlias} `) ||
        normalizedText.endsWith(` ${normalizedAlias}`)
      ) {
        return entry.canonical;
      }
    }
  }

  return undefined;
}

function inferAttributes(
  normalizedText: string,
): ShoppingIntentAttributes {
  const attributes: ShoppingIntentAttributes = {};

  /*
   * This implementation deliberately keeps inference separate
   * from the persistent product catalogue.
   *
   * Shopping vocabulary provides canonical concepts such as
   * "coke" -> "coca-cola", while the retailer-offer layer
   * remains responsible for resolving those concepts against
   * current retailer offers.
   */

  const packSizeMatch = normalizedText.match(
    /\b(\d+(?:\.\d+)?)\s?(kg|g|l|ml)\b/i,
  );

  if (packSizeMatch?.[0]) {
    attributes.packSize = normalizeText(packSizeMatch[0]);
  }

  if (/\b(full cream|full-cream)\b/i.test(normalizedText)) {
    attributes.variant = "full cream";
    attributes.category = "dairy";
  }

  if (/\b(white bread)\b/i.test(normalizedText)) {
    attributes.category = "bread";
    attributes.variant = "white";
  }

  if (/\b(milk)\b/i.test(normalizedText)) {
    attributes.category = attributes.category ?? "dairy";
  }

  if (/\b(bread)\b/i.test(normalizedText)) {
    attributes.category = attributes.category ?? "bread";
  }

  const brand = inferBrand(normalizedText);

  if (brand) {
    attributes.brand = brand;
  }

  return attributes;
}

export interface CreateShoppingIntentInput {
  text: string;
  quantity?: number;
  targetPrice?: number | null;
}

export function createShoppingIntent(
  input: CreateShoppingIntentInput,
): ShoppingIntent {
  const originalText = input.text.trim();

  if (!originalText) {
    throw new Error("SHOPPING_INTENT_TEXT_REQUIRED");
  }

  const normalizedText = normalizeText(originalText);

  if (!normalizedText) {
    throw new Error("SHOPPING_INTENT_TEXT_REQUIRED");
  }

  const quantity = input.quantity ?? 1;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("SHOPPING_INTENT_QUANTITY_INVALID");
  }

  if (
    input.targetPrice !== undefined &&
    input.targetPrice !== null &&
    (!Number.isFinite(input.targetPrice) ||
      input.targetPrice < 0)
  ) {
    throw new Error("SHOPPING_INTENT_TARGET_PRICE_INVALID");
  }

  const inferredAttributes = inferAttributes(normalizedText);

  const attributes: ShoppingIntentAttributes = {};

  const category = normalizeOptionalText(
    inferredAttributes.category,
  );

  if (category) {
    attributes.category = category;
  }

  const brand = inferredAttributes.brand?.trim().toLowerCase();

  if (brand) {
    attributes.brand = brand;
  }

  const variant = normalizeOptionalText(
    inferredAttributes.variant,
  );

  if (variant) {
    attributes.variant = variant;
  }

  const packSize = normalizeOptionalText(
    inferredAttributes.packSize,
  );

  if (packSize) {
    attributes.packSize = packSize;
  }

  const unit = normalizeOptionalText(
    inferredAttributes.unit,
  );

  if (unit) {
    attributes.unit = unit;
  }

  return {
    originalText,
    normalizedText,
    quantity,
    ...(input.targetPrice !== undefined
      ? { targetPrice: input.targetPrice }
      : {}),
    specificity: inferSpecificity(attributes),
    attributes,
  };
}
