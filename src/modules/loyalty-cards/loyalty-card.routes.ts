import type { FastifyInstance } from "fastify";

import { z } from "zod";

import {
  LoyaltyCardStatus,
  Prisma,
} from "@prisma/client";

const createLoyaltyCardSchema = z.object({
  loyaltyAccountId: z.string().uuid(),
  cardNumber: z.string().trim().min(1),
  status: z.nativeEnum(LoyaltyCardStatus).optional(),
  issuedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
});

const updateLoyaltyCardSchema = z
  .object({
    cardNumber: z.string().trim().min(1).optional(),
    status: z.nativeEnum(LoyaltyCardStatus).optional(),
    issuedAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) =>
      data.cardNumber !== undefined ||
      data.status !== undefined ||
      data.issuedAt !== undefined ||
      data.expiresAt !== undefined,
    {
      message: "At least one field must be provided for update",
    }
  );

export async function registerLoyaltyCardRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * --------------------------------------------------------------------------
   * CREATE LOYALTY CARD
   * --------------------------------------------------------------------------
   */

  api.post("/loyalty-cards", async (request, reply) => {
    const body = createLoyaltyCardSchema.parse(request.body ?? {});

    const loyaltyAccount = await api.prisma.loyaltyAccount.findUnique({
      where: {
        id: body.loyaltyAccountId,
      },
    });

    if (!loyaltyAccount) {
      return reply.code(404).send({
        error: "LOYALTY_ACCOUNT_NOT_FOUND",
        message: "Loyalty account was not found",
      });
    }

    try {
      const card = await api.prisma.loyaltyCard.create({
        data: {
          loyaltyAccountId: body.loyaltyAccountId,
          cardNumber: body.cardNumber,
          status: body.status ?? LoyaltyCardStatus.ACTIVE,
          issuedAt: body.issuedAt ?? null,
          expiresAt: body.expiresAt ?? null,
        },
        include: {
          loyaltyAccount: {
            include: {
              loyaltyProgram: {
                include: {
                  retailer: true,
                },
              },
            },
          },
        },
      });

      return reply.code(201).send(card);
    } catch (error) {
      /*
       * Prisma P2002 = unique constraint violation.
       *
       * loyalty_cards.cardNumber is intentionally unique in the database.
       * Return a meaningful API response instead of HTTP 500.
       */

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.code(409).send({
          error: "LOYALTY_CARD_ALREADY_EXISTS",
          message: "A loyalty card with this card number already exists",
          field: "cardNumber",
        });
      }

      throw error;
    }
  });

  /*
   * --------------------------------------------------------------------------
   * LIST ALL LOYALTY CARDS
   * --------------------------------------------------------------------------
   */

  api.get("/loyalty-cards", async () => {
    return api.prisma.loyaltyCard.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        loyaltyAccount: {
          include: {
            loyaltyProgram: {
              include: {
                retailer: true,
              },
            },
          },
        },
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * GET LOYALTY CARD
   * --------------------------------------------------------------------------
   */

  api.get<{ Params: { cardId: string } }>(
    "/loyalty-cards/:cardId",
    async (request, reply) => {
      const card = await api.prisma.loyaltyCard.findUnique({
        where: {
          id: request.params.cardId,
        },
        include: {
          loyaltyAccount: {
            include: {
              loyaltyProgram: {
                include: {
                  retailer: true,
                },
              },
            },
          },
        },
      });

      if (!card) {
        return reply.code(404).send({
          error: "LOYALTY_CARD_NOT_FOUND",
          message: "Loyalty card was not found",
        });
      }

      return card;
    }
  );

  /*
   * --------------------------------------------------------------------------
   * UPDATE LOYALTY CARD
   * --------------------------------------------------------------------------
   *
   * PATCH /loyalty-cards/:cardId
   *
   * Supported fields:
   * - cardNumber
   * - status
   * - issuedAt
   * - expiresAt
   *
   * Important:
   * We build the Prisma update object explicitly instead of passing
   * bodyResult.data directly. This avoids TypeScript
   * exactOptionalPropertyTypes conflicts where optional properties may
   * contain undefined.
   */

  api.patch<{
    Params: {
      cardId: string;
    };
  }>("/loyalty-cards/:cardId", async (request, reply) => {
    const cardId = request.params.cardId;

    if (!z.string().uuid().safeParse(cardId).success) {
      return reply.code(400).send({
        error: "INVALID_LOYALTY_CARD_ID",
        message: "The loyalty card ID must be a valid UUID",
      });
    }

    const body = updateLoyaltyCardSchema.parse(request.body ?? {});

    const existingCard = await api.prisma.loyaltyCard.findUnique({
      where: {
        id: cardId,
      },
    });

    if (!existingCard) {
      return reply.code(404).send({
        error: "LOYALTY_CARD_NOT_FOUND",
        message: "Loyalty card was not found",
      });
    }

    const updateData: Prisma.LoyaltyCardUpdateInput = {};

    if (body.cardNumber !== undefined) {
      updateData.cardNumber = body.cardNumber;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.issuedAt !== undefined) {
      updateData.issuedAt = body.issuedAt;
    }

    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt;
    }

    try {
      const updatedCard = await api.prisma.loyaltyCard.update({
        where: {
          id: cardId,
        },
        data: updateData,
        include: {
          loyaltyAccount: {
            include: {
              loyaltyProgram: {
                include: {
                  retailer: true,
                },
              },
            },
          },
        },
      });

      return reply.code(200).send(updatedCard);
    } catch (error) {
      /*
       * Prisma P2002 = unique constraint violation.
       *
       * This is particularly relevant when updating cardNumber because
       * loyalty_cards.cardNumber is unique.
       */

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.code(409).send({
          error: "LOYALTY_CARD_ALREADY_EXISTS",
          message: "A loyalty card with this card number already exists",
          field: "cardNumber",
        });
      }

      throw error;
    }
  });

  /*
   * --------------------------------------------------------------------------
   * LIST CARDS FOR LOYALTY ACCOUNT
   * --------------------------------------------------------------------------
   */

  api.get<{ Params: { loyaltyAccountId: string } }>(
    "/loyalty-accounts/:loyaltyAccountId/cards",
    async (request, reply) => {
      const loyaltyAccount = await api.prisma.loyaltyAccount.findUnique({
        where: {
          id: request.params.loyaltyAccountId,
        },
      });

      if (!loyaltyAccount) {
        return reply.code(404).send({
          error: "LOYALTY_ACCOUNT_NOT_FOUND",
          message: "Loyalty account was not found",
        });
      }

      return api.prisma.loyaltyCard.findMany({
        where: {
          loyaltyAccountId: request.params.loyaltyAccountId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }
  );
}
