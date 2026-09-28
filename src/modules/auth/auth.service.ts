import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

import type { PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = "bn_session";
const PASSWORD_KEY_LENGTH = 64;

export type AuthUser = {
  id: string;
  status: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export type AuthSessionResult = {
  token: string;
  expiresAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Same algorithm as hashSessionToken -- exported generically since
 * password-reset and email-verification tokens need the identical
 * "never store the raw value" treatment AuthSession already
 * established, without pretending they're session tokens.
 */
export function hashToken(token: string): string {
  return hashSessionToken(token);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH
  )) as Buffer;

  return [
    "scrypt",
    "N=16384,r=8,p=1",
    salt,
    derivedKey.toString("hex")
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$");

  if (parts.length !== 4) {
    return false;
  }

  const [algorithm, parameters, salt, storedKeyHex] = parts;

  if (
    algorithm !== "scrypt" ||
    parameters !== "N=16384,r=8,p=1" ||
    !salt ||
    !storedKeyHex
  ) {
    return false;
  }

  const storedKey = Buffer.from(storedKeyHex, "hex");

  const derivedKey = (await scrypt(
    password,
    salt,
    storedKey.length
  )) as Buffer;

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}

function buildAuthUser(
  user: {
    id: string;
    status: string;
    identifiers: Array<{
      value: string;
      verified: boolean;
    }>;
    profile?: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  }
): AuthUser {
  const emailIdentifier = user.identifiers[0];

  if (!emailIdentifier) {
    throw new Error("User does not have an email identifier");
  }

  const firstName = user.profile?.firstName?.trim() ?? "";
  const lastName = user.profile?.lastName?.trim() ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ");

  return {
    id: user.id,
    status: user.status,
    email: emailIdentifier.value,
    emailVerified: emailIdentifier.verified,
    name
  };
}

export async function registerUser(
  prisma: PrismaClient,
  email: string,
  password: string
): Promise<AuthUser> {
  const normalizedEmail = normalizeEmail(email);

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existingIdentifier = await tx.userIdentifier.findUnique({
        where: {
          type_value: {
            type: "EMAIL",
            value: normalizedEmail
          }
        }
      });

      if (existingIdentifier) {
        throw new Error("EMAIL_ALREADY_REGISTERED");
      }

      return tx.user.create({
        data: {
          status: "ACTIVE",
          identifiers: {
            create: {
              type: "EMAIL",
              value: normalizedEmail,
              verified: false
            }
          },
          credential: {
            create: {
              passwordHash
            }
          }
        },
        include: {
          identifiers: {
            where: {
              type: "EMAIL"
            },
            select: {
              value: true,
              verified: true
            }
          },
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
    });

    return buildAuthUser(user);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EMAIL_ALREADY_REGISTERED"
    ) {
      throw error;
    }

    const prismaError = error as { code?: string };

    if (prismaError.code === "P2002") {
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    throw error;
  }
}

export async function authenticateUser(
  prisma: PrismaClient,
  email: string,
  password: string
): Promise<AuthUser> {
  const normalizedEmail = normalizeEmail(email);

  const identifier = await prisma.userIdentifier.findUnique({
    where: {
      type_value: {
        type: "EMAIL",
        value: normalizedEmail
      }
    },
      include: {
        user: {
          include: {
            credential: true,
            identifiers: {
              where: {
                type: "EMAIL"
              },
              select: {
                value: true,
                verified: true
              }
            },
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

  if (!identifier || !identifier.user.credential) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validPassword = await verifyPassword(
    password,
    identifier.user.credential.passwordHash
  );

  if (!validPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (identifier.user.status !== "ACTIVE") {
    throw new Error("USER_NOT_ACTIVE");
  }

  return buildAuthUser(identifier.user);
}

export async function createSession(
  prisma: PrismaClient,
  userId: string
): Promise<AuthSessionResult> {
  const token = randomBytes(48).toString("base64url");

  const expiresAt = new Date(
    Date.now() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt
    }
  });

  return {
    token,
    expiresAt
  };
}

export async function getUserFromSession(
  prisma: PrismaClient,
  token: string
): Promise<{
  user: AuthUser;
  sessionId: string;
} | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.authSession.findUnique({
    where: {
      tokenHash
    },
    include: {
      user: {
        include: {
          identifiers: {
            where: {
              type: "EMAIL"
            },
            select: {
              value: true,
              verified: true
            }
          },
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    return null;
  }

  if (session.user.status !== "ACTIVE") {
    return null;
  }

  await prisma.authSession.update({
    where: {
      id: session.id
    },
    data: {
      lastUsedAt: new Date()
    }
  });

  return {
    user: buildAuthUser(session.user),
    sessionId: session.id
  };
}

export async function revokeSession(
  prisma: PrismaClient,
  token: string
): Promise<void> {
  const tokenHash = hashSessionToken(token);

  await prisma.authSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function revokeAllUserSessions(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

/**
 * Distinct from the password-reset flow: this is the logged-in
 * "change my password" self-service action, which requires proving
 * knowledge of the CURRENT password rather than a one-time emailed
 * token. Revokes every OTHER session on success (not this one --
 * the caller is still mid-request on their current session), same
 * security rationale as a reset: a password change is a reasonable
 * moment to force re-authentication everywhere else.
 */
export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string
): Promise<void> {
  const credential = await prisma.userCredential.findUnique({
    where: { userId }
  });

  if (!credential) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validCurrentPassword = await verifyPassword(
    currentPassword,
    credential.passwordHash
  );

  if (!validCurrentPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const isSameAsCurrentPassword = await verifyPassword(
    newPassword,
    credential.passwordHash
  );

  if (isSameAsCurrentPassword) {
    throw new Error("PASSWORD_REUSE_NOT_ALLOWED");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.userCredential.update({
    where: { userId },
    data: { passwordHash }
  });

  await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {})
    },
    data: { revokedAt: new Date() }
  });
}

/**
 * Soft-delete: sets status to INACTIVE (already an existing
 * UserStatus value) and revokes every session, rather than actually
 * deleting the row. A hard delete would cascade-destroy loyalty
 * accounts, shopping lists, etc. -- not something a single click
 * should do irreversibly, and likely wrong for data-retention/audit
 * obligations anyway. Reactivation (if ever needed) is a support/admin
 * action, not built here.
 */
export async function deactivateAccount(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { status: "INACTIVE" }
  });

  await revokeAllUserSessions(prisma, userId);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}
