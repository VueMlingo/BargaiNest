
export type LoyaltyProviderCapability =
  | "ACCOUNT"
  | "BALANCE"
  | "ACTIVITIES"
  | "REWARDS"
  | "VOUCHERS"
  | "OFFERS"
  | "REDEEM_REWARD";

export interface LoyaltyProviderContext {
  integrationCode: string;
  retailerId: string;
  loyaltyProgramId: string;
}

export interface LoyaltyProviderAccount {
  externalAccountId: string;
  accountNumber?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "EXPIRED";
  /** Retailer-defined membership tier (e.g. "Bronze"/"Gold"), where
   *  the retailer's programme has one. Optional because not every
   *  loyalty programme has tiers at all. */
  tier?: string | null;
}

export interface LoyaltyProviderBalance {
  balance: number | string;
  currency?: string | null;
  observedAt: Date;
  source: string;
  sourceReference?: string | null;
}

export interface LoyaltyProviderActivity {
  externalId: string;
  type:
    | "EARN"
    | "REDEEM"
    | "BONUS"
    | "ADJUSTMENT"
    | "EXPIRY"
    | "REVERSAL"
    | "OTHER";
  points: number | string;
  description?: string | null;
  occurredAt: Date;
}

export interface LoyaltyProviderReward {
  externalId: string;
  type:
    | "POINTS"
    | "DISCOUNT"
    | "VOUCHER"
    | "CASHBACK"
    | "BENEFIT"
    | "OTHER";
  title: string;
  description?: string | null;
  status: "AVAILABLE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  value?: number | string | null;
  pointsRequired?: number | string | null;
  expiresAt?: Date | null;
}

export interface LoyaltyProviderVoucher {
  externalId: string;
  code?: string | null;
  title: string;
  description?: string | null;
  status: "AVAILABLE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  value?: number | string | null;
  expiresAt?: Date | null;
}

export interface LoyaltyProviderOffer {
  externalId: string;
  title: string;
  description?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface LoyaltyProviderSnapshot {
  account: LoyaltyProviderAccount;
  balance: LoyaltyProviderBalance;
  activities: LoyaltyProviderActivity[];
  rewards: LoyaltyProviderReward[];
  vouchers: LoyaltyProviderVoucher[];
  offers: LoyaltyProviderOffer[];
}

export interface LoyaltyProvider {
  readonly code: string;

  capabilities(): Promise<LoyaltyProviderCapability[]>;

  getAccount(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderAccount>;

  getBalance(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderBalance>;

  getActivities(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderActivity[]>;

  getRewards(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderReward[]>;

  getVouchers(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderVoucher[]>;

  getOffers(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderOffer[]>;

  getSnapshot(
    context: LoyaltyProviderContext,
    externalAccountId: string
  ): Promise<LoyaltyProviderSnapshot>;
}
