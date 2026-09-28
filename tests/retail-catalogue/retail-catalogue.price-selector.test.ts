import { describe, expect, it } from "vitest";

import {
  selectBestRetailerPrice,
  selectCurrentPricesByRetailer,
  type PriceSelectionObservation,
} from "../../src/modules/retail-catalogue/retail-catalogue.price-selector.js";

const NOW = new Date("2026-09-13T10:00:00.000Z");

function observation(
  overrides: Partial<PriceSelectionObservation>,
): PriceSelectionObservation {
  return {
    id: "obs-default",
    productId: "product-1",
    retailerId: "retailer-1",
    price: 32,
    currency: "ZAR",
    observedAt: new Date("2026-09-13T08:00:00.000Z"),
    ...overrides,
  };
}

describe("retail-catalogue.price-selector", () => {
  it("selects the most recent currently valid observation", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "old-cheaper",
          price: 28,
          observedAt: new Date("2026-09-10T08:00:00.000Z"),
        }),
        observation({
          id: "current",
          price: 32,
          observedAt: new Date("2026-09-13T08:00:00.000Z"),
        }),
      ],
      { now: NOW },
    );

    expect(result.reason).toBe("SELECTED");
    expect(result.selected?.observation.id).toBe("current");
    expect(Number(result.selected?.observation.price)).toBe(32);
  });

  it("rejects expired observations", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "expired",
          price: 25,
          validUntil: new Date("2026-09-12T23:59:59.000Z"),
        }),
      ],
      { now: NOW },
    );

    expect(result.reason).toBe("NO_ELIGIBLE_OBSERVATIONS");
    expect(result.selected).toBeNull();
  });

  it("rejects observations that have not started yet", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "future",
          price: 25,
          validFrom: new Date("2026-09-14T00:00:00.000Z"),
        }),
      ],
      { now: NOW },
    );

    expect(result.reason).toBe("NO_ELIGIBLE_OBSERVATIONS");
    expect(result.selected).toBeNull();
  });

  it("prefers the higher-confidence observation when timestamps are identical", () => {
    const observedAt = new Date("2026-09-13T08:00:00.000Z");

    const result = selectBestRetailerPrice(
      [
        observation({
          id: "low-confidence",
          price: 29,
          observedAt,
          confidence: 0.7,
        }),
        observation({
          id: "high-confidence",
          price: 31,
          observedAt,
          confidence: 0.95,
        }),
      ],
      { now: NOW },
    );

    expect(result.selected?.observation.id).toBe("high-confidence");
  });

  it("can restrict selection to a specific retailer", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "shoprite",
          retailerId: "shoprite-id",
          price: 32,
        }),
        observation({
          id: "checkers",
          retailerId: "checkers-id",
          price: 29,
        }),
      ],
      {
        now: NOW,
        retailerId: "shoprite-id",
      },
    );

    expect(result.selected?.observation.id).toBe("shoprite");
  });

  it("can restrict selection by currency", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "usd",
          price: 3,
          currency: "USD",
        }),
        observation({
          id: "zar",
          price: 32,
          currency: "ZAR",
        }),
      ],
      {
        now: NOW,
        currency: "ZAR",
      },
    );

    expect(result.selected?.observation.id).toBe("zar");
  });

  it("supports minimum confidence filtering", () => {
    const result = selectBestRetailerPrice(
      [
        observation({
          id: "weak",
          price: 28,
          confidence: 0.5,
        }),
        observation({
          id: "strong",
          price: 32,
          confidence: 0.95,
        }),
      ],
      {
        now: NOW,
        minimumConfidence: 0.8,
      },
    );

    expect(result.selected?.observation.id).toBe("strong");
  });

  it("selects one current price per retailer", () => {
    const result = selectCurrentPricesByRetailer(
      [
        observation({
          id: "shoprite-old",
          retailerId: "shoprite",
          price: 28,
          observedAt: new Date("2026-09-10T08:00:00.000Z"),
        }),
        observation({
          id: "shoprite-current",
          retailerId: "shoprite",
          price: 32,
          observedAt: new Date("2026-09-13T08:00:00.000Z"),
        }),
        observation({
          id: "checkers-current",
          retailerId: "checkers",
          price: 30,
          observedAt: new Date("2026-09-13T07:00:00.000Z"),
        }),
      ],
      { now: NOW },
    );

    expect(result.size).toBe(2);
    expect(result.get("shoprite")?.observation.id).toBe(
      "shoprite-current",
    );
    expect(result.get("checkers")?.observation.id).toBe(
      "checkers-current",
    );
  });

  it("returns no observations cleanly", () => {
    const result = selectBestRetailerPrice([], {
      now: NOW,
    });

    expect(result.reason).toBe("NO_OBSERVATIONS");
    expect(result.selected).toBeNull();
  });
});
