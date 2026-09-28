import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "./auth.middleware.js";
import { changePassword, deactivateAccount, getSessionCookieName } from "./auth.service.js";
import { recordAuditLog, listAuditLogForUser } from "../audit/audit.service.js";

const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(191).nullable().optional(),
  lastName: z.string().trim().min(1).max(191).nullable().optional(),
  phone: z.string().trim().min(1).max(191).nullable().optional(),
  province: z.enum(SOUTH_AFRICAN_PROVINCES).nullable().optional(),
  suburb: z.string().trim().min(1).max(191).nullable().optional(),
  postalCode: z.string().trim().min(1).max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  pnpStoreCode: z.string().trim().min(1).max(20).nullable().optional()
}).refine(
  (data) =>
    data.firstName !== undefined ||
    data.lastName !== undefined ||
    data.phone !== undefined ||
    data.province !== undefined ||
    data.suburb !== undefined ||
    data.postalCode !== undefined ||
    data.latitude !== undefined ||
    data.longitude !== undefined ||
    data.pnpStoreCode !== undefined,
  {
    message: "At least one profile field must be provided for update"
  }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
});

function getAuthenticatedUserId(request: {
  currentUserId?: string;
}): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }

  return request.currentUserId;
}

export async function registerProfileRoutes(
  api: FastifyInstance
): Promise<void> {
  api.register(
    async (profile) => {
      profile.addHook("preHandler", requireAuth);

      /*
       * ----------------------------------------------------------------------
       * GET CURRENT USER PROFILE
       * ----------------------------------------------------------------------
       *
       * The authenticated user is always derived from the session.
       * The browser never supplies a userId.
       *
       * If the user has not completed profile setup yet, return a clean
       * empty profile rather than treating that as an error.
       */

      profile.get("/profile", async (request) => {
        const userId = getAuthenticatedUserId(request);

        const existingProfile =
          await profile.prisma.userProfile.findUnique({
            where: {
              userId
            }
          });

        if (!existingProfile) {
          return {
            userId,
            firstName: null,
            lastName: null,
            phone: null
          };
        }

        return existingProfile;
      });

      /*
       * ----------------------------------------------------------------------
       * UPDATE CURRENT USER PROFILE
       * ----------------------------------------------------------------------
       *
       * This is an upsert:
       * - first save creates the profile
       * - later saves update the same profile
       *
       * The unique userId constraint guarantees one profile per user.
       */

      profile.patch("/profile", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);

        const parsed = updateProfileSchema.safeParse(
          request.body ?? {}
        );

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_PROFILE",
            message:
              "At least one valid profile field must be provided."
          });
        }

        const data = parsed.data;

        const updatedProfile =
          await profile.prisma.userProfile.upsert({
            where: {
              userId
            },
            create: {
              userId,
              firstName: data.firstName ?? null,
              lastName: data.lastName ?? null,
              phone: data.phone ?? null,
              province: data.province ?? null,
              suburb: data.suburb ?? null,
              postalCode: data.postalCode ?? null,
              latitude: data.latitude ?? null,
              longitude: data.longitude ?? null,
              pnpStoreCode: data.pnpStoreCode ?? null
            },
            update: {
              ...(data.firstName !== undefined
                ? { firstName: data.firstName }
                : {}),
              ...(data.lastName !== undefined
                ? { lastName: data.lastName }
                : {}),
              ...(data.phone !== undefined
                ? { phone: data.phone }
                : {}),
              ...(data.province !== undefined
                ? { province: data.province }
                : {}),
              ...(data.suburb !== undefined
                ? { suburb: data.suburb }
                : {}),
              ...(data.postalCode !== undefined
                ? { postalCode: data.postalCode }
                : {}),
              ...(data.latitude !== undefined
                ? { latitude: data.latitude }
                : {}),
              ...(data.longitude !== undefined
                ? { longitude: data.longitude }
                : {}),
              ...(data.pnpStoreCode !== undefined
                ? { pnpStoreCode: data.pnpStoreCode }
                : {})
            }
          });

        await recordAuditLog(
          profile.prisma,
          {
            userId,
            action: "PROFILE_UPDATED",
            entityType: "UserProfile",
            entityId: userId,
            metadata: { fieldsUpdated: Object.keys(data) },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          request.log,
        );

        return updatedProfile;
      });

      /*
       * ----------------------------------------------------------------------
       * CHANGE PASSWORD (logged in)
       * ----------------------------------------------------------------------
       *
       * Distinct from /auth/password-reset/* -- this requires proving
       * knowledge of the current password rather than an emailed token,
       * since the user is already authenticated. Revokes every other
       * session on success, keeping this one (the caller's current
       * session) valid so they aren't logged out by their own request.
       */

      /*
       * ----------------------------------------------------------------------
       * VIEW MY OWN AUDIT LOG
       * ----------------------------------------------------------------------
       *
       * Self-service transparency: a user can see their own account's
       * security-relevant history (logins, profile changes, consent
       * changes, etc.) without needing to ask support. Scoped to the
       * requesting user's own entries only -- there's no cross-user
       * admin view here (that's tracked separately as its own backlog
       * item, BN-047).
       */

      profile.get("/audit-log", async (request) => {
        const userId = getAuthenticatedUserId(request);
        return listAuditLogForUser(profile.prisma, userId);
      });

      profile.post("/change-password", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);

        const parsed = changePasswordSchema.safeParse(request.body ?? {});

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_REQUEST",
            message: "Your current password and a new password (8+ characters) are required."
          });
        }

        try {
          await changePassword(
            profile.prisma,
            userId,
            parsed.data.currentPassword,
            parsed.data.newPassword,
            request.currentSessionId
          );

          await recordAuditLog(
            profile.prisma,
            {
              userId,
              action: "PASSWORD_CHANGED",
              entityType: "User",
              entityId: userId,
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"] ?? null,
            },
            request.log,
          );

          return reply.send({
            message: "Your password has been changed."
          });
        } catch (error) {
          if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
            return reply.code(400).send({
              error: "INVALID_CURRENT_PASSWORD",
              message: "Your current password is incorrect."
            });
          }

          if (error instanceof Error && error.message === "PASSWORD_REUSE_NOT_ALLOWED") {
            return reply.code(400).send({
              error: "PASSWORD_REUSE_NOT_ALLOWED",
              message: "Your new password must be different from your current password."
            });
          }

          request.log.error(error);

          return reply.code(500).send({
            error: "CHANGE_PASSWORD_FAILED",
            message: "Unable to change your password right now."
          });
        }
      });

      /*
       * ----------------------------------------------------------------------
       * DEACTIVATE ACCOUNT
       * ----------------------------------------------------------------------
       *
       * Soft-delete (status -> INACTIVE), not a real delete -- see the
       * rationale in auth.service.ts's deactivateAccount(). Clears the
       * session cookie since every session (including this one) is
       * revoked as part of deactivation.
       */

      profile.post("/deactivate", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);

        await deactivateAccount(profile.prisma, userId);

        await recordAuditLog(
          profile.prisma,
          {
            userId,
            action: "ACCOUNT_DEACTIVATED",
            entityType: "User",
            entityId: userId,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          },
          request.log,
        );

        reply.clearCookie(getSessionCookieName(), { path: "/" });

        return reply.send({
          message: "Your account has been deactivated."
        });
      });
    },
    {
      prefix: "/me"
    }
  );
}
