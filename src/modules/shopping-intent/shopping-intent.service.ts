import type {
  ShoppingIntent,
  ShoppingIntentAttributes,
  ShoppingIntentSpecificity,
} from "./shopping-intent.types.js";

import {
  SHOPPING_BRAND_VOCABULARY,
} from "./shopping-intent.vocabulary.js";
import { extractPackSize } from "./pack-size.util.js";

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    // REG-003: the general symbol-stripping step below discards
    // anything that isn't a letter, number, or period -- × (the
    // multiplication sign, distinct from the letter "x") would
    // otherwise be silently replaced with a space here, destroying
    // multipack notation like "6×1L" before the pack-size regex in
    // inferAttributes() ever sees it. Converting it to the ASCII "x"
    // first lets it survive as a normal letter, the same way "6x1L"
    // already does.
    .replace(/×/g, "x")
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

  /*
   * REG-003: "6 x 1L Clover Milk" must retain the full "6 x 1L" pack
   * specification -- a multipack (six 1-litre units) is a genuinely
   * different product from a single 1L unit, and conflating them by
   * only capturing the trailing size would silently drop the
   * multiplier. Checked before the simple-size pattern below, since
   * that pattern alone would otherwise match just "1l" out of
   * "6 x 1l" and lose the "6 x" entirely. Accepts "x", "X", or "×" as
   * the multiplier symbol, with or without surrounding spaces, since
   * all three appear in real product names and OCR'd receipt/label
   * text.
   */
  // BN-031: now shared with retail-catalogue.normalizer.ts's own
  // packSize fallback (see pack-size.util.ts) -- both sides of a
  // retailer-offer match must agree on the exact same normalized
  // value for matching to work at all.
  const extractedPackSize = extractPackSize(normalizedText);
  if (extractedPackSize) {
    attributes.packSize = extractedPackSize;
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
