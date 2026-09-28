import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserIdentifierType, UserStatus } from "@prisma/client";

const createUserSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
});

const createIdentifierSchema = z.object({
  type: z.nativeEnum(UserIdentifierType),
  value: z.string().trim().min(1),
  verified: z.boolean().optional(),
});

export async function registerIdentityRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * --------------------------------------------------------------------------
   * CREATE USER
   * --------------------------------------------------------------------------
   */

  api.post("/identity/users", async (request, reply) => {
    const body = createUserSchema.parse(request.body ?? {});

    const user = await api.prisma.user.create({
      data: {
        status: body.status ?? UserStatus.ACTIVE,
      },
      include: {
        identifiers: true,
      },
    });

    return reply.code(201).send(user);
  });




}
