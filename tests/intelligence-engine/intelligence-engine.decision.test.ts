import { describe, expect, it } from "vitest";

import { detectBetterPrice } from "../../src/modules/intelligence-engine/intelligence-engine.decision.js";
import type {
  PriceComparisonInput,
  PriceComparisonAlternative,
} from "../../src/modules/intelligence-engine/intelligence-engine.types.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function makeCandidate(
  retailerId: string,
  price: number,
  retailerName: string,
  observedAt: Date = new Date()
): PriceComparisonAlternative {
  return {
    retailerId,
    retailerName,
    price,
    currency: "ZAR",
    observedAt,
  };
}

function makeInput(
  alternatives: PriceComparisonAlternative[],
  currentPrice = 100,
  currentObservedAt?: Date
): PriceComparisonInput {
  /*
   * If no current observation is explicitly supplied, use the
   * alternative's observation date.
   *
   * This is important for freshness tests. Otherwise the default
   * current observation would always be "now", causing freshness
   * to remain at 10 points regardless of the alternative's age.
   */
  const effectiveCurrentObservedAt =
    currentObservedAt ??
    alternatives[0]?.observedAt ??
    new Date();

  return {
    productId: "product-1",
    productName: "Test Product",
    currentRetailerId: "retailer-1",
    currentRetailerName: "Current Retailer",
    currentPrice,
    currency: "ZAR",
    currentObservedAt: effectiveCurrentObservedAt,
    alternatives,
  };
}

describe("detectBetterPrice", () => {
  it("detects a lower price at another retailer", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate("retailer-2", 90, "Cheaper Retailer"),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.type).toBe("BETTER_PRICE");
    expect(result.alternativePrice).toBe(90);
    expect(result.alternativeRetailerId).toBe("retailer-2");
    expect(result.alternativeRetailerName).toBe("Cheaper Retailer");
    expect(result.estimatedSaving).toBe(10);
  });

  it("returns no opportunity when there are no alternatives", () => {
    const result = detectBetterPrice(makeInput([]));

    expect(result.detected).toBe(false);
  });

  it("returns no opportunity when no alternative is cheaper", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate("retailer-2", 100, "Same Price"),
        makeCandidate("retailer-3", 110, "More Expensive"),
      ])
    );

    expect(result.detected).toBe(false);
  });

  it("ignores an alternative belonging to the current retailer", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate("retailer-1", 70, "Current Retailer"),
        makeCandidate("retailer-2", 90, "Other Retailer"),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.alternativePrice).toBe(90);
    expect(result.alternativeRetailerId).toBe("retailer-2");
  });

  it("selects the cheapest valid alternative", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate("retailer-2", 90, "Retailer A"),
        makeCandidate("retailer-3", 70, "Retailer B"),
        makeCandidate("retailer-4", 85, "Retailer C"),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.alternativePrice).toBe(70);
    expect(result.alternativeRetailerId).toBe("retailer-3");
    expect(result.alternativeRetailerName).toBe("Retailer B");
    expect(result.estimatedSaving).toBe(30);
  });

  it("calculates the savings score correctly", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate("retailer-2", 90, "Cheaper Retailer"),
      ])
    );

    expect(result.estimatedSaving).toBe(10);
    expect(result.score).toBe(56);
    expect(result.confidence).toBe(1);
  });

  it("applies maximum freshness to observations within 1 day", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          90,
          "Fresh Retailer",
          daysAgo(23 / 24)
        ),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.score).toBe(56);
    expect(result.confidence).toBe(1);
  });

  it("reduces freshness after 1 day", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          90,
          "Retailer",
          daysAgo(2)
        ),
      ])
    );

    expect(result.score).toBe(54);
    expect(result.confidence).toBe(0.9);
  });

  it("reduces freshness after 3 days", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          90,
          "Retailer",
          daysAgo(5)
        ),
      ])
    );

    expect(result.score).toBe(52);
    expect(result.confidence).toBe(0.75);
  });

  it("reduces freshness after 7 days", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          90,
          "Retailer",
          daysAgo(10)
        ),
      ])
    );

    expect(result.score).toBe(49);
    expect(result.confidence).toBe(0.5);
  });

  it("removes freshness points after 14 days", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          90,
          "Retailer",
          daysAgo(20)
        ),
      ])
    );

    expect(result.score).toBe(46);
    expect(result.confidence).toBe(0.25);
  });

  it("uses the most recent observation when calculating freshness", () => {
    const result = detectBetterPrice(
      makeInput(
        [
          makeCandidate(
            "retailer-2",
            90,
            "Retailer",
            daysAgo(10)
          ),
        ],
        100,
        daysAgo(2)
      )
    );

    expect(result.score).toBe(54);
    expect(result.confidence).toBe(0.9);
  });

  it("rejects invalid negative prices", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          -10,
          "Invalid Retailer"
        ),
        makeCandidate(
          "retailer-3",
          95,
          "Valid Retailer"
        ),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.alternativePrice).toBe(95);
    expect(result.alternativeRetailerId).toBe("retailer-3");
  });

  it("rejects non-finite prices", () => {
    const result = detectBetterPrice(
      makeInput([
        makeCandidate(
          "retailer-2",
          Number.NaN,
          "Invalid Retailer"
        ),
        makeCandidate(
          "retailer-3",
          90,
          "Valid Retailer"
        ),
      ])
    );

    expect(result.detected).toBe(true);
    expect(result.alternativePrice).toBe(90);
    expect(result.alternativeRetailerId).toBe("retailer-3");
  });
});
