import { describe, expect, it } from "vitest";
import {
  PICK_N_PAY_PRICE_EXTRACTOR,
  makeWoolworthsPriceExtractor,
  resolveWoolworthsZoneFromProvince,
} from "../src/modules/retail-catalogue/adapters/constructor-io-price-lookup.adapter.js";

/**
 * Pick n Pay's and part of Woolworths' fixtures below are taken from
 * REAL live responses (2026-09-21, query "milk", via
 * scripts/probe-constructor-io.mjs) -- not constructed samples,
 * marked "REAL DATA" in each test name. Pick n Pay's real response
 * caught a real bug: an earlier version of this extractor treated ANY
 * `priceConditionType` as a promotion flag, but the real data shows
 * `priceConditionType: "PROMOTION"` on almost every result, including
 * ones with no discount at all. Only `promotionDisplayType`/
 * `promotionBadgeDisplay` being genuinely present indicates a real
 * loyalty promotion.
 *
 * The promo-arithmetic tests further below remain CONSTRUCTED --
 * the real Woolworths response captured so far happened to be for a
 * non-promoted product with no `promo` field at all, so that specific
 * parsing logic is still untested against real data. See
 * CONSTRUCTOR-IO-PRICE-LOOKUP.md for the current state of what's
 * confirmed vs. still open for each retailer.
 */

describe("PICK_N_PAY_PRICE_EXTRACTOR", () => {
  it("extracts price from priceValue", () => {
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({ priceValue: 34.99 });
    expect(result.price).toBe(34.99);
  });

  it("treats a numeric-string priceValue the same as a number", () => {
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({ priceValue: "34.99" });
    expect(result.price).toBe(34.99);
  });

  it("returns null price when priceValue is missing entirely, rather than inventing one", () => {
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({});
    expect(result.price).toBeNull();
  });

  it("REAL DATA: does NOT flag a promotion just because priceConditionType is 'PROMOTION' -- this is the bug the live response caught", () => {
    // Taken directly from the real response's top-level result: a
    // R99.99 milk price with priceConditionType "PROMOTION" but no
    // promotionDisplayType, promotionBadgeDisplay, or oldPriceValue
    // at all -- i.e. not actually on any special deal.
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({
      priceValue: 99.99,
      priceConditionType: "PROMOTION",
    });
    expect(result.isPromotion).toBe(false);
    expect(result.price).toBe(99.99);
  });

  it("REAL DATA: flags a genuine Smart Shopper promotion correctly", () => {
    // Taken directly from one of the real response's variations that
    // WAS genuinely on promotion.
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({
      priceValue: 94.99,
      oldPriceValue: 99.99,
      priceConditionType: "PROMOTION",
      promotionDisplayType: "SMART_SHOPPER",
      promotionBadgeDisplay: "SMART SHOPPER",
      promotionTextMessage: "R94.99 ",
    });
    expect(result.isPromotion).toBe(true);
    expect(result.price).toBe(94.99);
    expect(result.wasPrice).toBe(99.99);
  });

  it("does not flag a promotion when no promotion field is present at all", () => {
    const result = PICK_N_PAY_PRICE_EXTRACTOR.extractPrice({ priceValue: 24.99 });
    expect(result.isPromotion).toBe(false);
  });

  it("has no department filter (not reported as a mixed index)", () => {
    expect(PICK_N_PAY_PRICE_EXTRACTOR.isRelevantDepartment({ prodtype: "Clothing" })).toBe(true);
  });
});

describe("resolveWoolworthsZoneFromProvince", () => {
  it("CONFIRMED: maps the three verified provinces correctly", () => {
    expect(resolveWoolworthsZoneFromProvince("Western Cape", "p30")).toBe("p10");
    expect(resolveWoolworthsZoneFromProvince("Gauteng", "p30")).toBe("p30");
    expect(resolveWoolworthsZoneFromProvince("KwaZulu-Natal", "p30")).toBe("p60");
  });

  it("is case-insensitive and tolerant of spacing/hyphen variants", () => {
    expect(resolveWoolworthsZoneFromProvince("western cape", "p60")).toBe("p10");
    expect(resolveWoolworthsZoneFromProvince("WESTERN CAPE", "p60")).toBe("p10");
    expect(resolveWoolworthsZoneFromProvince("kwazulu natal", "p10")).toBe("p60");
    expect(resolveWoolworthsZoneFromProvince("kwazulu_natal", "p10")).toBe("p60");
  });

  it("accepts common short codes", () => {
    expect(resolveWoolworthsZoneFromProvince("WC", "p30")).toBe("p10");
    expect(resolveWoolworthsZoneFromProvince("GP", "p10")).toBe("p30");
    expect(resolveWoolworthsZoneFromProvince("KZN", "p10")).toBe("p60");
  });

  it("falls back to the given default for no province at all", () => {
    expect(resolveWoolworthsZoneFromProvince(undefined, "p60")).toBe("p60");
  });

  it("HONESTY CHECK: does not guess at the six unconfirmed provinces -- falls back to the default instead of inventing a mapping", () => {
    // These six are deliberately NOT mapped -- see the doc comment on
    // resolveWoolworthsZoneFromProvince for why guessing here would be
    // worse than an honest fallback.
    const unconfirmedProvinces = [
      "Eastern Cape",
      "Free State",
      "Limpopo",
      "Mpumalanga",
      "North West",
      "Northern Cape",
    ];
    for (const province of unconfirmedProvinces) {
      expect(resolveWoolworthsZoneFromProvince(province, "p30")).toBe("p30");
    }
  });

  it("falls back to the default for garbage/unrecognised input rather than throwing", () => {
    expect(resolveWoolworthsZoneFromProvince("Neverland", "p10")).toBe("p10");
    expect(resolveWoolworthsZoneFromProvince("", "p30")).toBe("p30");
  });
});

describe("Woolworths price extractor — per-call province resolution", () => {
  it("uses the province on the QUERY, not just the extractor's configured default", () => {
    const extractor = makeWoolworthsPriceExtractor("p30"); // default: Gauteng
    const realData = { p10: 38.99, p30: 40.99, p60: 39.99 };

    // No province supplied -- falls back to the configured default (p30/Gauteng).
    expect(extractor.extractPrice(realData).price).toBe(40.99);

    // A Western Cape shopper on the SAME extractor instance gets the
    // Western Cape price instead -- proving this resolves per call,
    // not once at construction time.
    expect(extractor.extractPrice(realData, { province: "Western Cape" }).price).toBe(38.99);

    // A KwaZulu-Natal shopper, same instance again.
    expect(extractor.extractPrice(realData, { province: "KZN" }).price).toBe(39.99);
  });

  it("an unrecognised province on the query still falls back to the configured default, not an error", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const realData = { p10: 38.99, p30: 40.99, p60: 39.99 };
    expect(extractor.extractPrice(realData, { province: "Mars" }).price).toBe(39.99);
  });
});

describe("Woolworths price extractor", () => {
  it("REAL DATA: extracts real zone prices from an actual live response (2026-09-21, 'Fresh Full Cream Ayrshire Milk 2 L')", () => {
    // Taken directly from a real response via
    // scripts/probe-constructor-io.mjs against Woolworths' real key
    // and dedicated host (wpkmgeuco-zone.cnstrc.com). p10 genuinely
    // differs from p30/p60 on this real product (45.99 vs 39.99) --
    // the first real data point on how these zones actually relate.
    const realData = { p10: 45.99, p30: 39.99, p60: 39.99, p10_wp: 0, p30_wp: 0, p60_wp: 0, prodtype: "Food" };

    expect(makeWoolworthsPriceExtractor("p10").extractPrice(realData).price).toBe(45.99);
    expect(makeWoolworthsPriceExtractor("p30").extractPrice(realData).price).toBe(39.99);
    expect(makeWoolworthsPriceExtractor("p60").extractPrice(realData).price).toBe(39.99);
  });

  it("REAL DATA: a non-promoted item's _wp fields are all 0, correctly yielding no wasPrice", () => {
    const realData = { p10: 45.99, p30: 39.99, p60: 39.99, p10_wp: 0, p30_wp: 0, p60_wp: 0 };
    const result = makeWoolworthsPriceExtractor("p60").extractPrice(realData);
    expect(result.wasPrice).toBeNull();
    expect(result.isPromotion).toBe(false);
  });

  it("REAL DATA: prodtype 'Food' (exact real value) passes the department filter", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    expect(extractor.isRelevantDepartment({ prodtype: "Food" })).toBe(true);
  });

  it("extracts the regular price from the configured zone", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({ p60: 45.99, p60_wp: 0 });
    expect(result.price).toBe(45.99);
    expect(result.isPromotion).toBe(false);
  });

  it("CONFIRMED LIVE (2026-09-21): p10=Western Cape, p30=Gauteng, p60=KwaZulu-Natal -- verified by comparing real displayed prices at three real delivery addresses against the API's own values, across two products to cross-validate", () => {
    // 'Fresh Full Cream Milk 2 L' (id 20011697): a real product where
    // all three zones happened to have genuinely different values,
    // making it possible to disambiguate p30 from p60 (which are
    // equal for most other products tested, including the one below).
    const fullCreamMilk = { p10: 38.99, p30: 40.99, p60: 39.99 };
    // Kempton Park (Gauteng) displayed 40.99 -- matches p30.
    expect(makeWoolworthsPriceExtractor("p30").extractPrice(fullCreamMilk).price).toBe(40.99);
    // Muizenberg (Western Cape) displayed 38.99 -- matches p10.
    expect(makeWoolworthsPriceExtractor("p10").extractPrice(fullCreamMilk).price).toBe(38.99);
    // Margate (KwaZulu-Natal) displayed 39.99 -- matches p60.
    expect(makeWoolworthsPriceExtractor("p60").extractPrice(fullCreamMilk).price).toBe(39.99);
  });

  it("uses a DIFFERENT zone's value when configured differently -- confirming the zone choice actually matters", () => {
    const data = { p10: 39.99, p30: 42.99, p60: 45.99 };
    expect(makeWoolworthsPriceExtractor("p10").extractPrice(data).price).toBe(39.99);
    expect(makeWoolworthsPriceExtractor("p30").extractPrice(data).price).toBe(42.99);
    expect(makeWoolworthsPriceExtractor("p60").extractPrice(data).price).toBe(45.99);
  });

  it("parses a loyalty price from promo text when it arithmetically checks out", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({
      p60: 126.99,
      promo: "Now R99.99 Save R27",
    });
    expect(result.price).toBe(99.99);
    expect(result.wasPrice).toBe(126.99);
    expect(result.isPromotion).toBe(true);
  });

  it("refuses a promo string whose arithmetic doesn't check out, rather than trusting it anyway", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({
      p60: 126.99,
      // Save amount doesn't match: 126.99 - 27 = 99.99, not 89.99
      promo: "Now R89.99 Save R27",
    });
    expect(result.price).toBe(126.99); // falls back to the regular price
    expect(result.isPromotion).toBe(false);
  });

  it("refuses an unparseable promo string entirely, degrading to the regular price with no loyalty price", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({
      p60: 45.99,
      promo: "Buy 2 for the price of 1 this week only!",
    });
    expect(result.price).toBe(45.99);
    expect(result.isPromotion).toBe(false);
  });

  it("refuses a parsed 'now' price that isn't actually below the regular price", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({
      p60: 45.99,
      promo: "Now R50.00", // higher than the regular price -- nonsensical
    });
    expect(result.price).toBe(45.99);
    expect(result.isPromotion).toBe(false);
  });

  it("does not treat p*_wp as the loyalty price even when present, per the source research's own finding", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    const result = extractor.extractPrice({ p60: 45.99, p60_wp: 55.99 });
    // p60_wp being a real positive number surfaces as wasPrice, but
    // is never conflated with an actual loyalty/promo price.
    expect(result.isPromotion).toBe(false);
    expect(result.price).toBe(45.99);
  });

  it("filters out non-food departments (the mixed-index problem confirmed in the source research)", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    expect(extractor.isRelevantDepartment({ prodtype: "Clothing" })).toBe(false);
    expect(extractor.isRelevantDepartment({ prodtype: "Food" })).toBe(true);
    expect(extractor.isRelevantDepartment({ prodtype: "Grocery" })).toBe(true);
  });

  it("does not exclude a result with no prodtype at all (fail open, not closed, on missing data)", () => {
    const extractor = makeWoolworthsPriceExtractor("p60");
    expect(extractor.isRelevantDepartment({})).toBe(true);
  });
});
