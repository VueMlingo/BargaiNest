import { describe, expect, it, vi } from "vitest";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationRead,
} from "../src/modules/notifications/notification-preferences.service.js";

describe("getNotificationPreferences", () => {
  it("returns sensible defaults (alerts on, digest off) when no row exists", async () => {
    const prisma = {
      notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    const prefs = await getNotificationPreferences(prisma, "user-1");
    expect(prefs).toEqual({
      emailEnabled: true,
      rewardExpiryAlerts: true,
      weeklyDigest: false,
    });
  });

  it("returns the stored row's values when one exists", async () => {
    const prisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: false,
          rewardExpiryAlerts: true,
          weeklyDigest: true,
        }),
      },
    } as any;

    const prefs = await getNotificationPreferences(prisma, "user-1");
    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.weeklyDigest).toBe(true);
  });
});

describe("updateNotificationPreferences", () => {
  it("merges only the provided fields, leaving the rest at current values", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: true,
          rewardExpiryAlerts: true,
          weeklyDigest: false,
        }),
        upsert,
      },
    } as any;

    const result = await updateNotificationPreferences(prisma, "user-1", { weeklyDigest: true });

    expect(result).toEqual({
      emailEnabled: true, // unchanged
      rewardExpiryAlerts: true, // unchanged
      weeklyDigest: true, // updated
    });
  });

  it("never produces an undefined field in the merged result, even with undefined in the input", async () => {
    const prisma = {
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue({
          emailEnabled: true,
          rewardExpiryAlerts: true,
          weeklyDigest: false,
        }),
        upsert: vi.fn().mockResolvedValue({}),
      },
    } as any;

    const result = await updateNotificationPreferences(prisma, "user-1", {
      weeklyDigest: true,
      emailEnabled: undefined,
    });

    expect(result.emailEnabled).toBe(true); // fell back to current, not undefined
    expect(Object.values(result).every((v) => typeof v === "boolean")).toBe(true);
  });
});

describe("markNotificationRead", () => {
  it("scopes the update to both the notification id AND the owning user (can't mark someone else's notification read)", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { notification: { updateMany } } as any;

    await markNotificationRead(prisma, "user-1", "notif-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "user-1" },
      data: { status: "READ", readAt: expect.any(Date) },
    });
  });
});
