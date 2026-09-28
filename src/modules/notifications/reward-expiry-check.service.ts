import type { PrismaClient } from "@prisma/client";
import type { EmailSender } from "../../integrations/email/email-sender.js";

const EXPIRY_WINDOW_DAYS = 7;
/** Don't re-notify about the same expiring item within this window,
 *  so running the check daily doesn't spam the same reward every day
 *  right up until it expires. */
const DEDUPE_WINDOW_HOURS = 24;

interface ExpiringItem {
  title: string;
  expiresAt: Date;
  kind: "reward" | "voucher";
}

function findExpiringItems(items: unknown, kind: "reward" | "voucher", now: Date): ExpiringItem[] {
  if (!Array.isArray(items)) return [];

  const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const results: ExpiringItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as { title?: unknown; expiresAt?: unknown };
    if (typeof record.title !== "string" || typeof record.expiresAt !== "string") continue;

    const expiresAt = new Date(record.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) continue;
    if (expiresAt <= now || expiresAt > windowEnd) continue; // already expired, or too far out

    results.push({ title: record.title, expiresAt, kind });
  }

  return results;
}

export interface RewardExpiryCheckResult {
  usersChecked: number;
  notificationsCreated: number;
}

/**
 * Meant to be invoked periodically (this pilot has no cron
 * infrastructure -- see the note in the delivery doc about wiring
 * this to an actual scheduler). Scans each user's latest loyalty
 * snapshot for rewards/vouchers expiring within the next 7 days,
 * creates a Notification record, and emails it if the user's
 * preferences allow (defaulting to allowed, matching
 * NotificationPreference's own schema defaults).
 */
export async function runRewardExpiryCheck(
  prisma: PrismaClient,
  emailSender: EmailSender,
  now: Date = new Date(),
): Promise<RewardExpiryCheckResult> {
  const accounts = await prisma.loyaltyAccount.findMany({
    include: {
      user: {
        include: {
          identifiers: { where: { type: "EMAIL" }, take: 1 },
          notificationPreference: true,
        },
      },
      snapshots: { orderBy: { observedAt: "desc" }, take: 1 },
    },
  });

  const checkedUserIds = new Set<string>();
  let notificationsCreated = 0;

  for (const account of accounts) {
    checkedUserIds.add(account.userId);

    const prefs = account.user.notificationPreference;
    const rewardExpiryAlertsEnabled = prefs?.rewardExpiryAlerts ?? true;
    const emailEnabled = prefs?.emailEnabled ?? true;

    if (!rewardExpiryAlertsEnabled) continue;

    const snapshot = account.snapshots[0];
    if (!snapshot) continue;

    const expiring = [
      ...findExpiringItems(snapshot.rewardsJson, "reward", now),
      ...findExpiringItems(snapshot.vouchersJson, "voucher", now),
    ];

    for (const item of expiring) {
      const dedupeSince = new Date(now.getTime() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: account.userId,
          type: "REWARD_EXPIRY",
          title: item.title,
          createdAt: { gt: dedupeSince },
        },
      });
      if (alreadyNotified) continue;

      const daysLeft = Math.ceil((item.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const body = `Your ${item.kind} "${item.title}" expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;

      const notification = await prisma.notification.create({
        data: {
          userId: account.userId,
          type: "REWARD_EXPIRY",
          channel: emailEnabled ? "EMAIL" : "IN_APP",
          status: "PENDING",
          title: item.title,
          body,
        },
      });

      const emailIdentifier = account.user.identifiers[0];
      if (emailEnabled && emailIdentifier) {
        try {
          await emailSender.send({
            to: emailIdentifier.value,
            subject: `Your ${item.kind} is expiring soon`,
            text: body,
          });
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "SENT", sentAt: new Date() },
          });
        } catch {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "FAILED" },
          });
        }
      }

      notificationsCreated += 1;
    }
  }

  return { usersChecked: checkedUserIds.size, notificationsCreated };
}
