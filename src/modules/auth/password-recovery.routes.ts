import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createEmailSender } from "../../integrations/email/email-sender.js";
import { nodemailerTransporterFactory } from "../../integrations/email/nodemailer-transporter.js";
import { env } from "../../config/env.js";
import { SENSITIVE_ROUTE_RATE_LIMITS } from "../../config/rate-limit.config.js";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from "./password-recovery.service.js";
import { requireAuth } from "./auth.middleware.js";
import { recordAuditLog } from "../audit/audit.service.js";

const requestResetSchema = z.object({
  email: z.string().trim().email(),
});

const confirmResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const confirmVerificationSchema = z.object({
  token: z.string().min(1),
});

/**
 * The generic response every /password-reset/request call gets,
 * regardless of whether the email was actually registered. Revealing
 * the difference would let anyone probe which emails have BargaiNest
 * accounts -- a real enumeration risk on this specific endpoint, not
 * a theoretical one, which is why this isn't just "be nice about
 * errors" but a deliberate, tested behaviour.
 */
const GENERIC_RESET_RESPONSE = {
  message:
    "If that email address is registered, a password reset link has been sent.",
};

export async function registerPasswordRecoveryRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const emailSender = createEmailSender(env, nodemailerTransporterFactory, fastify.log);

  fastify.post(
    "/auth/password-reset/request",
    { config: { rateLimit: SENSITIVE_ROUTE_RATE_LIMITS.passwordResetRequest } },
    async (request, reply) => {
    const parsed = requestResetSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "A valid email address is required.",
      });
    }

    // Errors here must not leak whether the address exists (see the
    // enumeration note above) -- log and still return the generic
    // response rather than surfacing a 500 for a real user with a
    // real account who happened to hit a transient DB issue.
    try {
      await requestPasswordReset(fastify.prisma, emailSender, parsed.data.email);
    } catch (error) {
      request.log.error(error, "password reset request failed");
    }

    // Recorded without a resolved userId, deliberately -- same
    // enumeration-protection reasoning as the login-failure log:
    // resolving and logging a userId here would mean this audit code
    // path itself could leak whether the email is registered.
    await recordAuditLog(
      fastify.prisma,
      {
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        metadata: { email: parsed.data.email },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      },
      request.log,
    );

    return reply.send(GENERIC_RESET_RESPONSE);
  });

  fastify.post("/auth/password-reset/confirm", async (request, reply) => {
    const parsed = confirmResetSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "A reset token and a new password (8+ characters) are required.",
      });
    }

    try {
      const { userId } = await confirmPasswordReset(
        fastify.prisma,
        parsed.data.token,
        parsed.data.newPassword,
      );

      await recordAuditLog(
        fastify.prisma,
        {
          userId,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "User",
          entityId: userId,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        request.log,
      );

      return reply.send({
        message: "Your password has been reset. Please log in again.",
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_OR_EXPIRED_TOKEN") {
        return reply.code(400).send({
          error: "INVALID_OR_EXPIRED_TOKEN",
          message:
            "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      if (error instanceof Error && error.message === "PASSWORD_REUSE_NOT_ALLOWED") {
        return reply.code(400).send({
          error: "PASSWORD_REUSE_NOT_ALLOWED",
          message: "Your new password must be different from your current password.",
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        error: "PASSWORD_RESET_FAILED",
        message: "Unable to reset your password right now.",
      });
    }
  });

  /*
   * Requires an authenticated session, deliberately -- unlike
   * password-reset requests (which must work for a locked-out,
   * logged-out user), asking to (re-)verify your own email only makes
   * sense once you're already logged in as that user.
   */
  fastify.post(
    "/auth/email-verification/request",
    { preHandler: requireAuth },
    async (request, reply) => {
      // requireAuth has already validated the session (cookie or
      // bearer) and guarantees currentUserId is set here -- it would
      // have sent its own 401 and short-circuited otherwise.
      const userId = request.currentUserId as string;

      try {
        await requestEmailVerification(fastify.prisma, emailSender, userId);

        return reply.send({
          message: "A verification link has been sent to your email address.",
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          error: "EMAIL_VERIFICATION_REQUEST_FAILED",
          message: "Unable to send a verification email right now.",
        });
      }
    },
  );

  fastify.post("/auth/email-verification/confirm", async (request, reply) => {
    const parsed = confirmVerificationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "A verification token is required.",
      });
    }

    try {
      const { userId } = await confirmEmailVerification(fastify.prisma, parsed.data.token);

      await recordAuditLog(
        fastify.prisma,
        {
          userId,
          action: "EMAIL_VERIFIED",
          entityType: "User",
          entityId: userId,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        request.log,
      );

      return reply.send({ message: "Your email address has been verified." });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_OR_EXPIRED_TOKEN") {
        return reply.code(400).send({
          error: "INVALID_OR_EXPIRED_TOKEN",
          message:
            "This verification link is invalid or has expired. Please request a new one.",
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        error: "EMAIL_VERIFICATION_FAILED",
        message: "Unable to verify your email right now.",
      });
    }
  });
}
