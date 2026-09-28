import type { PrismaClient } from "@prisma/client";
import {
  loyaltyProviderResolver,
} from "../providers/loyalty-provider.resolver.js";

export interface LoyaltySnapshotSyncResult {
  loyaltyAccountId: string;
  retailerConnectionId: string;
  integrationCode: string;
  providerCode: string;
  snapshotId: string;
  balance: number | string;
  observedAt: Date;
  syncedAt: Date;
  rewardCount: number;
  voucherCount: number;
  offerCount: number;
}

export class LoyaltySnapshotSyncService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async syncConnection(
    retailerConnectionId: string,
  ): Promise<LoyaltySnapshotSyncResult> {
    const connection = await this.prisma.retailerConnection.findUnique({
      where: {
        id: retailerConnectionId,
      },
      include: {
        loyaltyAccount: true,
        integration: true,
      },
    });

    if (!connection) {
      throw new Error("RETAILER_CONNECTION_NOT_FOUND");
    }

    if (connection.status !== "ACTIVE") {
      throw new Error(
        `RETAILER_CONNECTION_NOT_ACTIVE:${connection.status}`,
      );
    }

    if (!connection.externalAccountId) {
      throw new Error("RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED");
    }

    const provider = loyaltyProviderResolver.resolve(
      connection.integration.code,
    );

    const context = {
      integrationCode: connection.integration.code,
      retailerId: connection.integration.retailerId,
      loyaltyProgramId: connection.loyaltyAccount.loyaltyProgramId,
    };

    const snapshot = await provider.getSnapshot(
      context,
      connection.externalAccountId,
    );

    const syncedAt = new Date();

    const persistedSnapshot =
      await this.prisma.loyaltySnapshot.create({
        data: {
          loyaltyAccountId: connection.loyaltyAccountId,
          balance: snapshot.balance.balance,
          source: snapshot.balance.source,
          sourceReference:
            snapshot.balance.sourceReference ??
            connection.externalAccountId,
          observedAt: snapshot.balance.observedAt,
          syncedAt,
          // Previously discarded: the provider's getSnapshot() already
          // returns all of this, but only balance was ever written.
          tier: snapshot.account.tier ?? null,
          activitiesJson: snapshot.activities as object[],
          rewardsJson: snapshot.rewards as object[],
          vouchersJson: snapshot.vouchers as object[],
          offersJson: snapshot.offers as object[],
        },
      });

    await this.prisma.retailerConnection.update({
      where: {
        id: retailerConnectionId,
      },
      data: {
        lastSyncedAt: syncedAt,
      },
    });

    return {
      loyaltyAccountId: connection.loyaltyAccountId,
      retailerConnectionId,
      integrationCode: connection.integration.code,
      providerCode: provider.code,
      snapshotId: persistedSnapshot.id,
      balance: snapshot.balance.balance,
      observedAt: snapshot.balance.observedAt,
      syncedAt,
      rewardCount: snapshot.rewards.length,
      voucherCount: snapshot.vouchers.length,
      offerCount: snapshot.offers.length,
    };
  }
}
