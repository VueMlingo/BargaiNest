import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";
import { hashPassword, hashToken, revokeAllUserSessions, verifyPassword } from "./auth.service.js";
import type { EmailSender } from "../../integrations/email/email-sender.js";

const RESET_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_BYTES = 32;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildResetUrl(token: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
}

function buildVerificationUrl(token: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/verify-email?token=${token}`;
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Always resolves without throwing, and the route layer always
 * returns the same generic response regardless of outcome -- this is
 * deliberate: revealing "no such account" here would let anyone probe
 * which emails are registered (a real, common enumeration attack on
 * password-reset endpoints, not a theoretical one).
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  emailSender: EmailSender,
  email: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  const identifier = await prisma.userIdentifier.findUnique({
    where: { type_value: { type: "EMAIL", value: normalizedEmail } },
    select: { userId: true },
  });

  if (!identifier) {
    return; // silent -- see enumeration note above
  }

  // Throttle: if a still-valid, unused token already exists and was
  // issued in the last 2 minutes, don't issue another or send another
  // email. Cheap, targeted abuse protection for this one endpoint --
  // full rate limiting is tracked separately (BN-034) and this isn't
  // a substitute for it, just a minimum before that lands.
  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId: identifier.userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
    },
  });

  if (recent) {
    return;
  }

  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  await prisma.passwordResetToken.create({
    data: {
      userId: identifier.userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });

  await emailSender.send({
    to: normalizedEmail,
    subject: "Reset your BargaiNest password",
    text:
      `We received a request to reset your BargaiNest password. ` +
      `This link expires in ${env.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes ` +
      `and can only be used once:\n\n${buildResetUrl(rawToken)}\n\n` +
      `If you didn't request this, you can safely ignore this email -- ` +
      `your password will not be changed.`,
  });
}

export async function confirmPasswordReset(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
): Promise<{ userId: string }> {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  const credential = await prisma.userCredential.findUnique({
    where: { userId: resetToken.userId },
  });

  if (credential) {
    const isSameAsCurrentPassword = await verifyPassword(newPassword, credential.passwordHash);
    if (isSameAsCurrentPassword) {
      throw new Error("PASSWORD_REUSE_NOT_ALLOWED");
    }
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await tx.userCredential.update({
      where: { userId: resetToken.userId },
      data: { passwordHash },
    });
  });

  // Security best practice: a password reset should invalidate every
  // existing session, not just leave old ones (possibly compromised,
  // which may be exactly why the user is resetting) still valid.
  await revokeAllUserSessions(prisma, resetToken.userId);

  return { userId: resetToken.userId };
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function requestEmailVerification(
  prisma: PrismaClient,
  emailSender: EmailSender,
  userId: string,
): Promise<void> {
  const identifier = await prisma.userIdentifier.findFirst({
    where: { userId, type: "EMAIL" },
  });

  if (!identifier) {
    throw new Error("USER_HAS_NO_EMAIL_IDENTIFIER");
  }

  if (identifier.verified) {
    return; // already verified -- nothing to send, not an error
  }

  const rawToken = randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });

  await emailSender.send({
    to: identifier.value,
    subject: "Verify your BargaiNest email address",
    text:
      `Please confirm your email address to finish setting up your ` +
      `BargaiNest account. This link expires in ` +
      `${env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours:\n\n` +
      `${buildVerificationUrl(rawToken)}`,
  });
}

export async function confirmEmailVerification(
  prisma: PrismaClient,
  token: string,
): Promise<{ userId: string }> {
  const tokenHash = hashToken(token);

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= new Date()
  ) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    await tx.userIdentifier.updateMany({
      where: { userId: verificationToken.userId, type: "EMAIL" },
      data: { verified: true },
    });
  });

  return { userId: verificationToken.userId };
}
