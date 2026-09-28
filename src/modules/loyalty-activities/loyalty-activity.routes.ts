import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LoyaltyActivityType } from "@prisma/client";

import { requireAuth } from "../auth/auth.middleware.js";

const createActivitySchema = z.object({
  type: z.nativeEnum(LoyaltyActivityType),
  reference: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.coerce.date().optional(),
  points: z.coerce.number().optional(),
});

const activityInclude = {
  loyaltyAccount: {
    include: {
      loyaltyProgram: {
        include: {
          retailer: true,
        },
      },
    },
  },
} as const;

export async function registerLoyaltyActivityRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * ==========================================================================
   * All loyalty activity belongs to a specific user's loyalty account.
   *
   * SECURITY:
   * Every route below requires authentication and is filtered to loyalty
   * accounts owned by the authenticated user (loyaltyAccount.userId).
   * Previously "/loyalty-activities" returned every user's activity ledger
   * to any caller, authenticated or not.
   * ==========================================================================
   */
  await api.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    /*
     * --------------------------------------------------------------------------
     * LIST THE AUTHENTICATED USER'S ACTIVITY (across all their loyalty accounts)
     * --------------------------------------------------------------------------
     */

    scoped.get("/loyalty-activities", async (request) => {
      if (!request.currentUserId) {
        throw new Error("AUTHENTICATED_USER_ID_MISSING");
      }

      const userId = request.currentUserId;

      return scoped.prisma.loyaltyActivity.findMany({
        where: {
          loyaltyAccount: {
            userId,
          },
        },
        orderBy: {
          occurredAt: "desc",
        },
        include: activityInclude,
      });
    });

    /*
     * --------------------------------------------------------------------------
     * GET A SINGLE ACTIVITY (must belong to the authenticated user)
     * --------------------------------------------------------------------------
     */

    scoped.get<{ Params: { activityId: string } }>(
      "/loyalty-activities/:activityId",
      async (request, reply) => {
        if (!request.currentUserId) {
          throw new Error("AUTHENTICATED_USER_ID_MISSING");
        }

        const userId = request.currentUserId;

        const activity = await scoped.prisma.loyaltyActivity.findFirst({
          where: {
            id: request.params.activityId,
            loyaltyAccount: {
              userId,
            },
          },
          include: activityInclude,
        });

        if (!activity) {
          return reply.code(404).send({
            error: "LOYALTY_ACTIVITY_NOT_FOUND",
            message: "Loyalty activity was not found",
          });
        }

        return activity;
      }
    );

    /*
     * --------------------------------------------------------------------------
     * CREATE LOYALTY ACTIVITY (loyalty account must belong to the caller)
     * --------------------------------------------------------------------------
     */

    scoped.post<{
      Params: { loyaltyAccountId: string };
    }>(
      "/loyalty-accounts/:loyaltyAccountId/activities",
      async (request, reply) => {
        const body = createActivitySchema.parse(request.body ?? {});
        const userId = request.currentUserId as string;

        const loyaltyAccount = await scoped.prisma.loyaltyAccount.findFirst({
          where: {
            id: request.params.loyaltyAccountId,
            userId,
          },
        });

        if (!loyaltyAccount) {
          return reply.code(404).send({
            error: "LOYALTY_ACCOUNT_NOT_FOUND",
            message: "Loyalty account was not found",
          });
        }

        const points = body.points ?? 0;

        if (
          ["EARN", "BONUS", "REDEEM", "EXPIRY"].includes(body.type) &&
          points < 0
        ) {
          return reply.code(400).send({
            error: "INVALID_ACTIVITY_POINTS",
            message: `${body.type} activity points must be zero or positive`,
          });
        }

        const balanceDelta =
          body.type === "EARN" || body.type === "BONUS"
            ? points
            : body.type === "REDEEM" || body.type === "EXPIRY"
              ? -points
              : points;

        let result;

        try {
          result = await scoped.prisma.$transaction(async (tx) => {
            const currentAccount = await tx.loyaltyAccount.findFirst({
              where: {
                id: loyaltyAccount.id,
                userId,
              },
            });

            if (!currentAccount) {
              throw new Error("LOYALTY_ACCOUNT_NOT_FOUND");
            }

            const currentBalance = Number(currentAccount.pointsBalance);
            const newBalance = currentBalance + balanceDelta;

            if (newBalance < 0) {
              throw new Error("INSUFFICIENT_POINTS_BALANCE");
            }

            const activity = await tx.loyaltyActivity.create({
              data: {
                loyaltyAccountId: currentAccount.id,
                type: body.type,
                ...(body.reference !== undefined && {
                  reference: body.reference,
                }),
                ...(body.description !== undefined && {
                  description: body.description,
                }),
                ...(body.occurredAt !== undefined && {
                  occurredAt: body.occurredAt,
                }),
                points,
              },
              include: activityInclude,
            });

            const updatedAccount = await tx.loyaltyAccount.update({
              where: {
                id: currentAccount.id,
              },
              data: {
                pointsBalance: newBalance,
              },
            });

            return {
              activity,
              loyaltyAccount: updatedAccount,
            };
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "LOYALTY_ACCOUNT_NOT_FOUND"
          ) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found",
            });
          }

          if (
            error instanceof Error &&
            error.message === "INSUFFICIENT_POINTS_BALANCE"
          ) {
            return reply.code(400).send({
              error: "INSUFFICIENT_POINTS_BALANCE",
              message: "Insufficient loyalty points balance",
            });
          }

          throw error;
        }

        return reply.code(201).send({
          ...result.activity,
          loyaltyAccount: {
            ...result.activity.loyaltyAccount,
            pointsBalance: result.loyaltyAccount.pointsBalance,
          },
        });
      }
    );

    /*
     * --------------------------------------------------------------------------
     * LIST ACTIVITIES FOR A SPECIFIC (owned) LOYALTY ACCOUNT
     * --------------------------------------------------------------------------
     */

    scoped.get<{
      Params: { loyaltyAccountId: string };
    }>(
      "/loyalty-accounts/:loyaltyAccountId/activities",
      async (request, reply) => {
        if (!request.currentUserId) {
          throw new Error("AUTHENTICATED_USER_ID_MISSING");
        }

        const userId = request.currentUserId;

        const loyaltyAccount = await scoped.prisma.loyaltyAccount.findFirst({
          where: {
            id: request.params.loyaltyAccountId,
            userId,
          },
          select: {
            id: true,
          },
        });

        if (!loyaltyAccount) {
          return reply.code(404).send({
            error: "LOYALTY_ACCOUNT_NOT_FOUND",
            message: "Loyalty account was not found",
          });
        }

        return scoped.prisma.loyaltyActivity.findMany({
          where: {
            loyaltyAccountId: loyaltyAccount.id,
          },
          orderBy: {
            occurredAt: "desc",
          },
        });
      }
    );
  });
}
