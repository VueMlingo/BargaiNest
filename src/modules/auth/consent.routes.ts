import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "./auth.middleware.js";
import { getConsentSettings, updateConsentSettings } from "./consent.service.js";
import { recordAuditLog } from "../audit/audit.service.js";

const updateConsentSchema = z
  .object({
    marketingCommunications: z.boolean().optional(),
    dataProcessing: z.boolean().optional(),
    thirdPartySharing: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one consent field must be provided",
  });

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

export async function registerConsentRoutes(api: FastifyInstance): Promise<void> {
  api.register(
    async (consent) => {
      consent.addHook("preHandler", requireAuth);

      consent.get("/consent", async (request) => {
        const userId = getAuthenticatedUserId(request);
        return getConsentSettings(consent.prisma, userId);
      });

      consent.patch("/consent", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const parsed = updateConsentSchema.safeParse(request.body ?? {});

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_REQUEST",
            message: "At least one valid consent field must be provided.",
          });
        }

        const result = await updateConsentSettings(consent.prisma, userId, parsed.data);

        await recordAuditLog(
          consent.prisma,
          {
            userId,
            action: "CONSENT_UPDATED",
            entityType: "UserConsent",
            entityId: userId,
            metadata: { fieldsUpdated: Object.keys(parsed.data) },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          request.log,
        );

        return result;
      });
    },
    { prefix: "/me" },
  );
}
