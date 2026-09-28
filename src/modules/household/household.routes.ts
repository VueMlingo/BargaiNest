import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { getUserFromSession, getSessionCookieName } from "../auth/auth.service.js";
import { createEmailSender } from "../../integrations/email/email-sender.js";
import { nodemailerTransporterFactory } from "../../integrations/email/nodemailer-transporter.js";
import { env } from "../../config/env.js";
import {
  acceptHouseholdInvite,
  createHousehold,
  updateHouseholdName,
  deleteHousehold,
  getHouseholdForUser,
  getPendingInvitesForEmail,
  inviteHouseholdMember,
  removeHouseholdMember,
} from "./household.service.js";

const createHouseholdSchema = z.object({ name: z.string().trim().min(1).max(191) });
const inviteMemberSchema = z.object({ email: z.string().trim().email() });

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

export async function registerHouseholdRoutes(api: FastifyInstance): Promise<void> {
  const emailSender = createEmailSender(env, nodemailerTransporterFactory, api.log);

  api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

      scope.get("/household", async (request) => {
        const userId = getAuthenticatedUserId(request);
        const household = await getHouseholdForUser(scope.prisma, userId);
        return household ?? null;
      });

      scope.get("/household/invites", async (request, reply) => {
        const cookieToken = request.cookies?.[getSessionCookieName()];
        const session = cookieToken ? await getUserFromSession(scope.prisma, cookieToken) : null;

        if (!session) {
          return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
        }

        return getPendingInvitesForEmail(scope.prisma, session.user.email);
      });

      scope.post("/household", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const parsed = createHouseholdSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.code(400).send({ error: "INVALID_REQUEST", message: "A household name is required." });
        }

        try {
          const household = await createHousehold(scope.prisma, userId, parsed.data.name);
          return reply.code(201).send(household);
        } catch (error) {
          if (error instanceof Error && error.message === "HOUSEHOLD_ALREADY_EXISTS") {
            return reply.code(409).send({
              error: "HOUSEHOLD_ALREADY_EXISTS",
              message: "You already belong to a household.",
            });
          }
          throw error;
        }
      });

      scope.patch<{ Params: { householdId: string } }>(
        "/household/:householdId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const parsed = createHouseholdSchema.safeParse(request.body ?? {});
          if (!parsed.success) {
            return reply.code(400).send({ error: "INVALID_REQUEST", message: "A household name is required." });
          }

          try {
            const household = await updateHouseholdName(
              scope.prisma,
              userId,
              request.params.householdId,
              parsed.data.name,
            );
            return reply.send(household);
          } catch (error) {
            if (error instanceof Error && error.message === "HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER") {
              return reply.code(403).send({
                error: "NOT_HOUSEHOLD_OWNER",
                message: "Only the household owner can rename the household.",
              });
            }
            throw error;
          }
        },
      );

      scope.delete<{ Params: { householdId: string } }>(
        "/household/:householdId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          try {
            await deleteHousehold(scope.prisma, userId, request.params.householdId);
            return reply.send({ message: "Household deleted." });
          } catch (error) {
            if (error instanceof Error && error.message === "HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER") {
              return reply.code(403).send({
                error: "NOT_HOUSEHOLD_OWNER",
                message: "Only the household owner can delete the household.",
              });
            }
            throw error;
          }
        },
      );

      scope.post<{ Params: { householdId: string } }>(
        "/household/:householdId/members",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const parsed = inviteMemberSchema.safeParse(request.body ?? {});
          if (!parsed.success) {
            return reply.code(400).send({ error: "INVALID_REQUEST", message: "A valid email is required." });
          }

          try {
            const member = await inviteHouseholdMember(
              scope.prisma,
              emailSender,
              userId,
              request.params.householdId,
              parsed.data.email,
            );
            return reply.code(201).send(member);
          } catch (error) {
            if (error instanceof Error && error.message === "HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER") {
              return reply.code(403).send({
                error: "NOT_HOUSEHOLD_OWNER",
                message: "Only the household owner can invite members.",
              });
            }
            throw error;
          }
        },
      );

      scope.post<{ Params: { householdId: string } }>(
        "/household/:householdId/accept",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const cookieToken = request.cookies?.[getSessionCookieName()];
          const session = cookieToken ? await getUserFromSession(scope.prisma, cookieToken) : null;

          if (!session) {
            return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
          }

          try {
            const member = await acceptHouseholdInvite(
              scope.prisma,
              userId,
              session.user.email,
              request.params.householdId,
            );
            return reply.send(member);
          } catch (error) {
            if (error instanceof Error && error.message === "INVITE_NOT_FOUND") {
              return reply.code(404).send({
                error: "INVITE_NOT_FOUND",
                message: "No pending invite found for your email address.",
              });
            }
            throw error;
          }
        },
      );

      scope.delete<{ Params: { householdId: string; memberId: string } }>(
        "/household/:householdId/members/:memberId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          try {
            await removeHouseholdMember(
              scope.prisma,
              userId,
              request.params.householdId,
              request.params.memberId,
            );
            return reply.send({ message: "Member removed." });
          } catch (error) {
            if (error instanceof Error && error.message === "HOUSEHOLD_NOT_FOUND_OR_NOT_OWNER") {
              return reply.code(403).send({
                error: "NOT_HOUSEHOLD_OWNER",
                message: "Only the household owner can remove members.",
              });
            }
            throw error;
          }
        },
      );
    },
    { prefix: "/me" },
  );
}
