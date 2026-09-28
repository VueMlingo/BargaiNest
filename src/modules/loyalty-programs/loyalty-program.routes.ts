import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LoyaltyProgramStatus } from "@prisma/client";

import { requireAuth } from "../auth/auth.middleware.js";

const createLoyaltyProgramSchema = z.object({
  retailerId: z.string().uuid(),
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  status: z.nativeEnum(LoyaltyProgramStatus).optional(),
});

const updateLoyaltyProgramSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  status: z.nativeEnum(LoyaltyProgramStatus).optional(),
});

export async function registerLoyaltyProgramRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * ==========================================================================
   * BN-011: this module had no authentication at all -- same gap already
   * identified and fixed in reward.routes.ts / loyalty-activity.routes.ts,
   * extended here (and to retailer, product, and price-observation routes,
   * its three siblings with the identical gap).
   *
   * A second, separate issue found while fixing this: the general listing
   * and lookup endpoints below included `accounts: true` -- meaning any
   * caller, even once authenticated, could see every enrolled user's
   * LoyaltyAccount records (including account numbers) just by listing
   * programs. That include is removed from the general endpoints; loyalty
   * program metadata (name, code, retailer) doesn't need to expose who's
   * enrolled in it.
   * ==========================================================================
   */
  await api.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

  /*
   * --------------------------------------------------------------------------
   * CREATE LOYALTY PROGRAM
   * --------------------------------------------------------------------------
   */

  scoped.post("/loyalty-programs", async (request, reply) => {
    const body = createLoyaltyProgramSchema.parse(request.body ?? {});

    const retailer = await api.prisma.retailer.findUnique({
      where: {
        id: body.retailerId,
      },
    });

    if (!retailer) {
      return reply.code(404).send({
        error: "RETAILER_NOT_FOUND",
        message: "Retailer was not found",
      });
    }

    const program = await api.prisma.loyaltyProgram.create({
      data: {
        retailerId: body.retailerId,
        name: body.name,
        code: body.code,
        status: body.status ?? LoyaltyProgramStatus.ACTIVE,
      },
      include: {
        retailer: true,
      },
    });

    return reply.code(201).send(program);
  });

  /*
   * --------------------------------------------------------------------------
   * LIST LOYALTY PROGRAMS
   * --------------------------------------------------------------------------
   */

  scoped.get("/loyalty-programs", async () => {
    return api.prisma.loyaltyProgram.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        retailer: true,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * LIST PROGRAMS FOR RETAILER
   * --------------------------------------------------------------------------
   */

  scoped.get<{ Params: { retailerId: string } }>(
    "/retailers/:retailerId/loyalty-programs",
    async (request, reply) => {
      const retailer = await api.prisma.retailer.findUnique({
        where: {
          id: request.params.retailerId,
        },
        select: {
          id: true,
        },
      });

      if (!retailer) {
        return reply.code(404).send({
          error: "RETAILER_NOT_FOUND",
          message: "Retailer was not found",
        });
      }

      return api.prisma.loyaltyProgram.findMany({
        where: {
          retailerId: request.params.retailerId,
        },
        orderBy: {
          name: "asc",
        },
      });
    }
  );

  /*
   * --------------------------------------------------------------------------
   * GET LOYALTY PROGRAM
   * --------------------------------------------------------------------------
   */

  scoped.get<{ Params: { loyaltyProgramId: string } }>(
    "/loyalty-programs/:loyaltyProgramId",
    async (request, reply) => {
      const program = await api.prisma.loyaltyProgram.findUnique({
        where: {
          id: request.params.loyaltyProgramId,
        },
        include: {
          retailer: true,
        },
      });

      if (!program) {
        return reply.code(404).send({
          error: "LOYALTY_PROGRAM_NOT_FOUND",
          message: "Loyalty program was not found",
        });
      }

      return program;
    }
  );

  /*
   * --------------------------------------------------------------------------
   * UPDATE LOYALTY PROGRAM
   * --------------------------------------------------------------------------
   */

  scoped.patch<{ Params: { loyaltyProgramId: string } }>(
    "/loyalty-programs/:loyaltyProgramId",
    async (request, reply) => {
      const body = updateLoyaltyProgramSchema.parse(request.body ?? {});

      const existing = await api.prisma.loyaltyProgram.findUnique({
        where: {
          id: request.params.loyaltyProgramId,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "LOYALTY_PROGRAM_NOT_FOUND",
          message: "Loyalty program was not found",
        });
      }

      const program = await api.prisma.loyaltyProgram.update({
        where: {
          id: request.params.loyaltyProgramId,
        },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
        include: {
          retailer: true,
        },
      });

      return program;
    }
  );
  });
}
