import { describe, expect, it, vi } from "vitest";
import { LoyaltyConsumerReadService } from "../src/integrations/loyalty/read/loyalty-consumer-read.service.js";

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-001",
    accountNumber: "ACC-1",
    status: "ACTIVE",
    loyaltyProgram: {
      id: "program-001",
      name: "Xtra Savings",
      code: "SHOPRITE_XTRA_SAVINGS",
      retailer: {
        id: "retailer-001",
        name: "Shoprite",
        integrations: [{ id: "integration-001", code: "SHOPRITE_XTRA_SAVINGS" }],
      },
    },
    cards: [],
    retailerConnections: [],
    snapshots: [],
    ...overrides,
  };
}

describe("LoyaltyConsumerReadService", () => {
  it("carries rewards/vouchers/offers/activities through from the snapshot JSON columns (previously dropped)", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            snapshots: [
              {
                balance: 2450,
                source: "MOCK_RETAILER",
                sourceReference: "EXT-1",
                observedAt: new Date("2026-09-15T08:00:00Z"),
                syncedAt: new Date("2026-09-15T08:00:01Z"),
                activitiesJson: [{ externalId: "a1", type: "EARN", points: 100, description: null, occurredAt: "2026-09-14T00:00:00Z" }],
                rewardsJson: [{ externalId: "r1", type: "VOUCHER", title: "R50 off", description: null, status: "AVAILABLE", value: 50, pointsRequired: null, expiresAt: null }],
                vouchersJson: [{ externalId: "v1", code: "SAVE50", title: "Save R50", description: null, status: "AVAILABLE", value: 50, expiresAt: null }],
                offersJson: [{ externalId: "o1", title: "Double points weekend", description: null, startsAt: null, endsAt: null }],
              },
            ],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts).toHaveLength(1);
    const state = accounts[0]!.currentState;
    expect(state).not.toBeNull();
    expect(state!.balance).toBe(2450);
    expect(state!.activities).toHaveLength(1);
    expect(state!.activities[0]!.points).toBe(100);
    expect(state!.rewards).toHaveLength(1);
    expect(state!.rewards[0]!.title).toBe("R50 off");
    expect(state!.vouchers).toHaveLength(1);
    expect(state!.vouchers[0]!.code).toBe("SAVE50");
    expect(state!.offers).toHaveLength(1);
    expect(state!.offers[0]!.title).toBe("Double points weekend");
  });

  it("returns empty arrays (not a crash) when snapshot JSON columns are null", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            snapshots: [
              {
                balance: 100,
                source: null,
                sourceReference: null,
                observedAt: new Date(),
                syncedAt: new Date(),
                activitiesJson: null,
                rewardsJson: null,
                vouchersJson: null,
                offersJson: null,
              },
            ],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    const state = accounts[0]!.currentState;
    expect(state!.activities).toEqual([]);
    expect(state!.rewards).toEqual([]);
    expect(state!.vouchers).toEqual([]);
    expect(state!.offers).toEqual([]);
  });

  it("returns null currentState (not an error) when there's no snapshot yet", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([makeAccountRow({ snapshots: [] })]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts[0]!.currentState).toBeNull();
  });

  it("surfaces availableIntegration when the retailer has an ACTIVE integration", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([makeAccountRow()]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts[0]!.availableIntegration).toEqual({
      id: "integration-001",
      code: "SHOPRITE_XTRA_SAVINGS",
    });
  });

  it("returns null availableIntegration when the retailer has no active integration", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            loyaltyProgram: {
              id: "program-002",
              name: "Rewards",
              code: "PNP_REWARDS",
              retailer: { id: "retailer-002", name: "Pick n Pay", integrations: [] },
            },
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts[0]!.availableIntegration).toBeNull();
  });

  it("carries the account tier through (previously fetched by the provider but discarded)", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            snapshots: [
              {
                balance: 2450,
                source: "MOCK_RETAILER",
                sourceReference: "EXT-1",
                observedAt: new Date(),
                syncedAt: new Date(),
                tier: "Gold",
                activitiesJson: [],
                rewardsJson: [],
                vouchersJson: [],
                offersJson: [],
              },
            ],
            redemptions: [],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts[0]!.currentState!.tier).toBe("Gold");
  });

  it("overrides a redeemed reward's status to REDEEMED, layered over whatever the snapshot says", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            snapshots: [
              {
                balance: 100,
                source: null,
                sourceReference: null,
                observedAt: new Date(),
                syncedAt: new Date(),
                tier: null,
                activitiesJson: [],
                rewardsJson: [
                  { externalId: "r1", type: "VOUCHER", title: "R50 off", description: null, status: "AVAILABLE", value: 50, pointsRequired: null, expiresAt: null },
                  { externalId: "r2", type: "VOUCHER", title: "R20 off", description: null, status: "AVAILABLE", value: 20, pointsRequired: null, expiresAt: null },
                ],
                vouchersJson: [
                  { externalId: "v1", code: "SAVE10", title: "Save R10", description: null, status: "AVAILABLE", value: 10, expiresAt: null },
                ],
                offersJson: [],
              },
            ],
            redemptions: [
              { externalId: "r1", kind: "REWARD" },
              { externalId: "v1", kind: "VOUCHER" },
            ],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");
    const state = accounts[0]!.currentState!;

    expect(state.rewards.find((r) => r.externalId === "r1")!.status).toBe("REDEEMED");
    expect(state.rewards.find((r) => r.externalId === "r2")!.status).toBe("AVAILABLE"); // untouched
    expect(state.vouchers.find((v) => v.externalId === "v1")!.status).toBe("REDEEMED");
  });

  it("does not cross-contaminate reward and voucher redemptions with the same externalId", async () => {
    // A reward and a voucher could coincidentally share an externalId
    // from the provider -- redeeming one must not mark the other redeemed.
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            snapshots: [
              {
                balance: 100, source: null, sourceReference: null,
                observedAt: new Date(), syncedAt: new Date(), tier: null,
                activitiesJson: [],
                rewardsJson: [{ externalId: "shared-id", type: "VOUCHER", title: "Reward", description: null, status: "AVAILABLE", value: null, pointsRequired: null, expiresAt: null }],
                vouchersJson: [{ externalId: "shared-id", code: null, title: "Voucher", description: null, status: "AVAILABLE", value: null, expiresAt: null }],
                offersJson: [],
              },
            ],
            redemptions: [{ externalId: "shared-id", kind: "REWARD" }],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");
    const state = accounts[0]!.currentState!;

    expect(state.rewards[0]!.status).toBe("REDEEMED");
    expect(state.vouchers[0]!.status).toBe("AVAILABLE"); // different kind, not redeemed
  });

  it("carries a card's favourite flag through (previously a broken, device-local-only frontend flag)", async () => {
    const prisma = {
      loyaltyAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeAccountRow({
            cards: [
              { id: "card-1", cardNumber: "111", status: "ACTIVE", issuedAt: null, expiresAt: null, favourite: true, createdAt: new Date(), updatedAt: new Date() },
              { id: "card-2", cardNumber: "222", status: "ACTIVE", issuedAt: null, expiresAt: null, favourite: false, createdAt: new Date(), updatedAt: new Date() },
            ],
          }),
        ]),
      },
    } as any;

    const service = new LoyaltyConsumerReadService(prisma);
    const accounts = await service.getAccountsForUser("user-001");

    expect(accounts[0]!.cards.find((c) => c.id === "card-1")!.favourite).toBe(true);
    expect(accounts[0]!.cards.find((c) => c.id === "card-2")!.favourite).toBe(false);
  });
});
