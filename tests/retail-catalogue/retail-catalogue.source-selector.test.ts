import { describe, expect, it } from "vitest";

import {
  selectCatalogueSources,
} from "../../src/modules/retail-catalogue/retail-catalogue.source-selector.js";

const now = new Date("2026-09-09T10:00:00Z");

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    retailerId: "retailer-1",
    code: "ONLINE",
    name: "Online Store",
    channel: "ONLINE_STORE",
    sourceType: "WEB_PAGE",
    sourceUrl: "https://example.com",
    adapterKey: "TEST_ONLINE",
    region: null,
    countryCode: "ZA",
    province: null,
    city: null,
    storeCode: null,
    sourcePriority: 100,
    lastSuccessfulRunAt: null,
    latestRunStatus: null,
    ...overrides,
  } as any;
}

describe("selectCatalogueSources", () => {
  it("selects the freshest source first", () => {
    const sources = [
      source({
        id: "old",
        code: "OLD",
        lastSuccessfulRunAt: new Date("2026-09-08T08:00:00Z"),
      }),
      source({
        id: "fresh",
        code: "FRESH",
        lastSuccessfulRunAt: new Date("2026-09-09T09:30:00Z"),
      }),
    ];

    const result = selectCatalogueSources(sources, { now });

    expect(result.map((item) => item.id)).toEqual([
      "fresh",
      "old",
    ]);
  });

  it("puts never-run sources after previously successful sources", () => {
    const sources = [
      source({
        id: "old",
        lastSuccessfulRunAt: new Date("2026-09-08T08:00:00Z"),
      }),
      source({
        id: "never-run",
        lastSuccessfulRunAt: null,
      }),
    ];

    const result = selectCatalogueSources(sources, { now });

    expect(result.map((item) => item.id)).toEqual([
      "old",
      "never-run",
    ]);
  });

  it("uses source priority when freshness is equal", () => {
    const timestamp = new Date("2026-09-09T09:00:00Z");

    const sources = [
      source({
        id: "priority-200",
        sourcePriority: 200,
        lastSuccessfulRunAt: timestamp,
      }),
      source({
        id: "priority-50",
        sourcePriority: 50,
        lastSuccessfulRunAt: timestamp,
      }),
    ];

    const result = selectCatalogueSources(sources, {
      now,
    });

    expect(result.map((item) => item.id)).toEqual([
      "priority-50",
      "priority-200",
    ]);
  });

  it("filters by retailer and geography", () => {
    const sources = [
      source({
        id: "gauteng",
        retailerId: "retailer-1",
        province: "Gauteng",
      }),
      source({
        id: "western-cape",
        retailerId: "retailer-1",
        province: "Western Cape",
      }),
      source({
        id: "other-retailer",
        retailerId: "retailer-2",
        province: "Gauteng",
      }),
    ];

    const result = selectCatalogueSources(sources, {
      retailerId: "retailer-1",
      province: "Gauteng",
      now,
    });

    expect(result.map((item) => item.id)).toEqual([
      "gauteng",
    ]);
  });

  it("respects the requested limit", () => {
    const sources = [
      source({ id: "1" }),
      source({ id: "2" }),
      source({ id: "3" }),
    ];

    const result = selectCatalogueSources(sources, {
      now,
      limit: 2,
    });

    expect(result).toHaveLength(2);
  });
});

describe("source health ordering", () => {
  it("prefers healthy sources over failed sources", () => {
    const sources = [
      source({
        id: "failed",
        latestRunStatus: "FAILED",
        lastSuccessfulRunAt: new Date("2026-09-09T09:30:00Z"),
      }),
      source({
        id: "healthy",
        latestRunStatus: "COMPLETED",
        lastSuccessfulRunAt: new Date("2026-09-08T09:00:00Z"),
      }),
    ];

    const result = selectCatalogueSources(sources, { now });

    expect(result.map((item) => item.id)).toEqual([
      "healthy",
      "failed",
    ]);
  });

  it("prefers partial sources over failed sources", () => {
    const sources = [
      source({
        id: "failed",
        latestRunStatus: "FAILED",
      }),
      source({
        id: "partial",
        latestRunStatus: "PARTIAL",
      }),
    ];

    const result = selectCatalogueSources(sources, { now });

    expect(result.map((item) => item.id)).toEqual([
      "partial",
      "failed",
    ]);
  });

  it("keeps failed sources available as fallback candidates", () => {
    const sources = [
      source({
        id: "healthy",
        latestRunStatus: "COMPLETED",
      }),
      source({
        id: "failed",
        latestRunStatus: "FAILED",
      }),
    ];

    const result = selectCatalogueSources(sources, {
      now,
      limit: 2,
    });

    expect(result.map((item) => item.id)).toEqual([
      "healthy",
      "failed",
    ]);
  });
});
