import type { LoyaltyConsumerAccount } from "../../integrations/loyalty/read/loyalty-consumer-read.service.js";

/**
 * BN-035 was originally scoped as "monthly savings, rewards earned,
 * shopping trends, top retailers, personal spending insights" -- a
 * true historical-trends dashboard. That needs time-series data this
 * project doesn't have yet (purchase/transaction history is BN-028,
 * not yet built). Building a fake trends view on top of one
 * point-in-time snapshot would mean presenting invented data as if it
 * were real, which is worse than not building the feature at all.
 *
 * What's honestly achievable right now, and what this actually is: a
 * current-snapshot dashboard aggregating data that already exists
 * across a user's loyalty accounts -- total points, available reward/
 * voucher value, and a per-retailer breakdown. A real, useful "here's
 * where you stand today" view, explicitly not a trends view.
 *
 * Deliberately a pure function over already-fetched
 * LoyaltyConsumerAccount[] data (the same data
 * LoyaltyConsumerReadService.getAccountsForUser() already returns) --
 * no new database queries, no new data fetching. This is genuinely an
 * aggregation layer, not new data collection.
 */

export interface RetailerInsight {
  retailerName: string;
  points: number;
  tier: string | null;
  availableRewards: number;
  availableVouchers: number;
  lastSyncedAt: Date | null;
}

export interface LoyaltyInsights {
  totalLoyaltyAccounts: number;
  totalPoints: number;
  totalAvailableRewards: number;
  totalAvailableRewardValue: number;
  totalAvailableVouchers: number;
  totalAvailableVoucherValue: number;
  retailers: RetailerInsight[];
}

function countAvailable(items: { status: string; value: number | null }[]): {
  count: number;
  value: number;
} {
  const available = items.filter((item) => item.status.toUpperCase() === "AVAILABLE");
  return {
    count: available.length,
    value: available.reduce((sum, item) => sum + (item.value ?? 0), 0),
  };
}

/**
 * REG-007: Insights must only reflect what's actually in the user's
 * Wallet -- an account can exist (e.g. the user registered interest
 * in a loyalty programme) without the user ever having captured an
 * actual card for it. The Wallet frontend already filters accounts
 * this way (pilot/js/state.js's normaliseCloudAccounts: an account
 * only becomes a visible card if it has at least one card with
 * status ACTIVE, defaulting a missing status to ACTIVE). Insights was
 * built as a pure aggregation over the raw accounts array with no
 * equivalent filter, so an account with zero actual cards -- entirely
 * invisible in Wallet -- still counted here, showing up as an "extra"
 * retailer entry the user never knowingly captured. This mirrors that
 * same filter exactly, so both screens describe the same set of
 * loyalty relationships.
 */
function hasAtLeastOneActiveCard(account: LoyaltyConsumerAccount): boolean {
  return account.cards.some((card) => (card.status || "ACTIVE").toUpperCase() === "ACTIVE");
}

export function buildLoyaltyInsights(accounts: LoyaltyConsumerAccount[]): LoyaltyInsights {
  const walletAccounts = accounts.filter(hasAtLeastOneActiveCard);

  let totalPoints = 0;
  let totalAvailableRewards = 0;
  let totalAvailableRewardValue = 0;
  let totalAvailableVouchers = 0;
  let totalAvailableVoucherValue = 0;

  const retailers: RetailerInsight[] = walletAccounts.map((account) => {
    const points = account.currentState?.balance ?? 0;
    const rewards = countAvailable(account.currentState?.rewards ?? []);
    const vouchers = countAvailable(account.currentState?.vouchers ?? []);

    totalPoints += points;
    totalAvailableRewards += rewards.count;
    totalAvailableRewardValue += rewards.value;
    totalAvailableVouchers += vouchers.count;
    totalAvailableVoucherValue += vouchers.value;

    return {
      retailerName: account.retailer.name,
      points,
      tier: account.currentState?.tier ?? null,
      availableRewards: rewards.count,
      availableVouchers: vouchers.count,
      lastSyncedAt: account.currentState?.syncedAt ?? null,
    };
  });

  return {
    totalLoyaltyAccounts: walletAccounts.length,
    totalPoints,
    totalAvailableRewards,
    totalAvailableRewardValue,
    totalAvailableVouchers,
    totalAvailableVoucherValue,
    retailers,
  };
}
