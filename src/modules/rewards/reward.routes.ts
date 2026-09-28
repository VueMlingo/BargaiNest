import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RewardStatus, RewardType } from "@prisma/client";

import { requireAuth } from "../auth/auth.middleware.js";

const createRewardSchema = z.object({
  type: z.nativeEnum(RewardType),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  value: z.coerce.number().optional(),
  pointsRequired: z.coerce.number().optional(),
  expiresAt: z.coerce.date().optional(),
  status: z.nativeEnum(RewardStatus).optional(),
});

const updateRewardSchema = z.object({
  status: z.nativeEnum(RewardStatus).optional(),
  redeemedAt: z.coerce.date().nullable().optional(),
  description: z.string().trim().min(1).optional(),
  value: z.coerce.number().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  pointsRequired: z.coerce.number().optional(),
});

const rewardInclude = {
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

export async function registerRewardRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * ==========================================================================
   * All reward data belongs to a specific user's loyalty account.
   *
   * SECURITY:
   * Every route below is registered in its own encapsulated context with a
   * requireAuth preHandler, and every query is filtered to loyalty accounts
   * owned by the authenticated user (loyaltyAccount.userId). Without this,
   * these endpoints previously returned every user's rewards to any caller.
   * ==========================================================================
   */
  await api.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    /*
     * --------------------------------------------------------------------------
     * LIST THE AUTHENTICATED USER'S REWARDS (across all their loyalty accounts)
     * --------------------------------------------------------------------------
     */

    scoped.get("/rewards", async (request) => {
      if (!request.currentUserId) {
        throw new Error("AUTHENTICATED_USER_ID_MISSING");
      }

      const userId = request.currentUserId;

      return scoped.prisma.reward.findMany({
        where: {
          loyaltyAccount: {
            userId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: rewardInclude,
      });
    });

    /*
     * --------------------------------------------------------------------------
     * GET A SINGLE REWARD (must belong to the authenticated user)
     * --------------------------------------------------------------------------
     */

    scoped.get<{ Params: { rewardId: string } }>(
      "/rewards/:rewardId",
      async (request, reply) => {
        if (!request.currentUserId) {
          throw new Error("AUTHENTICATED_USER_ID_MISSING");
        }

        const userId = request.currentUserId;

        const reward = await scoped.prisma.reward.findFirst({
          where: {
            id: request.params.rewardId,
            loyaltyAccount: {
              userId,
            },
          },
          include: rewardInclude,
        });

        if (!reward) {
          return reply.code(404).send({
            error: "REWARD_NOT_FOUND",
            message: "Reward was not found",
          });
        }

        return reward;
      }
    );

    /*
     * --------------------------------------------------------------------------
     * CREATE REWARD (loyalty account must belong to the authenticated user)
     * --------------------------------------------------------------------------
     */

    scoped.post<{
      Params: { loyaltyAccountId: string };
    }>(
      "/loyalty-accounts/:loyaltyAccountId/rewards",
      async (request, reply) => {
        const body = createRewardSchema.parse(request.body ?? {});

        if (!request.currentUserId) {
          throw new Error("AUTHENTICATED_USER_ID_MISSING");
        }

        const userId = request.currentUserId;

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

        const reward = await scoped.prisma.reward.create({
          data: {
            loyaltyAccountId: loyaltyAccount.id,
            type: body.type,
            title: body.title,
            ...(body.description !== undefined && { description: body.description }),
            ...(body.value !== undefined && { value: body.value }),
            ...(body.pointsRequired !== undefined && { pointsRequired: body.pointsRequired }),
            ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt }),
            status: body.status ?? RewardStatus.AVAILABLE,
          },
          include: rewardInclude,
        });

        return reply.code(201).send(reward);
      }
    );

    /*
     * --------------------------------------------------------------------------
     * LIST REWARDS FOR A SPECIFIC (owned) LOYALTY ACCOUNT
     * --------------------------------------------------------------------------
     */

    scoped.get<{
      Params: { loyaltyAccountId: string };
    }>(
      "/loyalty-accounts/:loyaltyAccountId/rewards",
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

        return scoped.prisma.reward.findMany({
          where: {
            loyaltyAccountId: loyaltyAccount.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      }
    );

    /*
     * --------------------------------------------------------------------------
     * UPDATE REWARD (must belong to the authenticated user)
     * --------------------------------------------------------------------------
     */

    scoped.patch<{ Params: { rewardId: string } }>(
      "/rewards/:rewardId",
      async (request, reply) => {
        const body = updateRewardSchema.parse(request.body ?? {});

        if (!request.currentUserId) {
          throw new Error("AUTHENTICATED_USER_ID_MISSING");
        }

        const userId = request.currentUserId;

        const existingReward = await scoped.prisma.reward.findFirst({
          where: {
            id: request.params.rewardId,
            loyaltyAccount: {
              userId,
            },
          },
        });

        if (!existingReward) {
          return reply.code(404).send({
            error: "REWARD_NOT_FOUND",
            message: "Reward was not found",
          });
        }

        const reward = await scoped.prisma.reward.update({
          where: {
            id: existingReward.id,
          },
          data: {
            ...(body.status !== undefined && { status: body.status }),
            ...(body.redeemedAt !== undefined && { redeemedAt: body.redeemedAt }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.value !== undefined && { value: body.value }),
            ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt }),
            ...(body.pointsRequired !== undefined && { pointsRequired: body.pointsRequired }),
          },
          include: rewardInclude,
        });

        return reward;
      }
    );
  });
}
