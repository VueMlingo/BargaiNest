import { describe, expect, it, vi, beforeEach } from "vitest";
import { runRewardExpiryCheck } from "../src/modules/notifications/reward-expiry-check.service.js";

const NOW = new Date("2026-09-15T12:00:00Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    user: {
      identifiers: [{ value: "user1@example.com" }],
      notificationPreference: null, // defaults apply
    },
    snapshots: [
      {
        rewardsJson: [],
        vouchersJson: [],
      },
    ],
    ...overrides,
  };
}

function makeEmailSender() {
  const send = vi.fn().mockResolvedValue(undefined);
  return { send, sender: { send } };
}

function makePrisma(accounts: unknown[], notificationFindFirstResult: unknown = null) {
  const created: any[] = [];
  const updated: any[] = [];
  return {
    loyaltyAccount: { findMany: vi.fn().mockResolvedValue(accounts) },
    notification: {
      findFirst: vi.fn().mockResolvedValue(notificationFindFirstResult),
      create: vi.fn(async ({ data }: any) => {
        const record = { id: `notif-${created.length + 1}`, ...data };
        created.push(record);
        return record;
      }),
      update: vi.fn(async ({ data }: any) => {
        updated.push(data);
        return {};
      }),
    },
    _created: created,
    _updated: updated,
  } as any;
}

describe("runRewardExpiryCheck", () => {
  it("creates and sends a notification for a reward expiring within 7 days", async () => {
    const { send, sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        snapshots: [{ rewardsJson: [{ title: "R50 off", expiresAt: daysFromNow(3) }], vouchersJson: [] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);

    expect(result.notificationsCreated).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].text).toContain("R50 off");
    expect(send.mock.calls[0]![0].text).toContain("3 days");
  });

  it("ignores a reward expiring further out than the 7-day window", async () => {
    const { sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        snapshots: [{ rewardsJson: [{ title: "Far off reward", expiresAt: daysFromNow(30) }], vouchersJson: [] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(0);
  });

  it("ignores a reward that has already expired", async () => {
    const { sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        snapshots: [{ rewardsJson: [{ title: "Already gone", expiresAt: daysFromNow(-1) }], vouchersJson: [] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(0);
  });

  it("also checks vouchers, not just rewards", async () => {
    const { send, sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        snapshots: [{ rewardsJson: [], vouchersJson: [{ title: "Save R20", expiresAt: daysFromNow(2) }] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(1);
    expect(send.mock.calls[0]![0].text).toContain("voucher");
  });

  it("respects rewardExpiryAlerts=false and skips the user entirely", async () => {
    const { send, sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        user: {
          identifiers: [{ value: "user1@example.com" }],
          notificationPreference: { rewardExpiryAlerts: false, emailEnabled: true },
        },
        snapshots: [{ rewardsJson: [{ title: "R50 off", expiresAt: daysFromNow(2) }], vouchersJson: [] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("creates the notification but does not send an email when emailEnabled=false", async () => {
    const { send, sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({
        user: {
          identifiers: [{ value: "user1@example.com" }],
          notificationPreference: { rewardExpiryAlerts: true, emailEnabled: false },
        },
        snapshots: [{ rewardsJson: [{ title: "R50 off", expiresAt: daysFromNow(2) }], vouchersJson: [] }],
      }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: "IN_APP" }) }),
    );
  });

  it("does not re-notify about the same expiring item within the dedupe window", async () => {
    const { send, sender } = makeEmailSender();
    // findFirst resolves truthy -> "already notified recently"
    const prisma = makePrisma(
      [makeAccount({ snapshots: [{ rewardsJson: [{ title: "R50 off", expiresAt: daysFromNow(2) }], vouchersJson: [] }] })],
      { id: "existing-notification" },
    );

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.notificationsCreated).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("marks the notification FAILED (not silently lost) if sending the email throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("smtp down"));
    const prisma = makePrisma([
      makeAccount({ snapshots: [{ rewardsJson: [{ title: "R50 off", expiresAt: daysFromNow(2) }], vouchersJson: [] }] }),
    ]);

    await runRewardExpiryCheck(prisma, { send }, NOW);

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } }),
    );
  });

  it("skips accounts with no snapshot yet, without throwing", async () => {
    const { sender } = makeEmailSender();
    const prisma = makePrisma([makeAccount({ snapshots: [] })]);

    await expect(runRewardExpiryCheck(prisma, sender, NOW)).resolves.toEqual({
      usersChecked: 1,
      notificationsCreated: 0,
    });
  });

  it("counts distinct users checked, not accounts (a user can have multiple loyalty accounts)", async () => {
    const { sender } = makeEmailSender();
    const prisma = makePrisma([
      makeAccount({ userId: "user-1", snapshots: [] }),
      makeAccount({ userId: "user-1", snapshots: [] }), // same user, second account
      makeAccount({ userId: "user-2", snapshots: [] }),
    ]);

    const result = await runRewardExpiryCheck(prisma, sender, NOW);
    expect(result.usersChecked).toBe(2);
  });
});
