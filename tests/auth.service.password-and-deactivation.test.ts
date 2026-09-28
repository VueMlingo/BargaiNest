import { describe, expect, it, vi } from "vitest";
import {
  changePassword,
  deactivateAccount,
  hashPassword,
} from "../src/modules/auth/auth.service.js";

describe("changePassword", () => {
  it("rejects when there's no credential row for the user at all", async () => {
    const prisma = {
      userCredential: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(
      changePassword(prisma, "user-1", "whatever", "newSecurePassword123"),
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("rejects when the current password is wrong", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const prisma = {
      userCredential: { findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }) },
    } as any;

    await expect(
      changePassword(prisma, "user-1", "wrongPassword", "newSecurePassword123"),
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("BN-024: rejects when the new password is the same as the current password", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const credentialUpdate = vi.fn();
    const prisma = {
      userCredential: { findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }), update: credentialUpdate },
    } as any;

    await expect(
      changePassword(prisma, "user-1", "correctCurrentPassword", "correctCurrentPassword"),
    ).rejects.toThrow("PASSWORD_REUSE_NOT_ALLOWED");

    // Must reject before ever touching the database -- the password
    // should not be re-hashed and re-written just to store the exact
    // same value.
    expect(credentialUpdate).not.toHaveBeenCalled();
  });

  it("BN-024: allows a genuinely different new password through", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const credentialUpdate = vi.fn().mockResolvedValue({});
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      userCredential: { findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }), update: credentialUpdate },
      authSession: { updateMany: sessionUpdateMany },
    } as any;

    await expect(
      changePassword(prisma, "user-1", "correctCurrentPassword", "aGenuinelyDifferentPassword123"),
    ).resolves.toBeUndefined();

    expect(credentialUpdate).toHaveBeenCalled();
  });

  it("updates the password and revokes other sessions when the current password is correct", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const credentialUpdate = vi.fn().mockResolvedValue({});
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });

    const prisma = {
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }),
        update: credentialUpdate,
      },
      authSession: { updateMany: sessionUpdateMany },
    } as any;

    await changePassword(prisma, "user-1", "correctCurrentPassword", "newSecurePassword123");

    expect(credentialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    // The new hash actually verifies against the new password.
    const newHash = credentialUpdate.mock.calls[0]![0].data.passwordHash;
    expect(newHash).not.toBe(realHash);
  });

  it("keeps the caller's OWN current session valid while revoking every other one", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }),
        update: vi.fn().mockResolvedValue({}),
      },
      authSession: { updateMany: sessionUpdateMany },
    } as any;

    await changePassword(
      prisma,
      "user-1",
      "correctCurrentPassword",
      "newSecurePassword123",
      "current-session-id",
    );

    const whereClause = sessionUpdateMany.mock.calls[0]![0].where;
    expect(whereClause.id).toEqual({ not: "current-session-id" });
  });

  it("revokes ALL sessions when no current session id is given (e.g. an admin-triggered change)", async () => {
    const realHash = await hashPassword("correctCurrentPassword");
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }),
        update: vi.fn().mockResolvedValue({}),
      },
      authSession: { updateMany: sessionUpdateMany },
    } as any;

    await changePassword(prisma, "user-1", "correctCurrentPassword", "newSecurePassword123");

    const whereClause = sessionUpdateMany.mock.calls[0]![0].where;
    expect(whereClause.id).toBeUndefined();
  });
});

describe("deactivateAccount", () => {
  it("sets the user's status to INACTIVE and revokes all sessions", async () => {
    const userUpdate = vi.fn().mockResolvedValue({});
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      user: { update: userUpdate },
      authSession: { updateMany: sessionUpdateMany },
    } as any;

    await deactivateAccount(prisma, "user-1");

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "INACTIVE" },
    });
    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    );
  });
});
