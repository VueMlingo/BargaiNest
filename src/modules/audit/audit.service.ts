import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * BRS Section 15 names four categories explicitly: authentication,
 * profile changes, card additions, and consent changes. This type is
 * deliberately closed to exactly those (plus a couple of directly
 * adjacent events -- logout, deactivation -- that are clearly part of
 * "authentication" even if not named verbatim) rather than a free-form
 * string, so every call site is forced to pick a real, intentional
 * category rather than inventing ad-hoc action names over time.
 */
export type AuditAction =
  | "REGISTER"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_CHANGED"
  | "EMAIL_VERIFIED"
  | "ACCOUNT_DEACTIVATED"
  | "PROFILE_UPDATED"
  | "LOYALTY_ACCOUNT_CREATED"
  | "LOYALTY_CARD_ADDED"
  | "CONSENT_UPDATED";

export interface RecordAuditLogInput {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogger {
  warn(payload: Record<string, unknown>, message: string): void;
}

/**
 * Never throws. An audit-logging failure must not break the real
 * operation it's recording (a user's login should not fail because
 * the audit_logs insert failed) -- the failure is logged for
 * visibility instead of silently swallowed, but never propagated.
 */
export async function recordAuditLog(
  prisma: PrismaClient,
  input: RecordAuditLogInput,
  logger?: AuditLogger,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ...(input.metadata != null
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    logger?.warn({ error, input }, "failed to record audit log entry");
  }
}

export async function listAuditLogForUser(
  prisma: PrismaClient,
  userId: string,
  limit = 100,
) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
