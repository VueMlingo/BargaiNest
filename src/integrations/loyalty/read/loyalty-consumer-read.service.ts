import type { PrismaClient } from "@prisma/client";

export interface LoyaltyConsumerCard {
  id: string;
  cardNumber: string;
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  favourite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyConsumerConnection {
  id: string;
  status: string;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
}

export interface LoyaltyConsumerActivity {
  externalId: string;
  type: string;
  points: number;
  description: string | null;
  occurredAt: string;
}

export interface LoyaltyConsumerReward {
  externalId: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  value: number | null;
  pointsRequired: number | null;
  expiresAt: string | null;
}

export interface LoyaltyConsumerVoucher {
  externalId: string;
  code: string | null;
  title: string;
  description: string | null;
  status: string;
  value: number | null;
  expiresAt: string | null;
}

export interface LoyaltyConsumerOffer {
  externalId: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface LoyaltyConsumerCurrentState {
  balance: number;
  source: string | null;
  sourceReference: string | null;
  observedAt: Date;
  syncedAt: Date;
  /** Previously fetched from the provider on every sync but silently
   *  discarded — only balance was ever persisted. Now carried through. */
  tier: string | null;
  activities: LoyaltyConsumerActivity[];
  rewards: LoyaltyConsumerReward[];
  vouchers: LoyaltyConsumerVoucher[];
  offers: LoyaltyConsumerOffer[];
}

export interface LoyaltyConsumerAvailableIntegration {
  id: string;
  code: string;
}

export interface LoyaltyConsumerAccount {
  id: string;
  accountNumber: string | null;
  status: string;

  programme: {
    id: string;
    name: string;
    code: string;
  };

  retailer: {
    id: string;
    name: string;
  };

  cards: LoyaltyConsumerCard[];

  connection: LoyaltyConsumerConnection | null;

  currentState: LoyaltyConsumerCurrentState | null;

  /** Present when the retailer has an ACTIVE Integration this account
   *  could connect to (or already has connected via `connection`),
   *  so the frontend can offer "sync your points" without guessing. */
  availableIntegration: LoyaltyConsumerAvailableIntegration | null;
}

export class LoyaltyConsumerReadService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  private parseJsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value as T[];
    }
    return [];
  }

  private buildCurrentState(
    snapshot: {
      balance: unknown;
      source: string | null;
      sourceReference: string | null;
      observedAt: Date;
      syncedAt: Date;
      tier: string | null;
      activitiesJson: unknown;
      rewardsJson: unknown;
      vouchersJson: unknown;
      offersJson: unknown;
    } | undefined,
    redemptions: { externalId: string; kind: string }[] = [],
  ): LoyaltyConsumerCurrentState | null {
    if (!snapshot) {
      return null;
    }

    /*
     * The mock provider's (and any real provider's) snapshot JSON is
     * fully overwritten on every sync, so there's nowhere in the
     * synced data itself for a locally-recorded redemption to
     * survive the next sync. This layers "what the user told us
     * they used" on top of "what the last sync reported" -- a real
     * provider integration would eventually reflect redemptions via
     * its own API, but until then, this local record is the honest
     * interim source of truth for that one piece of state.
     */
    const redeemedRewardIds = new Set(
      redemptions.filter((r) => r.kind === "REWARD").map((r) => r.externalId),
    );
    const redeemedVoucherIds = new Set(
      redemptions.filter((r) => r.kind === "VOUCHER").map((r) => r.externalId),
    );

    const rewards = this.parseJsonArray<LoyaltyConsumerReward>(snapshot.rewardsJson).map(
      (reward) =>
        redeemedRewardIds.has(reward.externalId)
          ? { ...reward, status: "REDEEMED" }
          : reward,
    );
    const vouchers = this.parseJsonArray<LoyaltyConsumerVoucher>(snapshot.vouchersJson).map(
      (voucher) =>
        redeemedVoucherIds.has(voucher.externalId)
          ? { ...voucher, status: "REDEEMED" }
          : voucher,
    );

    return {
      balance: Number(snapshot.balance),
      source: snapshot.source,
      sourceReference: snapshot.sourceReference,
      observedAt: snapshot.observedAt,
      syncedAt: snapshot.syncedAt,
      tier: snapshot.tier,
      activities: this.parseJsonArray<LoyaltyConsumerActivity>(snapshot.activitiesJson),
      rewards,
      vouchers,
      offers: this.parseJsonArray<LoyaltyConsumerOffer>(snapshot.offersJson),
    };
  }

  private buildAvailableIntegration(
    integrations: { id: string; code: string }[] | undefined,
  ): LoyaltyConsumerAvailableIntegration | null {
    const first = integrations?.[0];
    return first ? { id: first.id, code: first.code } : null;
  }

  async getAccountsForUser(
    userId: string,
  ): Promise<LoyaltyConsumerAccount[]> {
    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        loyaltyProgram: {
          include: {
            retailer: {
              include: {
                integrations: {
                  where: { status: "ACTIVE" },
                  select: { id: true, code: true },
                  take: 1,
                },
              },
            },
          },
        },
        cards: {
          orderBy: {
            createdAt: "asc",
          },
        },
        retailerConnections: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        snapshots: {
          orderBy: {
            observedAt: "desc",
          },
          take: 1,
        },
        redemptions: {
          select: { externalId: true, kind: true },
        },
      },
    });

    return accounts.map((account) => {
      const connection = account.retailerConnections.at(0);
      const snapshot = account.snapshots.at(0);

      return {
        id: account.id,
        accountNumber: account.accountNumber,
        status: account.status,

        programme: {
          id: account.loyaltyProgram.id,
          name: account.loyaltyProgram.name,
          code: account.loyaltyProgram.code,
        },

        retailer: {
          id: account.loyaltyProgram.retailer.id,
          name: account.loyaltyProgram.retailer.name,
        },

        cards: account.cards.map((card) => ({
          id: card.id,
          cardNumber: card.cardNumber,
          status: card.status,
          issuedAt: card.issuedAt,
          expiresAt: card.expiresAt,
          favourite: card.favourite,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        })),

        connection: connection
          ? {
              id: connection.id,
              status: connection.status,
              connectedAt: connection.connectedAt,
              lastSyncedAt: connection.lastSyncedAt,
            }
          : null,

        currentState: this.buildCurrentState(snapshot, account.redemptions),

        availableIntegration: this.buildAvailableIntegration(
          account.loyaltyProgram.retailer.integrations,
        ),
      };
    });
  }

  async getAccountForUser(
    userId: string,
    loyaltyAccountId: string,
  ): Promise<LoyaltyConsumerAccount | null> {
    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: {
        id: loyaltyAccountId,
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        loyaltyProgram: {
          include: {
            retailer: {
              include: {
                integrations: {
                  where: { status: "ACTIVE" },
                  select: { id: true, code: true },
                  take: 1,
                },
              },
            },
          },
        },
        cards: {
          orderBy: {
            createdAt: "asc",
          },
        },
        retailerConnections: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        snapshots: {
          orderBy: {
            observedAt: "desc",
          },
          take: 1,
        },
        redemptions: {
          select: { externalId: true, kind: true },
        },
      },
    });

    const account = accounts.at(0);

    if (!account) {
      return null;
    }

    const connection = account.retailerConnections.at(0);
    const snapshot = account.snapshots.at(0);

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      status: account.status,

      programme: {
        id: account.loyaltyProgram.id,
        name: account.loyaltyProgram.name,
        code: account.loyaltyProgram.code,
      },

      retailer: {
        id: account.loyaltyProgram.retailer.id,
        name: account.loyaltyProgram.retailer.name,
      },

      cards: account.cards.map((card) => ({
        id: card.id,
        cardNumber: card.cardNumber,
        status: card.status,
        issuedAt: card.issuedAt,
        expiresAt: card.expiresAt,
        favourite: card.favourite,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      })),

      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            connectedAt: connection.connectedAt,
            lastSyncedAt: connection.lastSyncedAt,
          }
        : null,

      currentState: this.buildCurrentState(snapshot, account.redemptions),

      availableIntegration: this.buildAvailableIntegration(
        account.loyaltyProgram.retailer.integrations,
      ),
    };
  }
}
