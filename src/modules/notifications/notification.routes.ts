import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { env } from "../../config/env.js";
import {
  getNotificationPreferences,
  listNotificationsForUser,
  markNotificationRead,
  updateNotificationPreferences,
} from "./notification-preferences.service.js";
import { createEmailSender } from "../../integrations/email/email-sender.js";
import { nodemailerTransporterFactory } from "../../integrations/email/nodemailer-transporter.js";
import { runRewardExpiryCheck } from "./reward-expiry-check.service.js";

const updatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    rewardExpiryAlerts: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one preference field must be provided",
  });

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

export async function registerNotificationRoutes(api: FastifyInstance): Promise<void> {
  api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

      scope.get("/notifications", async (request) => {
        return listNotificationsForUser(scope.prisma, getAuthenticatedUserId(request));
      });

      scope.post<{ Params: { notificationId: string } }>(
        "/notifications/:notificationId/read",
        async (request, reply) => {
          await markNotificationRead(
            scope.prisma,
            getAuthenticatedUserId(request),
            request.params.notificationId,
          );
          return reply.send({ message: "Notification marked as read." });
        },
      );

      scope.get("/notification-preferences", async (request) => {
        return getNotificationPreferences(scope.prisma, getAuthenticatedUserId(request));
      });

      scope.patch("/notification-preferences", async (request, reply) => {
        const parsed = updatePreferencesSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_REQUEST",
            message: "At least one valid preference field must be provided.",
          });
        }
        return updateNotificationPreferences(
          scope.prisma,
          getAuthenticatedUserId(request),
          parsed.data,
        );
      });
    },
    { prefix: "/me" },
  );

  /*
   * Internal trigger for the reward-expiry check -- this pilot has no
   * cron/scheduler infrastructure, so something external (a manual
   * call, a cloud scheduler job hitting this once a day, etc.) needs
   * to invoke it. NOT behind requireAuth since a scheduler is calling
   * it directly rather than a logged-in user; instead behind a shared
   * secret header, checked directly here rather than via a full new
   * auth scheme for one internal endpoint.
   */
  api.post("/internal/notifications/run-reward-expiry-check", async (request, reply) => {
    if (!env.INTERNAL_TASK_SECRET) {
      // Not configured -- refuse rather than silently allow anyone
      // through. An unset secret must never mean "no check required".
      return reply.code(503).send({
        error: "INTERNAL_TASK_SECRET_NOT_CONFIGURED",
        message: "This internal endpoint is not configured.",
      });
    }

    const providedSecret = request.headers["x-internal-secret"];
    if (providedSecret !== env.INTERNAL_TASK_SECRET) {
      return reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid internal secret." });
    }

    const emailSender = createEmailSender(env, nodemailerTransporterFactory, api.log);
    const result = await runRewardExpiryCheck(api.prisma, emailSender);
    return reply.send(result);
  });
}
