import { describe, expect, it } from "vitest";
import { buildLoyaltyInsights } from "../src/modules/insights/insights.service.js";
import type { LoyaltyConsumerAccount } from "../src/integrations/loyalty/read/loyalty-consumer-read.service.js";

function makeAccount(overrides: Partial<LoyaltyConsumerAccount> = {}): LoyaltyConsumerAccount {
  return {
    id: "acc-1",
    accountNumber: null,
    status: "ACTIVE",
    programme: { id: "p1", name: "Xtra Savings", code: "SHOPRITE_XTRA_SAVINGS" },
    retailer: { id: "r1", name: "Shoprite" },
    // REG-007: a real account normally does have a captured card --
    // this default represents that common case. Tests specifically
    // about the no-card-exclusion behavior override this explicitly.
    cards: [
      {
        id: "card-1",
        cardNumber: "1234567890",
        status: "ACTIVE",
        issuedAt: null,
        expiresAt: null,
        favourite: false,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ],
    connection: null,
    currentState: null,
    availableIntegration: null,
    ...overrides,
  };
}

describe("buildLoyaltyInsights", () => {
  it("returns all-zero aggregates for an empty account list, not an error", () => {
    const insights = buildLoyaltyInsights([]);
    expect(insights.totalLoyaltyAccounts).toBe(0);
    expect(insights.totalPoints).toBe(0);
    expect(insights.retailers).toEqual([]);
  });

  it("handles an account with no sync yet (currentState is null) without crashing", () => {
    const insights = buildLoyaltyInsights([makeAccount({ currentState: null })]);
    expect(insights.totalLoyaltyAccounts).toBe(1);
    expect(insights.totalPoints).toBe(0);
    expect(insights.retailers[0]!.points).toBe(0);
    expect(insights.retailers[0]!.tier).toBeNull();
  });

  it("BN-025: lastSyncedAt is null for a never-synced account -- distinguishes 'no data yet' from 'confirmed zero'", () => {
    const insights = buildLoyaltyInsights([makeAccount({ currentState: null })]);
    expect(insights.retailers[0]!.lastSyncedAt).toBeNull();
    expect(insights.retailers[0]!.points).toBe(0);
  });

  it("BN-025: lastSyncedAt reflects the real sync timestamp for a genuinely synced account, even when its balance really is zero", () => {
    const syncedAt = new Date("2026-09-20T10:00:00.000Z");
    const insights = buildLoyaltyInsights([
      makeAccount({
        currentState: {
          balance: 0,
          source: null,
          sourceReference: null,
          observedAt: syncedAt,
          syncedAt,
          tier: null,
          activities: [],
          rewards: [],
          vouchers: [],
          offers: [],
        },
      }),
    ]);
    expect(insights.retailers[0]!.lastSyncedAt).toEqual(syncedAt);
    expect(insights.retailers[0]!.points).toBe(0);
  });

  it("aggregates points and tier across a single synced account", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        currentState: {
          balance: 2450, source: null, sourceReference: null,
          observedAt: new Date(), syncedAt: new Date(), tier: "Gold",
          activities: [], rewards: [], vouchers: [], offers: [],
        },
      }),
    ]);
    expect(insights.totalPoints).toBe(2450);
    expect(insights.retailers[0]!.tier).toBe("Gold");
  });

  it("only counts AVAILABLE rewards/vouchers toward totals, not redeemed ones", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        currentState: {
          balance: 0, source: null, sourceReference: null,
          observedAt: new Date(), syncedAt: new Date(), tier: null,
          activities: [],
          rewards: [
            { externalId: "r1", type: "VOUCHER", title: "A", description: null, status: "AVAILABLE", value: 50, pointsRequired: null, expiresAt: null },
            { externalId: "r2", type: "VOUCHER", title: "B", description: null, status: "REDEEMED", value: 20, pointsRequired: null, expiresAt: null },
          ],
          vouchers: [
            { externalId: "v1", code: null, title: "C", description: null, status: "AVAILABLE", value: 10, expiresAt: null },
          ],
          offers: [],
        },
      }),
    ]);

    expect(insights.totalAvailableRewards).toBe(1); // only r1, not the redeemed r2
    expect(insights.totalAvailableRewardValue).toBe(50);
    expect(insights.totalAvailableVouchers).toBe(1);
    expect(insights.totalAvailableVoucherValue).toBe(10);
  });

  it("sums correctly across multiple retailers, and lists each separately", () => {
    const shoprite = makeAccount({
      retailer: { id: "r1", name: "Shoprite" },
      currentState: {
        balance: 1000, source: null, sourceReference: null,
        observedAt: new Date(), syncedAt: new Date(), tier: "Gold",
        activities: [], rewards: [], vouchers: [], offers: [],
      },
    });
    const checkers = makeAccount({
      id: "acc-2",
      retailer: { id: "r2", name: "Checkers" },
      currentState: {
        balance: 500, source: null, sourceReference: null,
        observedAt: new Date(), syncedAt: new Date(), tier: "Silver",
        activities: [], rewards: [], vouchers: [], offers: [],
      },
    });

    const insights = buildLoyaltyInsights([shoprite, checkers]);

    expect(insights.totalLoyaltyAccounts).toBe(2);
    expect(insights.totalPoints).toBe(1500);
    expect(insights.retailers).toHaveLength(2);
    expect(insights.retailers.find((r) => r.retailerName === "Shoprite")!.points).toBe(1000);
    expect(insights.retailers.find((r) => r.retailerName === "Checkers")!.points).toBe(500);
  });

  it("treats a reward with a null value as contributing 0, not NaN or a crash", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        currentState: {
          balance: 0, source: null, sourceReference: null,
          observedAt: new Date(), syncedAt: new Date(), tier: null,
          activities: [],
          rewards: [
            { externalId: "r1", type: "OTHER", title: "A", description: null, status: "AVAILABLE", value: null, pointsRequired: null, expiresAt: null },
          ],
          vouchers: [], offers: [],
        },
      }),
    ]);

    expect(insights.totalAvailableRewards).toBe(1);
    expect(insights.totalAvailableRewardValue).toBe(0);
    expect(Number.isNaN(insights.totalAvailableRewardValue)).toBe(false);
  });

  it("REG-007: an account with NO cards at all is excluded entirely -- it's invisible in Wallet, so it must be invisible in Insights too", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({ id: "has-card", retailer: { id: "r1", name: "Shoprite" } }),
      makeAccount({ id: "no-card", retailer: { id: "r2", name: "Checkers" }, cards: [] }),
    ]);

    expect(insights.totalLoyaltyAccounts).toBe(1);
    expect(insights.retailers).toHaveLength(1);
    expect(insights.retailers[0]!.retailerName).toBe("Shoprite");
    expect(insights.retailers.some((r) => r.retailerName === "Checkers")).toBe(false);
  });

  it("REG-007: an account whose only card is INACTIVE is also excluded, matching Wallet's exact rule", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        id: "inactive-card",
        retailer: { id: "r2", name: "Checkers" },
        cards: [
          {
            id: "card-2", cardNumber: "999", status: "INACTIVE",
            issuedAt: null, expiresAt: null, favourite: false,
            createdAt: new Date(), updatedAt: new Date(),
          },
        ],
      }),
    ]);

    expect(insights.totalLoyaltyAccounts).toBe(0);
    expect(insights.retailers).toHaveLength(0);
  });

  it("REG-007: an account with a MIX of an inactive and an active card is included -- only one active card is required, matching Wallet's 'some', not 'every'", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        id: "mixed-cards",
        retailer: { id: "r3", name: "Woolworths" },
        cards: [
          {
            id: "card-3", cardNumber: "111", status: "INACTIVE",
            issuedAt: null, expiresAt: null, favourite: false,
            createdAt: new Date(), updatedAt: new Date(),
          },
          {
            id: "card-4", cardNumber: "222", status: "ACTIVE",
            issuedAt: null, expiresAt: null, favourite: false,
            createdAt: new Date(), updatedAt: new Date(),
          },
        ],
      }),
    ]);

    expect(insights.totalLoyaltyAccounts).toBe(1);
    expect(insights.retailers).toHaveLength(1);
  });

  it("REG-007: a card with a missing/empty status defaults to ACTIVE, matching Wallet's exact fallback (String(card.status || 'ACTIVE'))", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        id: "no-status",
        retailer: { id: "r4", name: "Pick n Pay" },
        cards: [
          {
            id: "card-5", cardNumber: "333", status: "",
            issuedAt: null, expiresAt: null, favourite: false,
            createdAt: new Date(), updatedAt: new Date(),
          },
        ],
      }),
    ]);

    expect(insights.totalLoyaltyAccounts).toBe(1);
  });

  it("REG-007: excluded (no-card) accounts don't contribute to any of the aggregate totals, not just the retailer list", () => {
    const insights = buildLoyaltyInsights([
      makeAccount({
        id: "has-card",
        retailer: { id: "r1", name: "Shoprite" },
        currentState: {
          balance: 500, source: null, sourceReference: null,
          observedAt: new Date(), syncedAt: new Date(), tier: null,
          activities: [], rewards: [], vouchers: [], offers: [],
        },
      }),
      makeAccount({
        id: "no-card",
        retailer: { id: "r2", name: "Checkers" },
        cards: [],
        currentState: {
          balance: 999999, source: null, sourceReference: null,
          observedAt: new Date(), syncedAt: new Date(), tier: null,
          activities: [], rewards: [], vouchers: [], offers: [],
        },
      }),
    ]);

    expect(insights.totalPoints).toBe(500);
  });
});
