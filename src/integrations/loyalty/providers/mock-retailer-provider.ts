import type {
  LoyaltyProvider,
  LoyaltyProviderCapability,
  LoyaltyProviderContext,
  LoyaltyProviderAccount,
  LoyaltyProviderBalance,
  LoyaltyProviderActivity,
  LoyaltyProviderReward,
  LoyaltyProviderVoucher,
  LoyaltyProviderOffer,
  LoyaltyProviderSnapshot,
} from "./loyalty-provider.types.js";

export class MockRetailerProvider implements LoyaltyProvider {
  readonly code = "MOCK_RETAILER";

  async capabilities(): Promise<LoyaltyProviderCapability[]> {
    return [
      "ACCOUNT",
      "BALANCE",
      "ACTIVITIES",
      "REWARDS",
      "VOUCHERS",
      "OFFERS",
    ];
  }

  async getAccount(
    _context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderAccount> {
    return {
      externalAccountId,
      status: "ACTIVE",
      tier: "Gold",
    };
  }

  async getBalance(
    _context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderBalance> {
    return {
      balance: 2450,
      currency: "POINTS",
      observedAt: new Date(),
      source: this.code,
      sourceReference: externalAccountId,
    };
  }

  async getActivities(
    _context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderActivity[]> {
    return [
      {
        externalId: `${externalAccountId}-ACT-001`,
        type: "EARN",
        points: 450,
        description: "Retailer purchase",
        occurredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        externalId: `${externalAccountId}-ACT-002`,
        type: "BONUS",
        points: 500,
        description: "Retailer promotional bonus",
        occurredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        externalId: `${externalAccountId}-ACT-003`,
        type: "EARN",
        points: 1500,
        description: "Retailer purchase",
        occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getRewards(
    _context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderReward[]> {
    return [
      {
        externalId: `${externalAccountId}-REWARD-001`,
        type: "VOUCHER",
        title: "R50 Shopping Voucher",
        description: "Retailer-issued shopping voucher",
        status: "AVAILABLE",
        pointsRequired: 2000,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getVouchers(
    _context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderVoucher[]> {
    return [
      {
        externalId: `${externalAccountId}-VOUCHER-001`,
        title: "10% Off Selected Groceries",
        description: "Retailer-issued voucher",
        status: "AVAILABLE",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getOffers(
    _context: LoyaltyProviderContext,
    _externalAccountId: string,
  ): Promise<LoyaltyProviderOffer[]> {
    return [
      {
        externalId: "MOCK-OFFER-001",
        title: "Double Points Weekend",
        description: "Earn double points on qualifying purchases.",
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  async getSnapshot(
    context: LoyaltyProviderContext,
    externalAccountId: string,
  ): Promise<LoyaltyProviderSnapshot> {
    const [
      account,
      balance,
      activities,
      rewards,
      vouchers,
      offers,
    ] = await Promise.all([
      this.getAccount(context, externalAccountId),
      this.getBalance(context, externalAccountId),
      this.getActivities(context, externalAccountId),
      this.getRewards(context, externalAccountId),
      this.getVouchers(context, externalAccountId),
      this.getOffers(context, externalAccountId),
    ]);

    return {
      account,
      balance,
      activities,
      rewards,
      vouchers,
      offers,
    };
  }
}
