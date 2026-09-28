import type { FastifyInstance } from "fastify";

import {
  lookupCurrentCataloguePrices,
  type CataloguePriceLookupResult,
} from "../retail-catalogue/retail-catalogue.price-lookup.service.js";

import type { CataloguePriceLookupRegistry } from "../retail-catalogue/retail-catalogue.price-lookup.registry.js";

import type { CatalogueSourceSelectionInput } from "../retail-catalogue/retail-catalogue.source-discovery.service.js";

import type { ShoppingIntent } from "../shopping-intent/shopping-intent.types.js";
import { expandShoppingIntent } from "../shopping-intent/shopping-intent.expansion.js";

import {
  mapCatalogueMatchesToRetailerOffers,
} from "./retailer-offer.mapper.js";

import {
  matchOffersToIntent,
} from "./retailer-offer.service.js";

import type {
  MatchedOffer,
  RetailerOffer,
  RetailerOfferContext,
} from "./retailer-offer.types.js";

export interface LiveRetailerOfferLookupResult {
  intent: ShoppingIntent;
  offers: RetailerOffer[];
  matchedOffers: MatchedOffer[];
  lookup: CataloguePriceLookupResult;
}

function buildLookupQuery(
  intent: ShoppingIntent,
) {
  return {
    name: intent.normalizedText,
    ...(intent.attributes.brand
      ? { brand: intent.attributes.brand }
      : {}),
    ...(intent.attributes.packSize
      ? { packSize: intent.attributes.packSize }
      : {}),
    ...(intent.attributes.unit
      ? { unit: intent.attributes.unit }
      : {}),
  };
}

function buildOfferContext(
  intent: ShoppingIntent,
  offer: RetailerOffer,
): RetailerOfferContext {
  return {
    retailerId: offer.retailer.id,
    retailerCode: offer.retailer.code,
    retailerName: offer.retailer.name,
    intent,
  };
}

export async function lookupLiveRetailerOffers(
  api: FastifyInstance,
  sourceSelection: CatalogueSourceSelectionInput,
  intent: ShoppingIntent,
  registry: CataloguePriceLookupRegistry,
  /**
   * The shopper's own South African province, when known. Threaded
   * straight into the lookup query rather than onto the intent
   * itself -- province describes the shopper, not what they're
   * looking for, so it doesn't belong on ShoppingIntent. Currently
   * only Woolworths' Constructor.io adapter uses it (see
   * CONSTRUCTOR-IO-PRICE-LOOKUP.md); every other adapter ignores it.
   */
  province?: string,
  /**
   * The shopper's specific Pick n Pay store code, when known -- same
   * reasoning as province above. See PNP-HYBRIS-PRICE-LOOKUP.md.
   */
  storeCode?: string,
): Promise<LiveRetailerOfferLookupResult> {
  const lookup =
    await lookupCurrentCataloguePrices(
      api,
      sourceSelection,
      {
        ...buildLookupQuery(intent),
        ...(province ? { province } : {}),
        ...(storeCode ? { storeCode } : {}),
      },
      registry,
    );

  const offers =
    mapCatalogueMatchesToRetailerOffers(
      lookup.matches,
    );

  const matchedOffers: MatchedOffer[] = [];

  for (const offer of offers) {
    const context =
      buildOfferContext(intent, offer);

    const matches =
      matchOffersToIntent(
        context,
        [offer],
      );

    matchedOffers.push(...matches);
  }

  matchedOffers.sort(
    (a, b) => b.matchScore - a.matchScore,
  );

  return {
    intent,
    offers,
    matchedOffers,
    lookup,
  };
}

/**
 * Returns only offers that the matcher considers usable
 * for live price comparison.
 *
 * Explicitly incompatible offers receive a score of 0 and
 * remain available in the diagnostic matchedOffers result,
 * but must not enter Best Basket calculations.
 */
export function getCompatibleLiveOffers(
  result: LiveRetailerOfferLookupResult,
): RetailerOffer[] {
  return result.matchedOffers
    .filter(
      (matched) =>
        matched.matchScore > 0,
    )
    .map(
      (matched) =>
        matched.offer,
    );
}

// ---------------------------------------------------------------------------
// Product-equivalence-aware lookup
// ---------------------------------------------------------------------------

export interface LookupLiveRetailerOffersExpandedOptions {
  /** Stop trying further equivalence variants once offers have been
   *  found from at least this many distinct retailers. Balances
   *  basket coverage against the real cost of each variant search
   *  (a Playwright-driven live search per retailer per variant). */
  minRetailersSatisfied?: number;
  /** Hard cap on how many variants are tried regardless of coverage,
   *  so a category with many equivalence variants can't runaway into
   *  an unbounded number of live searches. */
  maxVariants?: number;
  /** The shopper's own South African province, when known -- see the
   *  same option on lookupLiveRetailerOffers(). Passed through
   *  unchanged to every variant tried. */
  province?: string;
  /** The shopper's specific Pick n Pay store code, when known -- see
   *  the same option on lookupLiveRetailerOffers(). Passed through
   *  unchanged to every variant tried. */
  storeCode?: string;
}

const DEFAULT_MIN_RETAILERS_SATISFIED = 3;
const DEFAULT_MAX_VARIANTS = 4;

/**
 * Fixes the exact gap the project's own testing found: a generic term
 * like "milk" was only ever searched as the literal string "milk" —
 * never expanded into concrete product variants ("Full Cream Milk
 * 1L", etc.) — while "sugar"/"bread" happened to work because those
 * generic terms are close enough to real product names. This tries
 * each equivalence variant (shopping-intent.expansion.ts) in turn,
 * merging results and stopping early once enough retailers have
 * answered, rather than exhaustively searching every variant against
 * every retailer regardless of cost.
 *
 * For a SPECIFIC intent (or a generic one with no matching
 * equivalence group), this tries exactly one variant — the intent's
 * own text — so behaviour is identical to lookupLiveRetailerOffers()
 * in those cases. lookupLiveRetailerOffers() itself is untouched;
 * this is purely additive.
 */
export async function lookupLiveRetailerOffersExpanded(
  api: FastifyInstance,
  sourceSelection: CatalogueSourceSelectionInput,
  intent: ShoppingIntent,
  registry: CataloguePriceLookupRegistry,
  options: LookupLiveRetailerOffersExpandedOptions = {},
): Promise<LiveRetailerOfferLookupResult & { variantsTried: number }> {
  const minRetailersSatisfied = options.minRetailersSatisfied ?? DEFAULT_MIN_RETAILERS_SATISFIED;
  const maxVariants = options.maxVariants ?? DEFAULT_MAX_VARIANTS;

  const terms = expandShoppingIntent(intent).slice(0, maxVariants);

  const bestByRetailer = new Map<string, MatchedOffer>();
  const allOffers: RetailerOffer[] = [];
  const lookups: CataloguePriceLookupResult[] = [];
  let variantsTried = 0;

  for (const term of terms) {
    variantsTried += 1;

    const variantIntent: ShoppingIntent = { ...intent, normalizedText: term.query };
    const result = await lookupLiveRetailerOffers(api, sourceSelection, variantIntent, registry, options.province, options.storeCode);

    lookups.push(result.lookup);
    allOffers.push(...result.offers);

    for (const matched of result.matchedOffers) {
      if (matched.matchScore <= 0) continue;
      const existing = bestByRetailer.get(matched.offer.retailer.id);
      if (!existing || matched.matchScore > existing.matchScore) {
        bestByRetailer.set(matched.offer.retailer.id, matched);
      }
    }

    if (bestByRetailer.size >= minRetailersSatisfied) {
      break;
    }
  }

  const matchedOffers = Array.from(bestByRetailer.values()).sort(
    (a, b) => b.matchScore - a.matchScore,
  );

  // Merge the per-variant lookup diagnostics into one, so callers get
  // a single coherent attempts/errors picture rather than needing to
  // inspect each variant's lookup separately.
  const mergedLookup: CataloguePriceLookupResult = {
    items: lookups.flatMap((l) => l.items),
    matches: lookups.flatMap((l) => l.matches),
    attempts: lookups.flatMap((l) => l.attempts),
    matchedSourceId: lookups.find((l) => l.matchedSourceId)?.matchedSourceId ?? null,
    matchedSourceCode: lookups.find((l) => l.matchedSourceCode)?.matchedSourceCode ?? null,
    sourcesAttempted: Math.max(...lookups.map((l) => l.sourcesAttempted), 0),
    sourcesMatched: bestByRetailer.size,
    sourcesFailed: lookups.reduce((sum, l) => sum + l.sourcesFailed, 0),
  };

  return {
    intent,
    offers: allOffers,
    matchedOffers,
    lookup: mergedLookup,
    variantsTried,
  };
}
