import type { PrismaClient } from "@prisma/client";

export interface NotificationPreferencesDto {
  emailEnabled: boolean;
  rewardExpiryAlerts: boolean;
  weeklyDigest: boolean;
}

const DEFAULTS: NotificationPreferencesDto = {
  emailEnabled: true,
  rewardExpiryAlerts: true,
  weeklyDigest: false,
};

export async function getNotificationPreferences(
  prisma: PrismaClient,
  userId: string,
): Promise<NotificationPreferencesDto> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!row) return DEFAULTS;
  return {
    emailEnabled: row.emailEnabled,
    rewardExpiryAlerts: row.rewardExpiryAlerts,
    weeklyDigest: row.weeklyDigest,
  };
}

export async function updateNotificationPreferences(
  prisma: PrismaClient,
  userId: string,
  updates: { [K in keyof NotificationPreferencesDto]?: boolean | undefined },
): Promise<NotificationPreferencesDto> {
  const current = await getNotificationPreferences(prisma, userId);
  const definedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  ) as Partial<NotificationPreferencesDto>;
  const merged: NotificationPreferencesDto = { ...current, ...definedUpdates };

  await prisma.notificationPreference.upsert({
    where: { userId },
    update: merged,
    create: { userId, ...merged },
  });

  return merged;
}

export async function listNotificationsForUser(prisma: PrismaClient, userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationRead(
  prisma: PrismaClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { status: "READ", readAt: new Date() },
  });
}
