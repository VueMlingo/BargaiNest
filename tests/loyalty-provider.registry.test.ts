import { describe, expect, it } from "vitest";
import { LoyaltyProviderRegistry } from "../src/integrations/loyalty/providers/loyalty-provider.registry.js";

describe("LoyaltyProviderRegistry", () => {
  it("registers and resolves the mock retailer provider", () => {
    const registry = new LoyaltyProviderRegistry();

    expect(registry.has("MOCK_RETAILER")).toBe(true);

    const provider = registry.get("MOCK_RETAILER");

    expect(provider.code).toBe("MOCK_RETAILER");
  });

  it("lists registered providers", () => {
    const registry = new LoyaltyProviderRegistry();

    expect(registry.list()).toContain("MOCK_RETAILER");
  });

  it("rejects an unknown provider", () => {
    const registry = new LoyaltyProviderRegistry();

    expect(() => registry.get("UNKNOWN_PROVIDER")).toThrow(
      "LOYALTY_PROVIDER_NOT_FOUND:UNKNOWN_PROVIDER",
    );
  });

  it("prevents duplicate provider registration", async () => {
    const registry = new LoyaltyProviderRegistry();
    const provider = registry.get("MOCK_RETAILER");

    expect(() => registry.register(provider)).toThrow(
      "LOYALTY_PROVIDER_ALREADY_REGISTERED:MOCK_RETAILER",
    );
  });

  it("retrieves a retailer snapshot through the provider contract", async () => {
    const registry = new LoyaltyProviderRegistry();
    const provider = registry.get("MOCK_RETAILER");

    const snapshot = await provider.getSnapshot(
      {
        integrationCode: "SHOPRITE_XTRA_SAVINGS",
        retailerId: "0333751e-41bf-4a8a-b2eb-a39258fafb9f",
        loyaltyProgramId: "5381c32b-f990-491b-a1b8-92b507e596f8",
      },
      "MOCK-EXTERNAL-ACCOUNT-001",
    );

    expect(snapshot.account.externalAccountId).toBe(
      "MOCK-EXTERNAL-ACCOUNT-001",
    );

    expect(snapshot.balance.balance).toBe(2450);
    expect(snapshot.balance.source).toBe("MOCK_RETAILER");

    expect(snapshot.activities).toHaveLength(3);
    expect(snapshot.rewards).toHaveLength(1);
    expect(snapshot.vouchers).toHaveLength(1);
    expect(snapshot.offers).toHaveLength(1);
  });
});
