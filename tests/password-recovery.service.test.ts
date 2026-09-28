import { describe, expect, it, vi } from "vitest";
import { hashPassword } from "../src/modules/auth/auth.service.js";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from "../src/modules/auth/password-recovery.service.js";

function makeEmailSender() {
  const send = vi.fn().mockResolvedValue(undefined);
  return { send, sender: { send } };
}

describe("requestPasswordReset", () => {
  it("does nothing and sends no email when the address isn't registered (enumeration protection)", async () => {
    const { send, sender } = makeEmailSender();
    const prisma = {
      userIdentifier: { findUnique: vi.fn().mockResolvedValue(null) },
      passwordResetToken: { findFirst: vi.fn(), create: vi.fn() },
    } as any;

    await requestPasswordReset(prisma, sender, "nobody@example.com");

    expect(send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates a token and sends an email for a registered address", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({ id: "token-1" });
    const prisma = {
      userIdentifier: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }),
      },
      passwordResetToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    } as any;

    await requestPasswordReset(prisma, sender, "  Real@Example.com  ");

    expect(create).toHaveBeenCalledTimes(1);
    const createArgs = create.mock.calls[0]![0];
    expect(createArgs.data.userId).toBe("user-1");
    expect(typeof createArgs.data.tokenHash).toBe("string");
    expect(createArgs.data.tokenHash).not.toMatch(/[^a-f0-9]/); // sha256 hex

    expect(send).toHaveBeenCalledTimes(1);
    const emailArgs = send.mock.calls[0]![0];
    expect(emailArgs.to).toBe("real@example.com"); // normalized
    expect(emailArgs.text).toContain("reset-password?token=");
  });

  it("never puts the raw token in the stored hash (only the hash is persisted)", async () => {
    const { sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({ id: "token-1" });
    const prisma = {
      userIdentifier: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }),
      },
      passwordResetToken: { findFirst: vi.fn().mockResolvedValue(null), create },
    } as any;

    await requestPasswordReset(prisma, sender, "real@example.com");

    const storedHash = create.mock.calls[0]![0].data.tokenHash;
    const sentEmailText = (sender.send as any).mock.calls[0]![0].text;
    const rawTokenInEmail = sentEmailText.match(/token=([^\s]+)/)[1];

    expect(storedHash).not.toBe(rawTokenInEmail);
    expect(storedHash).toHaveLength(64); // sha256 hex digest length
  });

  it("throttles: does not issue a second token within 2 minutes of an existing valid one", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn();
    const prisma = {
      userIdentifier: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }),
      },
      passwordResetToken: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing-token" }),
        create,
      },
    } as any;

    await requestPasswordReset(prisma, sender, "real@example.com");

    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("confirmPasswordReset", () => {
  it("rejects a token that doesn't exist", async () => {
    const prisma = {
      passwordResetToken: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(confirmPasswordReset(prisma, "bogus", "newpassword123")).rejects.toThrow(
      "INVALID_OR_EXPIRED_TOKEN",
    );
  });

  it("rejects an already-used token", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    } as any;

    await expect(confirmPasswordReset(prisma, "raw", "newpassword123")).rejects.toThrow(
      "INVALID_OR_EXPIRED_TOKEN",
    );
  });

  it("rejects an expired token", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() - 60_000),
        }),
      },
    } as any;

    await expect(confirmPasswordReset(prisma, "raw", "newpassword123")).rejects.toThrow(
      "INVALID_OR_EXPIRED_TOKEN",
    );
  });

  it("updates the password, marks the token used, and revokes all sessions for a valid token", async () => {
    const tokenUpdate = vi.fn().mockResolvedValue({});
    const credentialUpdate = vi.fn().mockResolvedValue({});
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });

    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: tokenUpdate,
      },
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: "some-different-hash" }),
        update: credentialUpdate,
      },
      authSession: { updateMany: sessionUpdateMany },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          passwordResetToken: { update: tokenUpdate },
          userCredential: { update: credentialUpdate },
        }),
      ),
    } as any;

    await confirmPasswordReset(prisma, "raw-token", "newSecurePassword123");

    expect(tokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
    expect(credentialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    // Sessions must be revoked -- a password reset shouldn't leave old
    // (possibly compromised) sessions valid.
    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    );
  });

  it("BN-024: rejects resetting to the same password currently in use", async () => {
    const realHash = await hashPassword("myCurrentPassword123");
    const tokenUpdate = vi.fn();
    const credentialUpdate = vi.fn();

    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: tokenUpdate,
      },
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }),
        update: credentialUpdate,
      },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          passwordResetToken: { update: tokenUpdate },
          userCredential: { update: credentialUpdate },
        }),
      ),
    } as any;

    await expect(
      confirmPasswordReset(prisma, "raw-token", "myCurrentPassword123"),
    ).rejects.toThrow("PASSWORD_REUSE_NOT_ALLOWED");

    // Must reject before touching the token or credential at all --
    // a rejected reset shouldn't consume the token or revoke sessions.
    expect(tokenUpdate).not.toHaveBeenCalled();
    expect(credentialUpdate).not.toHaveBeenCalled();
  });

  it("BN-024: allows resetting to a genuinely different password", async () => {
    const realHash = await hashPassword("myCurrentPassword123");
    const tokenUpdate = vi.fn().mockResolvedValue({});
    const credentialUpdate = vi.fn().mockResolvedValue({});

    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: tokenUpdate,
      },
      userCredential: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: realHash }),
        update: credentialUpdate,
      },
      authSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          passwordResetToken: { update: tokenUpdate },
          userCredential: { update: credentialUpdate },
        }),
      ),
    } as any;

    await expect(
      confirmPasswordReset(prisma, "raw-token", "aCompletelyDifferentPassword456"),
    ).resolves.toEqual({ userId: "user-1" });

    expect(credentialUpdate).toHaveBeenCalled();
  });
});

describe("requestEmailVerification", () => {
  it("does nothing if the identifier is already verified", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn();
    const prisma = {
      userIdentifier: {
        findFirst: vi.fn().mockResolvedValue({ value: "a@b.com", verified: true }),
      },
      emailVerificationToken: { create },
    } as any;

    await requestEmailVerification(prisma, sender, "user-1");

    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("throws if the user somehow has no email identifier at all", async () => {
    const { sender } = makeEmailSender();
    const prisma = {
      userIdentifier: { findFirst: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(requestEmailVerification(prisma, sender, "user-1")).rejects.toThrow(
      "USER_HAS_NO_EMAIL_IDENTIFIER",
    );
  });

  it("creates a token and sends an email for an unverified identifier", async () => {
    const { send, sender } = makeEmailSender();
    const create = vi.fn().mockResolvedValue({ id: "tok-1" });
    const prisma = {
      userIdentifier: {
        findFirst: vi.fn().mockResolvedValue({ value: "a@b.com", verified: false }),
      },
      emailVerificationToken: { create },
    } as any;

    await requestEmailVerification(prisma, sender, "user-1");

    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].to).toBe("a@b.com");
    expect(send.mock.calls[0]![0].text).toContain("verify-email?token=");
  });
});

describe("confirmEmailVerification", () => {
  it("rejects an unknown token", async () => {
    const prisma = {
      emailVerificationToken: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;

    await expect(confirmEmailVerification(prisma, "bogus")).rejects.toThrow(
      "INVALID_OR_EXPIRED_TOKEN",
    );
  });

  it("rejects an expired token", async () => {
    const prisma = {
      emailVerificationToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        }),
      },
    } as any;

    await expect(confirmEmailVerification(prisma, "raw")).rejects.toThrow(
      "INVALID_OR_EXPIRED_TOKEN",
    );
  });

  it("marks the identifier verified and the token used for a valid token", async () => {
    const tokenUpdate = vi.fn().mockResolvedValue({});
    const identifierUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      emailVerificationToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "t1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: vi.fn(async (fn: any) =>
        fn({
          emailVerificationToken: { update: tokenUpdate },
          userIdentifier: { updateMany: identifierUpdateMany },
        }),
      ),
    } as any;

    await confirmEmailVerification(prisma, "raw-token");

    expect(tokenUpdate).toHaveBeenCalled();
    expect(identifierUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", type: "EMAIL" },
        data: { verified: true },
      }),
    );
  });
});
