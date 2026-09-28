import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getUserFromSession, getSessionCookieName } from "./auth.service.js";
import { createEmailSender } from "../../integrations/email/email-sender.js";
import { nodemailerTransporterFactory } from "../../integrations/email/nodemailer-transporter.js";
import { env } from "../../config/env.js";
import {
  listSupportRequestsForUser,
  submitSupportRequest,
  listAllSupportRequests,
  resolveSupportRequest,
  replyToSupportRequest,
} from "./support.service.js";
import { SENSITIVE_ROUTE_RATE_LIMITS } from "../../config/rate-limit.config.js";

const submitSupportSchema = z.object({
  email: z.string().trim().email(),
  subject: z.string().trim().min(1).max(191),
  message: z.string().trim().min(1).max(4000),
});

export async function registerSupportRoutes(fastify: FastifyInstance): Promise<void> {
  const emailSender = createEmailSender(env, nodemailerTransporterFactory, fastify.log);

  /*
   * Deliberately NOT behind requireAuth -- "I can't log in" is exactly
   * the kind of support request a logged-out visitor needs to make.
   * If a valid session happens to be present, the request is linked
   * to that user anyway (best-effort, not required).
   */
  fastify.post(
    "/support/requests",
    { config: { rateLimit: SENSITIVE_ROUTE_RATE_LIMITS.supportRequest } },
    async (request, reply) => {
    const parsed = submitSupportSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_REQUEST",
        message: "A valid email, subject, and message are required.",
      });
    }

    let userId: string | null = null;
    const cookieToken = request.cookies?.[getSessionCookieName()];
    if (cookieToken) {
      const session = await getUserFromSession(fastify.prisma, cookieToken);
      if (session) userId = session.user.id;
    }

    try {
      const supportRequest = await submitSupportRequest(fastify.prisma, emailSender, {
        userId,
        ...parsed.data,
      });

      return reply.code(201).send({
        message: "Your request has been received. We'll get back to you by email.",
        requestId: supportRequest.id,
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: "SUPPORT_REQUEST_FAILED",
        message: "Unable to submit your request right now.",
      });
    }
  });

  fastify.get("/me/support/requests", async (request, reply) => {
    const cookieToken = request.cookies?.[getSessionCookieName()];
    if (!cookieToken) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
    }

    const session = await getUserFromSession(fastify.prisma, cookieToken);
    if (!session) {
      return reply.code(401).send({ error: "INVALID_SESSION", message: "The authentication session is invalid or expired." });
    }

    return listSupportRequestsForUser(fastify.prisma, session.user.id);
  });

  /*
   * ---------------------------------------------------------------------
   * STAFF-FACING SUPPORT ADMIN (BN-047)
   * ---------------------------------------------------------------------
   *
   * Gated by a shared internal secret, same as the reward-expiry
   * check's trigger -- see the comment on listAllSupportRequests() in
   * support.service.ts for why this isn't a full per-staff-member
   * auth system. Fails closed (503) if the secret isn't configured at
   * all, matching the same pattern used for the internal notification
   * endpoint.
   */

  function checkInternalSecret(request: { headers: Record<string, unknown> }): string | null {
    if (!env.INTERNAL_TASK_SECRET) {
      return "INTERNAL_TASK_SECRET_NOT_CONFIGURED";
    }
    if (request.headers["x-internal-secret"] !== env.INTERNAL_TASK_SECRET) {
      return "UNAUTHORIZED";
    }
    return null;
  }

  fastify.get<{ Querystring: { status?: string } }>(
    "/internal/support/requests",
    async (request, reply) => {
      const authError = checkInternalSecret(request);
      if (authError === "INTERNAL_TASK_SECRET_NOT_CONFIGURED") {
        return reply.code(503).send({ error: authError, message: "This internal endpoint is not configured." });
      }
      if (authError) {
        return reply.code(401).send({ error: authError, message: "Invalid internal secret." });
      }

      const status =
        request.query.status === "OPEN" || request.query.status === "RESOLVED"
          ? request.query.status
          : undefined;

      return listAllSupportRequests(fastify.prisma, status);
    },
  );

  fastify.post<{ Params: { requestId: string } }>(
    "/internal/support/requests/:requestId/resolve",
    async (request, reply) => {
      const authError = checkInternalSecret(request);
      if (authError === "INTERNAL_TASK_SECRET_NOT_CONFIGURED") {
        return reply.code(503).send({ error: authError, message: "This internal endpoint is not configured." });
      }
      if (authError) {
        return reply.code(401).send({ error: authError, message: "Invalid internal secret." });
      }

      const updated = await resolveSupportRequest(fastify.prisma, request.params.requestId);
      return reply.send(updated);
    },
  );

  fastify.post<{ Params: { requestId: string }; Body: { message: string } }>(
    "/internal/support/requests/:requestId/reply",
    async (request, reply) => {
      const authError = checkInternalSecret(request);
      if (authError === "INTERNAL_TASK_SECRET_NOT_CONFIGURED") {
        return reply.code(503).send({ error: authError, message: "This internal endpoint is not configured." });
      }
      if (authError) {
        return reply.code(401).send({ error: authError, message: "Invalid internal secret." });
      }

      if (!request.body?.message || typeof request.body.message !== "string") {
        return reply.code(400).send({ error: "INVALID_REQUEST", message: "A reply message is required." });
      }

      try {
        const updated = await replyToSupportRequest(
          fastify.prisma,
          emailSender,
          request.params.requestId,
          request.body.message,
        );
        return reply.send(updated);
      } catch (error) {
        if (error instanceof Error && error.message === "SUPPORT_REQUEST_NOT_FOUND") {
          return reply.code(404).send({ error: "SUPPORT_REQUEST_NOT_FOUND", message: "Support request was not found." });
        }
        throw error;
      }
    },
  );
}
