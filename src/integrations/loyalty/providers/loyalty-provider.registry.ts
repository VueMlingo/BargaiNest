import type { LoyaltyProvider } from "./loyalty-provider.types.js";
import { MockRetailerProvider } from "./mock-retailer-provider.js";

export class LoyaltyProviderRegistry {
  private readonly providers = new Map<string, LoyaltyProvider>();

  constructor() {
    this.register(new MockRetailerProvider());
  }

  register(provider: LoyaltyProvider): void {
    const code = provider.code.trim();

    if (!code) {
      throw new Error("LOYALTY_PROVIDER_CODE_REQUIRED");
    }

    if (this.providers.has(code)) {
      throw new Error(`LOYALTY_PROVIDER_ALREADY_REGISTERED:${code}`);
    }

    this.providers.set(code, provider);
  }

  get(code: string): LoyaltyProvider {
    const provider = this.providers.get(code);

    if (!provider) {
      throw new Error(`LOYALTY_PROVIDER_NOT_FOUND:${code}`);
    }

    return provider;
  }

  has(code: string): boolean {
    return this.providers.has(code);
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}

export const loyaltyProviderRegistry = new LoyaltyProviderRegistry();
