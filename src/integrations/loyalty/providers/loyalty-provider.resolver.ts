import type { LoyaltyProvider } from "./loyalty-provider.types.js";
import { loyaltyProviderRegistry } from "./loyalty-provider.registry.js";

const integrationProviderMap: Record<string, string> = {
  SHOPRITE_XTRA_SAVINGS: "MOCK_RETAILER",
};

export class LoyaltyProviderResolver {
  constructor(
    private readonly registry = loyaltyProviderRegistry,
  ) {}

  resolve(integrationCode: string): LoyaltyProvider {
    const normalizedCode = integrationCode.trim().toUpperCase();

    if (!normalizedCode) {
      throw new Error("LOYALTY_INTEGRATION_CODE_REQUIRED");
    }

    const providerCode = integrationProviderMap[normalizedCode];

    if (!providerCode) {
      throw new Error(
        `LOYALTY_PROVIDER_MAPPING_NOT_FOUND:${normalizedCode}`,
      );
    }

    return this.registry.get(providerCode);
  }

  hasMapping(integrationCode: string): boolean {
    const normalizedCode = integrationCode.trim().toUpperCase();

    return Boolean(integrationProviderMap[normalizedCode]);
  }
}

export const loyaltyProviderResolver = new LoyaltyProviderResolver();
