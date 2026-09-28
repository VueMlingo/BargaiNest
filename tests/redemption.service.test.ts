import { describe, expect, it, vi } from "vitest";
import { markRedeemed } from "../src/integrations/loyalty/redemption/redemption.service.js";

describe("markRedeemed", () => {
  it("rejects marking redemption on an account that doesn't belong to the caller", async () => {
    const prisma = {
      loyaltyAccount: { findUnique: vi.fn().mockResolvedValue({ userId: "someone-else" }) },
    } as any;

    await expect(
      markRedeemed(prisma, "user-1", "acc-1", "ext-1", "REWARD" as any),
    ).rejects.toThrow("LOYALTY_ACCOUNT_NOT_FOUND_OR_NOT_OWNER");
  });

  it("rejects when the account doesn't exist at all", async () => {
    const prisma = {
      loyaltyAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(
      markRedeemed(prisma, "user-1", "acc-1", "ext-1", "REWARD" as any),
    ).rejects.toThrow("LOYALTY_ACCOUNT_NOT_FOUND_OR_NOT_OWNER");
  });

  it("upserts the redemption for a valid owned account (idempotent on repeat calls)", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "r1" });
    const prisma = {
      loyaltyAccount: { findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }) },
      rewardRedemption: { upsert },
    } as any;

    await markRedeemed(prisma, "user-1", "acc-1", "ext-1", "REWARD" as any);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          loyaltyAccountId_externalId_kind: {
            loyaltyAccountId: "acc-1",
            externalId: "ext-1",
            kind: "REWARD",
          },
        },
        create: { userId: "user-1", loyaltyAccountId: "acc-1", externalId: "ext-1", kind: "REWARD" },
      }),
    );
  });
});
