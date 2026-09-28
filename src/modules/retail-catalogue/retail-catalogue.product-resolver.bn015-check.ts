import type { FastifyInstance } from "fastify";

import type {
  NormalizedCatalogueItem,
  ProductResolution,
} from "./retail-catalogue.types.js";

type ParsedPack =
  | {
      quantity: number;
      unit: "ML" | "G";
    }
  | {
      quantity: number;
      unit: "EA";
    };

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateNameSimilarity(
  left: string,
  right: string
): number {
  const leftTokens = new Set(normalizeText(left).split(" "));
  const rightTokens = new Set(normalizeText(right).split(" "));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union =
    leftTokens.size +
    rightTokens.size -
    intersection;

  return union > 0
    ? intersection / union
    : 0;
}

/**
 * Parse common retail pack/size expressions into a comparable quantity.
 *
 * Examples:
 *   1L          -> 1000 ML
 *   1000ml      -> 1000 ML
 *   2L          -> 2000 ML
 *   500g        -> 500 G
 *   1kg         -> 1000 G
 *   6 x 330ml   -> 1980 ML
 *   330ml x 6   -> 1980 ML
 *   pack of 6   -> 6 EA
 *   pk of 6     -> 6 EA
 *   x 6         -> 6 EA
 *
 * Unknown or ambiguous expressions return null.
 */
function parsePackSize(value: string | null | undefined): ParsedPack | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  /*
   * Multipack with a measurable unit:
   *
   * 6 x 330ml
   * 6x330ml
   * 330ml x 6
   * 330mlx6
   */
  const leftMultiplier = normalized.match(
    /^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/
  );

  if (leftMultiplier) {
    const packCount = Number(leftMultiplier[1]);
    const quantity = Number(leftMultiplier[2]);

    if (
      Number.isFinite(packCount) &&
      Number.isFinite(quantity) &&
      packCount > 0 &&
      quantity > 0
    ) {
      const unit = leftMultiplier[3];

      if (unit === "ml") {
        return {
          quantity: packCount * quantity,
          unit: "ML",
        };
      }

      if (unit === "l") {
        return {
          quantity: packCount * quantity * 1000,
          unit: "ML",
        };
      }

      if (unit === "g") {
        return {
          quantity: packCount * quantity,
          unit: "G",
        };
      }

      return {
        quantity: packCount * quantity * 1000,
        unit: "G",
      };
    }
  }

  const rightMultiplier = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\s*x\s*(\d+(?:\.\d+)?)\b/
  );

  if (rightMultiplier) {
    const quantity = Number(rightMultiplier[1]);
    const packCount = Number(rightMultiplier[3]);

    if (
      Number.isFinite(quantity) &&
      Number.isFinite(packCount) &&
      quantity > 0 &&
      packCount > 0
    ) {
      const unit = rightMultiplier[2];

      if (unit === "ml") {
        return {
          quantity: quantity * packCount,
          unit: "ML",
        };
      }

      if (unit === "l") {
        return {
          quantity: quantity * packCount * 1000,
          unit: "ML",
        };
      }

      if (unit === "g") {
        return {
          quantity: quantity * packCount,
          unit: "G",
        };
      }

      return {
        quantity: quantity * packCount * 1000,
        unit: "G",
      };
    }
  }

  /*
   * Explicit "pack of N", "pk of N" and similar expressions.
   */
  const explicitPack = normalized.match(
    /^(?:pack|pk|packet)\s*(?:of)?\s*(\d+(?:\.\d+)?)\b/
  );

  if (explicitPack) {
    const quantity = Number(explicitPack[1]);

    if (Number.isFinite(quantity) && quantity > 0) {
      return {
        quantity,
        unit: "EA",
      };
    }
  }

  /*
   * A standalone "x N" is accepted only when it starts the expression.
   * This avoids treating arbitrary product-name text containing "x"
   * as a pack count.
   */
  const standaloneMultiplier = normalized.match(
    /^x\s*(\d+(?:\.\d+)?)\b/
  );

  if (standaloneMultiplier) {
    const quantity = Number(standaloneMultiplier[1]);

    if (Number.isFinite(quantity) && quantity > 0) {
      return {
        quantity,
        unit: "EA",
      };
    }
  }

  /*
   * Simple measurable sizes.
   */
  const simpleSize = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/
  );

  if (!simpleSize) {
    return null;
  }

  const quantity = Number(simpleSize[1]);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const unit = simpleSize[2];

  if (unit === "ml") {
    return {
      quantity,
      unit: "ML",
    };
  }

  if (unit === "l") {
    return {
      quantity: quantity * 1000,
      unit: "ML",
    };
  }

  if (unit === "g") {
    return {
      quantity,
      unit: "G",
    };
  }

  return {
    quantity: quantity * 1000,
    unit: "G",
  };
}

/**
 * Use the strongest available catalogue-side pack information.
 *
 * packSize is preferred because it is the explicit catalogue field.
 * unit is the next fallback.
 * The raw name is the final fallback.
 */
function getCataloguePack(item: NormalizedCatalogueItem): ParsedPack | null {
  return (
    parsePackSize(item.packSize) ??
    parsePackSize(item.unit) ??
    parsePackSize(item.rawName)
  );
}

/**
 * Use the strongest available Product-side pack information.
 *
 * Product currently has no dedicated packSize field, so unit is preferred
 * and the product name is used as a fallback.
 */
function getProductPack(candidate: {
  name: string;
  unit: string | null;
}): ParsedPack | null {
  return (
    parsePackSize(candidate.unit) ??
    parsePackSize(candidate.name)
  );
}

/**
 * Determine whether two product pack representations are compatible.
 *
 * If either side has no usable pack information, we do not reject the
 * candidate. We only reject when BOTH sides have usable information and
 * they clearly describe different quantities or units.
 */
function packsAreCompatible(
  cataloguePack: ParsedPack | null,
  productPack: ParsedPack | null
): boolean {
  if (!cataloguePack || !productPack) {
    return true;
  }

  return (
    cataloguePack.unit === productPack.unit &&
    cataloguePack.quantity === productPack.quantity
  );
}

/**
 * Resolve a retailer catalogue item against an existing BargaiNest Product.
 *
 * This resolver deliberately does NOT create products.
 *
 * Matching priority:
 *
 *   GTIN
 *   Barcode
 *   Retailer SKU
 *   Exact name
 *   Normalised name
 *   Brand + name + pack size
 *
 * Fuzzy matching is intentionally not promoted to a confirmed match here.
 */
export async function resolveCatalogueProduct(
  api: FastifyInstance,
  retailerId: string,
  item: NormalizedCatalogueItem
): Promise<ProductResolution> {
  const cataloguePack = getCataloguePack(item);

  /*
   * --------------------------------------------------------------------------
   * 1. GTIN
   * --------------------------------------------------------------------------
   */

  if (item.gtin) {
    const match =
      await api.prisma.productIdentifier.findFirst({
        where: {
          type: "GTIN",
          value: item.gtin,
        },
        select: {
          productId: true,
        },
      });

    if (match) {
      return {
        productId: match.productId,
        confidence: 1,
        method: "GTIN",
        status: "CONFIRMED",
        reason:
          "Catalogue GTIN exactly matched an existing product identifier.",
      };
    }
  }

  /*
   * --------------------------------------------------------------------------
   * 2. Barcode
   * --------------------------------------------------------------------------
   */

  if (item.barcode) {
    const match =
      await api.prisma.productIdentifier.findFirst({
        where: {
          type: "BARCODE",
          value: item.barcode,
        },
        select: {
          productId: true,
        },
      });

    if (match) {
      return {
        productId: match.productId,
        confidence: 1,
        method: "BARCODE",
        status: "CONFIRMED",
        reason:
          "Catalogue barcode exactly matched an existing product identifier.",
      };
    }
  }

  /*
   * --------------------------------------------------------------------------
   * 3. Retailer SKU
   * --------------------------------------------------------------------------
   *
   * SKU is only trusted when it belongs to the same retailer.
   */

  if (item.retailerSku) {
    const match =
      await api.prisma.productRetailer.findFirst({
        where: {
          retailerId,
          retailerSku: item.retailerSku,
        },
        select: {
          productId: true,
        },
      });

    if (match) {
      return {
        productId: match.productId,
        confidence: 0.99,
        method: "RETAILER_SKU",
        status: "CONFIRMED",
        reason:
          "Catalogue retailer SKU matched an existing product-retailer association.",
      };
    }
  }

  /*
   * --------------------------------------------------------------------------
   * 4. Exact product name
   * --------------------------------------------------------------------------
   */

  const exactNameCandidates =
    await api.prisma.product.findMany({
      where: {
        name: item.rawName,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        brand: true,
        unit: true,
      },
      take: 10,
    });

  /*
   * An exact-name match is only safe when exactly one active product
   * has that name AND its pack information is compatible.
   */
  const compatibleExactNameCandidates =
    exactNameCandidates.filter((candidate) =>
      packsAreCompatible(
        cataloguePack,
        getProductPack(candidate)
      )
    );

  const exactNameMatch =
    compatibleExactNameCandidates.length === 1
      ? compatibleExactNameCandidates[0]
      : null;

  if (exactNameMatch) {
    return {
      productId: exactNameMatch.id,
      confidence: 0.95,
      method: "EXACT_NAME",
      status: "CONFIRMED",
      reason:
        "Catalogue product name exactly matched one active BargaiNest product with compatible pack information.",
    };
  }

  /*
   * --------------------------------------------------------------------------
   * 5. Normalised name
   * --------------------------------------------------------------------------
   *
   * MySQL does not give us a portable application-level normalised-name
   * column on Product, so we perform a bounded candidate search and compare
   * normalised names in application code.
   */

  const nameCandidates =
    await api.prisma.product.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        brand: true,
        unit: true,
      },
      take: 500,
    });

  const normalizedName =
    normalizeText(item.normalizedName);

  const normalizedMatches =
    nameCandidates.filter(
      (candidate) =>
        normalizeText(candidate.name) ===
          normalizedName &&
        packsAreCompatible(
          cataloguePack,
          getProductPack(candidate)
        )
    );

  /*
   * Normalised-name matching is confirmed only when exactly
   * one compatible candidate remains.
   */
  const normalizedNameMatch =
    normalizedMatches.length === 1
      ? normalizedMatches[0]
      : null;

  if (normalizedNameMatch) {
    return {
      productId: normalizedNameMatch.id,
      confidence: 0.9,
      method: "NORMALIZED_NAME",
      status: "CONFIRMED",
      reason:
        "Normalised catalogue name matched one active BargaiNest product with compatible pack information.",
    };
  }

  /*
   * --------------------------------------------------------------------------
   * 6. Brand + name + pack/unit
   * --------------------------------------------------------------------------
   */

  const brandNameCandidates =
    nameCandidates.filter((candidate) => {
      const candidateName =
        normalizeText(candidate.name);

      const catalogueName =
        normalizeText(item.rawName);

      const nameMatches =
        candidateName === catalogueName;

      const brandMatches =
        item.brand &&
        candidate.brand &&
        normalizeText(item.brand) ===
          normalizeText(candidate.brand);

      const unitMatches =
        item.unit &&
        candidate.unit &&
        normalizeText(item.unit) ===
          normalizeText(candidate.unit);

      const packMatches =
        packsAreCompatible(
          cataloguePack,
          getProductPack(candidate)
        );

      return (
        nameMatches &&
        packMatches &&
        Boolean(brandMatches || unitMatches)
      );
    });

  /*
   * Brand/name/unit matching is also confirmed only when exactly one
   * compatible candidate remains.
   */
  const brandNameMatch =
    brandNameCandidates.length === 1
      ? brandNameCandidates[0]
      : null;

  if (brandNameMatch) {
    return {
      productId: brandNameMatch.id,
      confidence: 0.92,
      method: "BRAND_NAME_SIZE",
      status: "CONFIRMED",
      reason:
        "Catalogue name matched an active product with compatible brand, unit and pack information.",
    };
  }

  /*
   * --------------------------------------------------------------------------
   * 7. Fuzzy candidate
   * --------------------------------------------------------------------------
   *
   * A fuzzy match is NEVER confirmed automatically.
   */

  let bestCandidate:
    | {
        id: string;
        name: string;
        similarity: number;
      }
    | null = null;

  for (const candidate of nameCandidates) {
    const packsCompatible =
      packsAreCompatible(
        cataloguePack,
        getProductPack(candidate)
      );

    if (!packsCompatible) {
      continue;
    }

    const similarity =
      calculateNameSimilarity(
        item.rawName,
        candidate.name
      );

    if (
      similarity >= 0.8 &&
      (!bestCandidate ||
        similarity > bestCandidate.similarity)
    ) {
      bestCandidate = {
        id: candidate.id,
        name: candidate.name,
        similarity,
      };
    }
  }

  if (bestCandidate) {
    return {
      productId: bestCandidate.id,
      confidence: Math.round(
        bestCandidate.similarity * 100
      ) / 100,
      method: "FUZZY",
      status: "PROPOSED",
      reason:
        `Fuzzy name similarity produced a candidate match of ${bestCandidate.similarity.toFixed(2)} with compatible pack information. Manual or higher-confidence verification is required.`,
    };
  }

  /*
   * --------------------------------------------------------------------------
   * 8. No match
   * --------------------------------------------------------------------------
   */

  return {
    productId: null,
    confidence: 0,
    method: "MANUAL",
    status: "PROPOSED",
    reason:
      "No sufficiently reliable existing product match was found.",
  };
}
