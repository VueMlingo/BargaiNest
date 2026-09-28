import { describe, expect, it, vi } from "vitest";
import { LoyaltySnapshotSyncService } from "../src/integrations/loyalty/sync/loyalty-snapshot-sync.service.js";

describe("LoyaltySnapshotSyncService", () => {
  it("persists a retailer-reported balance as a snapshot without changing the account balance", async () => {
    const snapshotCreate = vi.fn().mockResolvedValue({
      id: "snapshot-001",
    });

    const connectionUpdate = vi.fn().mockResolvedValue({
      id: "connection-001",
    });

    const prisma = {
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "connection-001",
          loyaltyAccountId: "account-001",
          integrationId: "integration-001",
          status: "ACTIVE",
          externalAccountId: "MOCK-EXTERNAL-001",
          loyaltyAccount: {
            id: "account-001",
            loyaltyProgramId: "program-001",
            pointsBalance: 999,
          },
          integration: {
            id: "integration-001",
            retailerId: "retailer-001",
            code: "SHOPRITE_XTRA_SAVINGS",
          },
        }),
        update: connectionUpdate,
      },
      loyaltySnapshot: {
        create: snapshotCreate,
      },
    } as any;

    const service = new LoyaltySnapshotSyncService(prisma);

    const result = await service.syncConnection("connection-001");

    expect(result.loyaltyAccountId).toBe("account-001");
    expect(result.retailerConnectionId).toBe("connection-001");
    expect(result.integrationCode).toBe("SHOPRITE_XTRA_SAVINGS");
    expect(result.providerCode).toBe("MOCK_RETAILER");
    expect(result.balance).toBe(2450);
    expect(result.rewardCount).toBeGreaterThanOrEqual(0);
    expect(result.voucherCount).toBeGreaterThanOrEqual(0);
    expect(result.offerCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.rewardCount).toBe("number");

    expect(snapshotCreate).toHaveBeenCalledOnce();

    const snapshotCall = snapshotCreate.mock.calls.at(0)?.[0];

    expect(snapshotCall.data.loyaltyAccountId).toBe("account-001");
    expect(snapshotCall.data.balance).toBe(2450);
    expect(snapshotCall.data.source).toBe("MOCK_RETAILER");
    expect(snapshotCall.data.sourceReference).toBe("MOCK-EXTERNAL-001");
    // Previously discarded: getSnapshot() already fetches account
    // data (including tier) via getAccount(), but it was never
    // persisted -- only balance was written.
    expect(snapshotCall.data.tier).toBe("Gold");

    // The fix: getSnapshot() already returns activities/rewards/vouchers/
    // offers, but syncConnection() previously only ever persisted the
    // balance — everything else was silently discarded. These are
    // populated by the real MockRetailerProvider, not by this test.
    expect(Array.isArray(snapshotCall.data.activitiesJson)).toBe(true);
    expect(snapshotCall.data.activitiesJson.length).toBeGreaterThan(0);
    expect(Array.isArray(snapshotCall.data.rewardsJson)).toBe(true);
    expect(Array.isArray(snapshotCall.data.vouchersJson)).toBe(true);
    expect(Array.isArray(snapshotCall.data.offersJson)).toBe(true);

    expect(connectionUpdate).toHaveBeenCalledOnce();

    const updateCall = connectionUpdate.mock.calls.at(0)?.[0];

    expect(updateCall.where.id).toBe("connection-001");
    expect(updateCall.data.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("does not update loyaltyAccount.pointsBalance", async () => {
    const snapshotCreate = vi.fn().mockResolvedValue({
      id: "snapshot-002",
    });

    const connectionUpdate = vi.fn().mockResolvedValue({
      id: "connection-002",
    });

    const prisma = {
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "connection-002",
          loyaltyAccountId: "account-002",
          status: "ACTIVE",
          externalAccountId: "MOCK-EXTERNAL-002",
          loyaltyAccount: {
            id: "account-002",
            loyaltyProgramId: "program-002",
            pointsBalance: 100,
          },
          integration: {
            id: "integration-002",
            retailerId: "retailer-002",
            code: "SHOPRITE_XTRA_SAVINGS",
          },
        }),
        update: connectionUpdate,
      },
      loyaltySnapshot: {
        create: snapshotCreate,
      },
    } as any;

    const service = new LoyaltySnapshotSyncService(prisma);

    await service.syncConnection("connection-002");

    const updateCall = connectionUpdate.mock.calls.at(0)?.[0];

    expect(updateCall.data).not.toHaveProperty("pointsBalance");
  });

  it("rejects a missing retailer connection", async () => {
    const prisma = {
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new LoyaltySnapshotSyncService(prisma);

    await expect(
      service.syncConnection("missing-connection"),
    ).rejects.toThrow("RETAILER_CONNECTION_NOT_FOUND");
  });

  it("rejects an inactive retailer connection", async () => {
    const prisma = {
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "connection-003",
          status: "PENDING",
          externalAccountId: "MOCK-EXTERNAL-003",
          loyaltyAccount: {
            loyaltyProgramId: "program-003",
          },
          integration: {
            retailerId: "retailer-003",
            code: "SHOPRITE_XTRA_SAVINGS",
          },
        }),
      },
    } as any;

    const service = new LoyaltySnapshotSyncService(prisma);

    await expect(
      service.syncConnection("connection-003"),
    ).rejects.toThrow("RETAILER_CONNECTION_NOT_ACTIVE:PENDING");
  });

  it("rejects a connection without an external retailer account", async () => {
    const prisma = {
      retailerConnection: {
        findUnique: vi.fn().mockResolvedValue({
          id: "connection-004",
          status: "ACTIVE",
          externalAccountId: null,
          loyaltyAccount: {
            loyaltyProgramId: "program-004",
          },
          integration: {
            retailerId: "retailer-004",
            code: "SHOPRITE_XTRA_SAVINGS",
          },
        }),
      },
    } as any;

    const service = new LoyaltySnapshotSyncService(prisma);

    await expect(
      service.syncConnection("connection-004"),
    ).rejects.toThrow("RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED");
  });
});
