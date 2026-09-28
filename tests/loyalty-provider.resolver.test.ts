import { describe, expect, it } from "vitest";
import {
  LoyaltyProviderResolver,
} from "../src/integrations/loyalty/providers/loyalty-provider.resolver.js";
import { LoyaltyProviderRegistry } from "../src/integrations/loyalty/providers/loyalty-provider.registry.js";

describe("LoyaltyProviderResolver", () => {
  it("resolves SHOPRITE_XTRA_SAVINGS to the configured provider", () => {
    const resolver = new LoyaltyProviderResolver(
      new LoyaltyProviderRegistry(),
    );

    const provider = resolver.resolve("SHOPRITE_XTRA_SAVINGS");

    expect(provider.code).toBe("MOCK_RETAILER");
  });

  it("normalises integration codes", () => {
    const resolver = new LoyaltyProviderResolver(
      new LoyaltyProviderRegistry(),
    );

    const provider = resolver.resolve("  shoprite_xtra_savings  ");

    expect(provider.code).toBe("MOCK_RETAILER");
  });

  it("reports whether an integration has a provider mapping", () => {
    const resolver = new LoyaltyProviderResolver(
      new LoyaltyProviderRegistry(),
    );

    expect(resolver.hasMapping("SHOPRITE_XTRA_SAVINGS")).toBe(true);
    expect(resolver.hasMapping("UNKNOWN_INTEGRATION")).toBe(false);
  });

  it("rejects an unknown integration mapping", () => {
    const resolver = new LoyaltyProviderResolver(
      new LoyaltyProviderRegistry(),
    );

    expect(() => resolver.resolve("UNKNOWN_INTEGRATION")).toThrow(
      "LOYALTY_PROVIDER_MAPPING_NOT_FOUND:UNKNOWN_INTEGRATION",
    );
  });

  it("rejects an empty integration code", () => {
    const resolver = new LoyaltyProviderResolver(
      new LoyaltyProviderRegistry(),
    );

    expect(() => resolver.resolve("   ")).toThrow(
      "LOYALTY_INTEGRATION_CODE_REQUIRED",
    );
  });
});
