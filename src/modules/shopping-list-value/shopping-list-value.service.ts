import type { FastifyInstance } from "fastify";

import type { CataloguePriceLookupRegistry } from "../retail-catalogue/retail-catalogue.price-lookup.registry.js";

import {
  createShoppingIntent,
} from "../shopping-intent/shopping-intent.service.js";

import {
  lookupLiveRetailerOffersExpanded,
} from "../retailer-offers/retailer-offer.live.service.js";

import type {
  RetailerOffer,
} from "../retailer-offers/retailer-offer.types.js";

import type {
  ShoppingListRetailerBasket,
  ShoppingListValueItem,
  ShoppingListValueResult,
  ShoppingListMixedBasketAssignment,
} from "./shopping-list-value.types.js";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTargetStatus(
  bestUnitPrice: number | null,
  targetPrice: number | null,
): ShoppingListValueItem["targetStatus"] {
  if (bestUnitPrice === null) return "NO_PRICE";
  if (targetPrice === null) return "NO_TARGET";
  if (bestUnitPrice < targetPrice) return "BELOW_TARGET";
  if (bestUnitPrice === targetPrice) return "AT_TARGET";
  return "ABOVE_TARGET";
}

interface RetailerBasketAccumulator {
  retailerId: string;
  retailerName: string;
  itemCount: number;
  basketValue: number;
  currency: string;
}

interface ComparableOffer {
  offer: RetailerOffer;
  matchScore: number;
}

function selectBestOfferPerRetailer(
  offers: ComparableOffer[],
): ComparableOffer[] {
  const bestByRetailer =
    new Map<string, ComparableOffer>();

  for (const candidate of offers) {
    const retailerId =
      candidate.offer.retailer.id;

    const existing =
      bestByRetailer.get(retailerId);

    if (!existing) {
      bestByRetailer.set(
        retailerId,
        candidate,
      );
      continue;
    }

    const candidatePrice =
      candidate.offer.price;

    const existingPrice =
      existing.offer.price;

    if (
      candidatePrice < existingPrice ||
      (
        candidatePrice === existingPrice &&
        candidate.matchScore >
          existing.matchScore
      )
    ) {
      bestByRetailer.set(
        retailerId,
        candidate,
      );
    }
  }

  return Array.from(
    bestByRetailer.values(),
  );
}

export interface EvaluateShoppingListValueOptions {
  /** The shopper's own South African province, when known. */
  province?: string;
  /** The shopper's specific Pick n Pay store code, when known. */
  storeCode?: string;
  /** Shopper latitude used by retailer-specific nearest-branch resolution. */
  latitude?: number;
  /** Shopper longitude used by retailer-specific nearest-branch resolution. */
  longitude?: number;
}

export async function evaluateShoppingListValue(
  api: FastifyInstance,
  userId: string,
  shoppingListId: string,
  cataloguePriceLookupRegistry: CataloguePriceLookupRegistry,
  options: EvaluateShoppingListValueOptions = {},
): Promise<ShoppingListValueResult | null> {
  const shoppingList =
    await api.prisma.shoppingList.findFirst({
      where: {
        id: shoppingListId,
        userId,
      },
      include: {
        items: {
          where: {
            status: "ACTIVE",
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

  if (!shoppingList) {
    return null;
  }

  const items: ShoppingListValueItem[] = [];
  const mixedBasketAssignments: ShoppingListMixedBasketAssignment[] = [];

  let bestKnownBasketValue = 0;
  let potentialSavings = 0;

  /*
   * Product is deliberately not required for the live path.
   *
   * The shopping-list description is converted directly into
   * a shopping intent and resolved against current retailer
   * offers.
   */
  /*
   * This pipeline is deliberately live-retailer-offer-based, not tied
   * to an internal Product record (see the comment at each item push
   * below) — so "no product match" and "no current price" are the
   * same failure mode here. This field used to be a hardcoded 0 that
   * was never incremented, which silently disabled the frontend's
   * "items needing a match" panel — it would never show even when
   * items genuinely had no price. Wiring it to the real count fixes
   * that without needing a frontend change to the summary contract.
   */
  let itemsWithoutPrice = 0;
  let comparableItems = 0;
  let currency: string | null = null;

  /*
   * Each retailer accumulates one compatible current offer
   * for each comparable shopping-list item.
   */
  const retailerBaskets = new Map<
    string,
    RetailerBasketAccumulator
  >();

  for (const item of shoppingList.items) {
    const quantity = Number(item.quantity);

    const targetPrice =
      item.targetPrice !== null
        ? Number(item.targetPrice)
        : null;

    const intent =
      createShoppingIntent({
        text: item.description,
        quantity,
        targetPrice,
      });

    const liveResult =
      await lookupLiveRetailerOffersExpanded(
        api,
        {
          countryCode: "ZA",
          ...(options.province ? { province: options.province } : {}),
          ...(options.latitude !== undefined
            ? { latitude: options.latitude }
            : {}),
          ...(options.longitude !== undefined
            ? { longitude: options.longitude }
            : {}),
        },
        intent,
        cataloguePriceLookupRegistry,
        {
          ...(options.province ? { province: options.province } : {}),
          ...(options.storeCode ? { storeCode: options.storeCode } : {}),
        },
      );

    api.log?.info?.({
      event: "BN_LIVE_PRICE_LOOKUP",
      lookup: {
        sourcesAttempted: liveResult.lookup.sourcesAttempted,
        sourcesMatched: liveResult.lookup.sourcesMatched,
        sourcesFailed: liveResult.lookup.sourcesFailed,
        attempts: liveResult.lookup.attempts.map((attempt) => ({
          sourceCode: attempt.sourceCode,
          adapterKey: attempt.adapterKey,
          status: attempt.status,
          itemsReturned: attempt.itemsReturned,
          error: attempt.error ?? null,
        })),
      },
    }, "BN live retailer price lookup result");

    api.log?.info?.({
      event: "BN_MATCHED_OFFERS_DIAGNOSTIC",
      intent: {
        originalText: intent.originalText,
        normalizedText: intent.normalizedText,
        attributes: intent.attributes,
      },
      matchedOffersCount: liveResult.matchedOffers.length,
      matchedOffers: liveResult.matchedOffers.slice(0, 10).map((matched) => ({
        retailer: matched.offer.retailer,
        name: matched.offer.name,
        price: matched.offer.price,
        matchScore: matched.matchScore,
        matchQuality: matched.matchQuality,
        matchReason: matched.matchReason,
      })),
    }, "BN matched offers diagnostic");

    const compatibleOffers =
      liveResult.matchedOffers
        .filter(
          (matched) =>
            matched.matchScore > 0 &&
            Number.isFinite(
              matched.offer.price,
            ) &&
            matched.offer.price >= 0,
        )
        .map(
          (matched) => ({
            offer: matched.offer,
            matchScore:
              matched.matchScore,
          }),
        );

    const bestOffersPerRetailer =
      selectBestOfferPerRetailer(
        compatibleOffers,
      );

    if (!bestOffersPerRetailer.length) {
      itemsWithoutPrice += 1;

      items.push({
        itemId: item.id,
        description: item.description,
        quantity,
        targetPrice,
        productId: null,
        productName: null,
        comparable: false,
        bestPrice: null,
        bestRetailerId: null,
        bestRetailerName: null,
        bestObservedAt: null,
        bestCurrency: null,
        bestIsPromotion: false,
        bestPromotionText: null,
        bestAvailability: null,
        lineValue: null,
        potentialSaving: null,
        targetStatus: "NO_PRICE",
        confidence: null,
      });

      continue;
    }

    /*
     * Only compare offers in the same currency.
     *
     * The first valid offer establishes the comparison
     * currency for this shopping-list item.
     */
    const comparisonCurrency =
      bestOffersPerRetailer[0]!.offer.currency;

    const comparableOffers =
      bestOffersPerRetailer.filter(
        ({ offer }) =>
          offer.currency ===
          comparisonCurrency,
      );

    if (!comparableOffers.length) {
      itemsWithoutPrice += 1;

      items.push({
        itemId: item.id,
        description: item.description,
        quantity,
        targetPrice,
        productId: null,
        productName: null,
        comparable: false,
        bestPrice: null,
        bestRetailerId: null,
        bestRetailerName: null,
        bestObservedAt: null,
        bestCurrency: null,
        bestIsPromotion: false,
        bestPromotionText: null,
        bestAvailability: null,
        lineValue: null,
        potentialSaving: null,
        targetStatus: "NO_PRICE",
        confidence: null,
      });

      continue;
    }

    /*
     * Find the best compatible current offer for this shopping-list
     * item. Previously purely price-based -- the cheapest offer won
     * even if it was confirmed OUT_OF_STOCK and a slightly pricier
     * in-stock alternative existed. Now availability-aware: an
     * available (IN_STOCK, LIMITED, or UNKNOWN -- absence of evidence
     * isn't evidence of absence) offer is always preferred over a
     * cheaper OUT_OF_STOCK one. If every compatible offer is
     * confirmed out of stock, the cheapest one is still returned
     * (with its real availability status attached) rather than
     * treating the item as having no price at all -- a stale-but-
     * priced result is more useful than none, as long as it's labeled
     * honestly.
     */
    const bestMatch =
      comparableOffers.reduce(
        (best, current) => {
          const bestAvailable = best.offer.availability !== "OUT_OF_STOCK";
          const currentAvailable = current.offer.availability !== "OUT_OF_STOCK";

          if (currentAvailable !== bestAvailable) {
            return currentAvailable ? current : best;
          }

          return current.offer.price < best.offer.price ? current : best;
        },
      );

    const bestOffer =
      bestMatch.offer;

    const bestUnitPrice =
      bestOffer.price;

    const lineValue =
      roundMoney(
        bestUnitPrice * quantity,
      );

    mixedBasketAssignments.push({
      itemId: item.id,
      description: item.description,
      retailerId: bestOffer.retailer.id,
      retailerName: bestOffer.retailer.name,
      unitPrice: bestUnitPrice,
      quantity,
      lineValue,
    });

    /*
     * Build each retailer's basket using exactly one
     * compatible current offer for this item.
     */
    for (const matched of comparableOffers) {
      const offer =
        matched.offer;

      const retailerId =
        offer.retailer.id;

      const retailerName =
        offer.retailer.name;

      const offerLineValue =
        roundMoney(
          offer.price * quantity,
        );

      const existing =
        retailerBaskets.get(
          retailerId,
        );

      if (existing) {
        existing.itemCount += 1;

        existing.basketValue =
          roundMoney(
            existing.basketValue +
              offerLineValue,
          );
      } else {
        retailerBaskets.set(
          retailerId,
          {
            retailerId,
            retailerName,
            itemCount: 1,
            basketValue:
              offerLineValue,
            currency:
              offer.currency,
          },
        );
      }
    }

    /*
     * Potential saving is based on the item's target price
     * when one has been supplied.
     */
    const itemSaving =
      targetPrice !== null &&
      targetPrice > bestUnitPrice
        ? roundMoney(
            (
              targetPrice -
              bestUnitPrice
            ) * quantity,
          )
        : 0;

    bestKnownBasketValue =
      roundMoney(
        bestKnownBasketValue +
          lineValue,
      );

    potentialSavings =
      roundMoney(
        potentialSavings +
          itemSaving,
      );

    comparableItems += 1;

    currency ??=
      comparisonCurrency;

    items.push({
      itemId: item.id,
      description: item.description,
      quantity,
      targetPrice,

      /*
       * Product is intentionally null. The live source of
       * truth is the current retailer offer, not a local
       * Product record.
       */
      productId: null,
      productName: null,

      comparable: true,

      bestPrice:
        bestUnitPrice,

      bestRetailerId:
        bestOffer.retailer.id,

      bestRetailerName:
        bestOffer.retailer.name,

      bestObservedAt:
        new Date(
          bestOffer.source.observedAt,
        ),

      bestCurrency:
        bestOffer.currency,

      bestIsPromotion:
        bestOffer.isPromotion,

      bestPromotionText:
        bestOffer.promotionText ?? null,

      bestAvailability:
        bestOffer.availability,

      lineValue,

      potentialSaving:
        itemSaving,

      targetStatus:
        getTargetStatus(
          bestUnitPrice,
          targetPrice,
        ),

      confidence:
        bestOffer.confidence,
    });
  }

  /*
   * Complete baskets — a retailer with a compatible current offer for
   * EVERY comparable item — are what "basket savings" and "cheapest
   * retailer" mean below, matching the existing frontend copy
   * ("Compared with the highest complete basket"). This is unchanged
   * from before.
   */
  const allBasketsFromMap =
    Array.from(retailerBaskets.values());

  const completeRetailerBaskets =
    allBasketsFromMap
      .filter(
        (basket) =>
          basket.itemCount ===
          comparableItems,
      )
      .sort(
        (a, b) =>
          a.basketValue -
          b.basketValue,
      );

  /*
   * Previously, retailers missing even one comparable item were
   * dropped entirely — never returned to the caller at all. The
   * frontend was already written to display "X of N comparable
   * items" per basket (a signal it expected partial baskets to
   * exist), but the backend never sent one. Fixed: every retailer
   * with at least one comparable offer is returned, complete or not,
   * sorted so complete baskets surface first (cheapest first within
   * each group) — a shopper can now see "this retailer is missing one
   * item but is otherwise your cheapest option" instead of that
   * retailer silently vanishing from the comparison.
   */
  const retailerBasketResults: ShoppingListRetailerBasket[] =
    allBasketsFromMap
      .map((basket) => ({
        retailerId: basket.retailerId,
        retailerName: basket.retailerName,
        itemCount: basket.itemCount,
        basketValue: roundMoney(basket.basketValue),
        currency: basket.currency,
        isComplete: basket.itemCount === comparableItems,
        missingItemCount: Math.max(0, comparableItems - basket.itemCount),
      }))
      .sort((a, b) => {
        if (a.isComplete !== b.isComplete) {
          return a.isComplete ? -1 : 1;
        }
        return a.basketValue - b.basketValue;
      });

  const cheapestRetailer =
    completeRetailerBaskets[0] ??
    null;

  const highestRetailerBasketValue =
    completeRetailerBaskets.length > 0
      ? Math.max(
          ...completeRetailerBaskets.map(
            (basket) =>
              basket.basketValue,
          ),
        )
      : null;

  const basketSavings =
    cheapestRetailer !== null &&
    highestRetailerBasketValue !== null
      ? roundMoney(
          highestRetailerBasketValue -
            cheapestRetailer.basketValue,
        )
      : 0;

  /*
   * The true optimal breakdown: buy each item at whichever retailer
   * currently has it cheapest, regardless of retailer. This was
   * always computed internally as bestKnownBasketValue, but never
   * exposed as an actual actionable basket — just a single number a
   * shopper couldn't act on without knowing which item to buy where.
   */
  const roundedMixedTotal = roundMoney(bestKnownBasketValue);
  const mixedBasketRetailerIds = new Set(
    mixedBasketAssignments.map((assignment) => assignment.retailerId),
  );
  const mixedBasket =
    comparableItems > 0
      ? {
          totalValue: roundedMixedTotal,
          currency,
          retailerCount: mixedBasketRetailerIds.size,
          assignments: mixedBasketAssignments,
          savingsVsBestCompleteBasket:
            cheapestRetailer !== null
              ? Math.max(0, roundMoney(cheapestRetailer.basketValue - roundedMixedTotal))
              : 0,
        }
      : null;

  api.log?.info?.({ event: "BN_FINAL_SERVICE_ITEMS", items: items.map((item) => ({ description: item.description, comparable: item.comparable, bestPrice: item.bestPrice, bestRetailerId: item.bestRetailerId, bestRetailerName: item.bestRetailerName, bestCurrency: item.bestCurrency })) }, "BN final shopping-list-value service items");
  return {
    shoppingListId:
      shoppingList.id,

    shoppingListName:
      shoppingList.name,

    items,

    summary: {
      itemsAnalysed:
        shoppingList.items.length,

      itemsWithoutProduct: itemsWithoutPrice,

      itemsWithoutPrice,

      comparableItems,

      bestKnownBasketValue:
        roundMoney(
          bestKnownBasketValue,
        ),

      potentialSavings:
        roundMoney(
          potentialSavings,
        ),

      retailerBaskets:
        retailerBasketResults,

      cheapestRetailerId:
        cheapestRetailer?.retailerId ??
        null,

      cheapestRetailerName:
        cheapestRetailer?.retailerName ??
        null,

      highestRetailerBasketValue,

      basketSavings,

      mixedBasket,

      currency,
    },
  };
}
