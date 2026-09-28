import { describe, expect, it } from "vitest";

import {
  evaluatePriceEligibility,
} from "../../src/modules/price-eligibility/price-eligibility.service.js";

const now = new Date("2026-09-08T15:00:00.000Z");

function validInput() {
  return {
    price: 38,
    currency: "ZAR",
    observedAt: new Date("2026-09-08T14:00:00.000Z"),
    sourceReference: "https://retailer.example/catalogue.pdf",
    catalogueItemId: "catalogue-item-1",
    validFrom: new Date("2026-09-08T00:00:00.000Z"),
    validUntil: new Date("2026-09-10T00:00:00.000Z"),
    confidence: 0.95,
    extractionMethod: "PDF_TEXT",
    channel: "PHYSICAL_CATALOGUE",
    matchStatus: "CONFIRMED" as const,
  };
}

describe("price eligibility", () => {
  it("accepts a fresh, source-backed, confirmed catalogue observation", () => {
    const result = evaluatePriceEligibility(validInput(), now);

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects a stale observation", () => {
    const input = {
      ...validInput(),
      observedAt: new Date("2026-09-04T14:00:00.000Z"),
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("STALE_OBSERVATION");
  });

  it("rejects an expired catalogue price", () => {
    const input = {
      ...validInput(),
      validUntil: new Date("2026-09-08T14:59:59.000Z"),
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("EXPIRED");
  });

  it("rejects a price that is not yet valid", () => {
    const input = {
      ...validInput(),
      validFrom: new Date("2026-09-08T16:00:00.000Z"),
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NOT_YET_VALID");
  });

  it("rejects an unconfirmed product match", () => {
    const input = {
      ...validInput(),
      matchStatus: "PROPOSED" as const,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("PRODUCT_MATCH_NOT_CONFIRMED");
  });

  it("rejects a price without catalogue provenance", () => {
    const input = {
      ...validInput(),
      sourceReference: null,
      catalogueItemId: null,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("MISSING_SOURCE_PROVENANCE");
  });

  it("rejects insufficient extraction confidence", () => {
    const input = {
      ...validInput(),
      confidence: 0.69,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("INSUFFICIENT_CONFIDENCE");
  });

  it("rejects missing extraction method", () => {
    const input = {
      ...validInput(),
      extractionMethod: null,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("MISSING_EXTRACTION_METHOD");
  });

  it("rejects missing channel context", () => {
    const input = {
      ...validInput(),
      channel: null,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("MISSING_CHANNEL");
  });

  it("rejects future observations", () => {
    const input = {
      ...validInput(),
      observedAt: new Date("2026-09-08T16:00:00.000Z"),
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("OBSERVATION_IN_FUTURE");
  });

  it("allows an observation with only catalogue item provenance", () => {
    const input = {
      ...validInput(),
      sourceReference: null,
    };

    const result = evaluatePriceEligibility(input, now);

    expect(result.eligible).toBe(true);
  });
});
