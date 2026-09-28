import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import { SENSITIVE_ROUTE_RATE_LIMITS } from "../../config/rate-limit.config.js";
import {
  authenticateUser,
  createSession,
  getSessionCookieName,
  getUserFromSession,
  registerUser,
  revokeSession
} from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";
import { createEmailSender } from "../../integrations/email/email-sender.js";
import { nodemailerTransporterFactory } from "../../integrations/email/nodemailer-transporter.js";
import { requestEmailVerification } from "./password-recovery.service.js";
import { recordAuditLog } from "../audit/audit.service.js";

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128)
});

function setSessionCookie(
  reply: {
    setCookie: (
      name: string,
      value: string,
      options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax" | "strict" | "none";
        path: string;
        expires: Date;
      }
    ) => unknown;
  },
  token: string,
  expiresAt: Date
): void {
  reply.setCookie(getSessionCookieName(), token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function registerAuthRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.post(
    "/auth/register",
    { config: { rateLimit: SENSITIVE_ROUTE_RATE_LIMITS.register } },
    async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REGISTRATION",
        message: "A valid email address and password are required."
      });
    }

    try {
      const user = await registerUser(
        fastify.prisma,
        parsed.data.email,
        parsed.data.password
      );

      const session = await createSession(
        fastify.prisma,
        user.id
      );

      setSessionCookie(reply, session.token, session.expiresAt);

      await recordAuditLog(
        fastify.prisma,
        {
          userId: user.id,
          action: "REGISTER",
          entityType: "User",
          entityId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        request.log,
      );

      // Best-effort, non-blocking: a failure here must never prevent
      // account creation from succeeding -- the user can always
      // request verification again later via
      // POST /auth/email-verification/request.
      try {
        const emailSender = createEmailSender(env, nodemailerTransporterFactory, fastify.log);
        await requestEmailVerification(fastify.prisma, emailSender, user.id);
      } catch (verificationError) {
        request.log.error(
          verificationError,
          "failed to send initial verification email after registration",
        );
      }

      return reply.code(201).send({
        user,
        session: {
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "EMAIL_ALREADY_REGISTERED"
      ) {
        return reply.code(409).send({
          error: "EMAIL_ALREADY_REGISTERED",
          message: "An account with this email address already exists."
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        error: "REGISTRATION_FAILED",
        message: "Unable to create the account."
      });
    }
  });

  fastify.post(
    "/auth/login",
    { config: { rateLimit: SENSITIVE_ROUTE_RATE_LIMITS.login } },
    async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_LOGIN",
        message: "Email and password are required."
      });
    }

    try {
      const user = await authenticateUser(
        fastify.prisma,
        parsed.data.email,
        parsed.data.password
      );

      const session = await createSession(
        fastify.prisma,
        user.id
      );

      setSessionCookie(reply, session.token, session.expiresAt);

      await recordAuditLog(
        fastify.prisma,
        {
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "User",
          entityId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        request.log,
      );

      return {
        user,
        session: {
          expiresAt: session.expiresAt
        }
      };
    } catch (error) {
      // Deliberately does not attempt to look up which user this
      // email belongs to before logging -- doing so would mean this
      // audit-logging code path itself could leak whether an email is
      // registered, the same enumeration risk already guarded against
      // in password-recovery.service.ts. The attempted email is
      // recorded for security review (spotting brute-force patterns),
      // without a userId, since the user's identity was never
      // confirmed.
      await recordAuditLog(
        fastify.prisma,
        {
          action: "LOGIN_FAILURE",
          entityType: "User",
          metadata: { attemptedEmail: parsed.data.email },
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        },
        request.log,
      );

      if (
        error instanceof Error &&
        error.message === "USER_NOT_ACTIVE"
      ) {
        return reply.code(403).send({
          error: "USER_NOT_ACTIVE",
          message: "This account is not currently active."
        });
      }

      return reply.code(401).send({
        error: "INVALID_CREDENTIALS",
        message: "Invalid email or password."
      });
    }
  });

  fastify.post("/auth/logout", async (request, reply) => {
    const cookieToken = request.cookies?.[getSessionCookieName()];

    const authorization = request.headers.authorization;

    let bearerToken: string | null = null;

    if (authorization) {
      const [scheme, token] = authorization.split(" ");

      if (scheme?.toLowerCase() === "bearer" && token) {
        bearerToken = token;
      }
    }

    const token = cookieToken || bearerToken;

    if (token) {
      const session = await getUserFromSession(fastify.prisma, token);
      await revokeSession(fastify.prisma, token);

      if (session) {
        await recordAuditLog(
          fastify.prisma,
          {
            userId: session.user.id,
            action: "LOGOUT",
            entityType: "User",
            entityId: session.user.id,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          request.log,
        );
      }
    }

    reply.clearCookie(getSessionCookieName(), {
      path: "/"
    });

    return {
      success: true
    };
  });

  fastify.get(
    "/auth/me",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      const cookieToken =
        request.cookies?.[getSessionCookieName()];

      const authorization = request.headers.authorization;

      let bearerToken: string | null = null;

      if (authorization) {
        const [scheme, token] = authorization.split(" ");

        if (scheme?.toLowerCase() === "bearer" && token) {
          bearerToken = token;
        }
      }

      const token = cookieToken || bearerToken;

      if (!token) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Authentication is required."
        });
      }

      const result = await getUserFromSession(
        fastify.prisma,
        token
      );

      if (!result) {
        return reply.code(401).send({
          error: "INVALID_SESSION",
          message: "The authentication session is invalid or expired."
        });
      }

      return {
        user: result.user
      };
    }
  );
}
