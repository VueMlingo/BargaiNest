import type { PrismaClient, RedemptionKind } from "@prisma/client";

/**
 * Records that the user marked a reward/voucher as used. See the
 * comment on buildCurrentState() in loyalty-consumer-read.service.ts
 * for why this needs to exist as its own table rather than mutating
 * the synced snapshot JSON directly.
 */
export async function markRedeemed(
  prisma: PrismaClient,
  userId: string,
  loyaltyAccountId: string,
  externalId: string,
  kind: RedemptionKind,
) {
  const account = await prisma.loyaltyAccount.findUnique({
    where: { id: loyaltyAccountId },
    select: { userId: true },
  });

  if (!account || account.userId !== userId) {
    throw new Error("LOYALTY_ACCOUNT_NOT_FOUND_OR_NOT_OWNER");
  }

  return prisma.rewardRedemption.upsert({
    where: {
      loyaltyAccountId_externalId_kind: { loyaltyAccountId, externalId, kind },
    },
    update: {},
    create: { userId, loyaltyAccountId, externalId, kind },
  });
}
