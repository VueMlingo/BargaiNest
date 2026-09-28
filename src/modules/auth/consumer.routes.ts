import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LoyaltyAccountStatus, LoyaltyCardStatus, Prisma } from "@prisma/client";

import { requireAuth } from "./auth.middleware.js";
import { RetailerConnectionService } from "../../integrations/loyalty/connection/retailer-connection.service.js";
import { LoyaltySnapshotSyncService } from "../../integrations/loyalty/sync/loyalty-snapshot-sync.service.js";
import { LoyaltyConsumerReadService } from "../../integrations/loyalty/read/loyalty-consumer-read.service.js";
import { markRedeemed } from "../../integrations/loyalty/redemption/redemption.service.js";
import { recordAuditLog } from "../audit/audit.service.js";

const createLoyaltyAccountSchema = z.object({
  loyaltyProgramId: z.string().uuid(),
  accountNumber: z.string().trim().min(1).max(191).optional()
});

const createLoyaltyCardSchema = z.object({
  cardNumber: z.string().trim().min(1).max(191),
  status: z.nativeEnum(LoyaltyCardStatus).optional(),
  issuedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional()
});

const updateLoyaltyCardSchema = z
  .object({
    cardNumber: z.string().trim().min(1).max(191).optional(),
    status: z.nativeEnum(LoyaltyCardStatus).optional(),
    issuedAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    favourite: z.boolean().optional()
  })
  .refine(
    (data) =>
      data.cardNumber !== undefined ||
      data.status !== undefined ||
      data.issuedAt !== undefined ||
      data.expiresAt !== undefined ||
      data.favourite !== undefined,
    {
      message: "At least one field must be provided for update"
    }
  );

const createRetailerConnectionSchema = z.object({
  integrationId: z.string().uuid(),
  externalAccountId: z.string().trim().min(1).max(191)
});

function getAuthenticatedUserId(request: {
  currentUserId?: string;
}): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }

  return request.currentUserId;
}

/*
 * Shared include shape for a loyalty account, seen from the consumer's own
 * wallet: programme/retailer info, cards, the points activity ledger, and
 * any rewards attached to the account.
 */
const loyaltyAccountInclude = {
  loyaltyProgram: {
    include: {
      retailer: true
    }
  },
  cards: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  activities: {
    orderBy: {
      occurredAt: "desc" as const
    }
  },
  rewards: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
};

async function getOwnedLoyaltyAccount(
  api: FastifyInstance,
  userId: string,
  loyaltyAccountId: string
) {
  return api.prisma.loyaltyAccount.findFirst({
    where: {
      id: loyaltyAccountId,
      userId
    },
    include: loyaltyAccountInclude
  });
}

async function getOwnedLoyaltyCard(
  api: FastifyInstance,
  userId: string,
  cardId: string
) {
  return api.prisma.loyaltyCard.findFirst({
    where: {
      id: cardId,
      loyaltyAccount: {
        userId
      }
    },
    include: {
      loyaltyAccount: {
        include: {
          loyaltyProgram: {
            include: {
              retailer: true
            }
          }
        }
      }
    }
  });
}

export async function registerConsumerRoutes(
  api: FastifyInstance
): Promise<void> {
  api.register(
    async (consumer) => {
      consumer.addHook("preHandler", requireAuth);

      const loyaltyReadService = new LoyaltyConsumerReadService(
        consumer.prisma
      );

      /*
       * ------------------------------------------------------------------------
       * GET CURRENT USER'S LOYALTY ACCOUNTS
       * ------------------------------------------------------------------------
       */

      consumer.get("/loyalty-accounts", async (request) => {
        const userId = getAuthenticatedUserId(request);

        return loyaltyReadService.getAccountsForUser(userId);
      });

      /*
       * ------------------------------------------------------------------------
       * CREATE CURRENT USER'S LOYALTY ACCOUNT
       * ------------------------------------------------------------------------
       *
       * The user supplies a loyalty programme from the BargaiNest catalogue.
       * The userId is NEVER supplied by the client.
       */

      consumer.post("/loyalty-accounts", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const body = createLoyaltyAccountSchema.parse(request.body ?? {});

        const programme = await consumer.prisma.loyaltyProgram.findUnique({
          where: {
            id: body.loyaltyProgramId
          },
          include: {
            retailer: true
          }
        });

        if (!programme) {
          return reply.code(404).send({
            error: "LOYALTY_PROGRAM_NOT_FOUND",
            message: "The selected loyalty programme was not found."
          });
        }

        if (programme.status !== "ACTIVE") {
          return reply.code(409).send({
            error: "LOYALTY_PROGRAM_NOT_ACTIVE",
            message: "The selected loyalty programme is not currently active."
          });
        }

        try {
          const account = await consumer.prisma.loyaltyAccount.create({
            data: {
              userId,
              loyaltyProgramId: body.loyaltyProgramId,
              ...(body.accountNumber !== undefined
                ? { accountNumber: body.accountNumber }
                : {}),
              status: LoyaltyAccountStatus.ACTIVE
            },
            include: loyaltyAccountInclude
          });

          await recordAuditLog(
            consumer.prisma,
            {
              userId,
              action: "LOYALTY_ACCOUNT_CREATED",
              entityType: "LoyaltyAccount",
              entityId: account.id,
              metadata: { loyaltyProgramId: body.loyaltyProgramId },
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"] ?? null,
            },
            request.log,
          );

          return reply.code(201).send(account);
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            return reply.code(409).send({
              error: "LOYALTY_ACCOUNT_ALREADY_EXISTS",
              message:
                "You already have a loyalty account for this programme."
            });
          }

          throw error;
        }
      });

      /*
       * ------------------------------------------------------------------------
       * GET CURRENT USER'S LOYALTY ACCOUNT
       * ------------------------------------------------------------------------
       */

      consumer.get<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const account = await loyaltyReadService.getAccountForUser(
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          return account;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * GET CURRENT USER'S CARDS FOR A LOYALTY ACCOUNT
       * ------------------------------------------------------------------------
       */

      consumer.get<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/cards",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          return account.cards;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * ADD CARD TO CURRENT USER'S LOYALTY ACCOUNT
       * ------------------------------------------------------------------------
       *
       * IMPORTANT:
       * loyaltyAccountId comes from the URL, but ownership is verified against
       * the authenticated user before the card can be created.
       */

      consumer.post<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/cards",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const body = createLoyaltyCardSchema.parse(request.body ?? {});

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          try {
            const card = await consumer.prisma.loyaltyCard.create({
              data: {
                loyaltyAccountId: account.id,
                cardNumber: body.cardNumber,
                status: body.status ?? LoyaltyCardStatus.ACTIVE,
                ...(body.issuedAt !== undefined
                  ? { issuedAt: body.issuedAt }
                  : {}),
                ...(body.expiresAt !== undefined
                  ? { expiresAt: body.expiresAt }
                  : {})
              },
              include: {
                loyaltyAccount: {
                  include: {
                    loyaltyProgram: {
                      include: {
                        retailer: true
                      }
                    }
                  }
                }
              }
            });

            await recordAuditLog(
              consumer.prisma,
              {
                userId,
                action: "LOYALTY_CARD_ADDED",
                entityType: "LoyaltyCard",
                entityId: card.id,
                metadata: { loyaltyAccountId: account.id },
                ipAddress: request.ip,
                userAgent: request.headers["user-agent"] ?? null,
              },
              request.log,
            );

            return reply.code(201).send(card);
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2002"
            ) {
              return reply.code(409).send({
                error: "LOYALTY_CARD_ALREADY_EXISTS",
                message: "A loyalty card with this card number already exists.",
                field: "cardNumber"
              });
            }

            throw error;
          }
        }
      );

      /*
       * ------------------------------------------------------------------------
       * UPDATE CURRENT USER'S LOYALTY CARD
       * ------------------------------------------------------------------------
       */

      consumer.patch<{
        Params: {
          cardId: string;
        };
      }>("/loyalty-cards/:cardId", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const cardId = request.params.cardId;

        if (!z.string().uuid().safeParse(cardId).success) {
          return reply.code(400).send({
            error: "INVALID_LOYALTY_CARD_ID",
            message: "The loyalty card ID must be a valid UUID."
          });
        }

        const body = updateLoyaltyCardSchema.parse(request.body ?? {});

        const existingCard = await getOwnedLoyaltyCard(
          consumer,
          userId,
          cardId
        );

        if (!existingCard) {
          return reply.code(404).send({
            error: "LOYALTY_CARD_NOT_FOUND",
            message: "Loyalty card was not found."
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

        if (body.favourite !== undefined) {
          updateData.favourite = body.favourite;
        }

        try {
          const updatedCard = await consumer.prisma.loyaltyCard.update({
            where: {
              id: existingCard.id
            },
            data: updateData,
            include: {
              loyaltyAccount: {
                include: {
                  loyaltyProgram: {
                    include: {
                      retailer: true
                    }
                  }
                }
              }
            }
          });

          return updatedCard;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            return reply.code(409).send({
              error: "LOYALTY_CARD_ALREADY_EXISTS",
              message: "A loyalty card with this card number already exists.",
              field: "cardNumber"
            });
          }

          throw error;
        }
      });

      /*
       * ------------------------------------------------------------------------
       * DELETE CURRENT USER'S LOYALTY CARD
       * ------------------------------------------------------------------------
       */

      consumer.delete<{
        Params: {
          cardId: string;
        };
      }>("/loyalty-cards/:cardId", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const cardId = request.params.cardId;

        if (!z.string().uuid().safeParse(cardId).success) {
          return reply.code(400).send({
            error: "INVALID_LOYALTY_CARD_ID",
            message: "The loyalty card ID must be a valid UUID."
          });
        }

        const existingCard = await getOwnedLoyaltyCard(consumer, userId, cardId);

        if (!existingCard) {
          return reply.code(404).send({
            error: "LOYALTY_CARD_NOT_FOUND",
            message: "Loyalty card was not found."
          });
        }

        await consumer.prisma.loyaltyCard.delete({
          where: {
            id: existingCard.id
          }
        });

        return reply.send({
          message: "Loyalty card removed."
        });
      });

      /*
       * ------------------------------------------------------------------------
       * CONNECT CURRENT USER'S LOYALTY ACCOUNT TO A RETAILER INTEGRATION
       * ------------------------------------------------------------------------
       *
       * The browser supplies the integration and retailer-side account
       * identifier. The authenticated user is always derived from the session.
       *
       * BargaiNest does NOT create or own the retailer's loyalty balance.
       */

      consumer.post<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/connection",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const body = createRetailerConnectionSchema.parse(
            request.body ?? {}
          );

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          try {
            const service = new RetailerConnectionService(
              consumer.prisma
            );

            const connection = await service.connect({
              userId,
              loyaltyAccountId: account.id,
              integrationId: body.integrationId,
              externalAccountId: body.externalAccountId
            });

            return reply.code(201).send(connection);
          } catch (error) {
            if (error instanceof Error) {
              switch (error.message) {
                case "LOYALTY_ACCOUNT_NOT_FOUND":
                  return reply.code(404).send({
                    error: "LOYALTY_ACCOUNT_NOT_FOUND",
                    message: "Loyalty account was not found."
                  });

                case "LOYALTY_INTEGRATION_NOT_FOUND":
                  return reply.code(404).send({
                    error: "LOYALTY_INTEGRATION_NOT_FOUND",
                    message:
                      "The requested retailer integration was not found."
                  });

                case "LOYALTY_INTEGRATION_RETAILER_MISMATCH":
                  return reply.code(409).send({
                    error: "LOYALTY_INTEGRATION_RETAILER_MISMATCH",
                    message:
                      "The retailer integration does not belong to this loyalty programme."
                  });

                case "RETAILER_CONNECTION_ALREADY_EXISTS":
                  return reply.code(409).send({
                    error: "RETAILER_CONNECTION_ALREADY_EXISTS",
                    message:
                      "This loyalty account is already connected to this retailer integration."
                  });

                case "RETAILER_CONNECTION_NOT_ACTIVE":
                  return reply.code(409).send({
                    error: "RETAILER_CONNECTION_NOT_ACTIVE",
                    message:
                      "The retailer connection is not currently active."
                  });

                case "LOYALTY_INTEGRATION_NOT_ACTIVE":
                  return reply.code(409).send({
                    error: "LOYALTY_INTEGRATION_NOT_ACTIVE",
                    message:
                      "The retailer integration is not currently active."
                  });

                case "RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED":
                  return reply.code(400).send({
                    error: "RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED",
                    message:
                      "A retailer loyalty account identifier is required."
                  });
              }
            }

            throw error;
          }
        }
      );

      /*
       * ------------------------------------------------------------------------
       * GET CURRENT USER'S RETAILER CONNECTION
       * ------------------------------------------------------------------------
       */

      consumer.get<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/connection",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          const connection =
            await consumer.prisma.retailerConnection.findFirst({
              where: {
                loyaltyAccountId: account.id
              },
              include: {
                integration: {
                  include: {
                    retailer: true
                  }
                }
              }
            });

          if (!connection) {
            return reply.code(404).send({
              error: "RETAILER_CONNECTION_NOT_FOUND",
              message:
                "This loyalty account is not connected to a retailer."
            });
          }

          return connection;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * SYNC CURRENT USER'S RETAILER CONNECTION
       * ------------------------------------------------------------------------
       *
       * This asks the configured retailer provider for current retailer-side
       * state and stores a new BargaiNest snapshot.
       *
       * IMPORTANT:
       * The sync operation does NOT modify loyaltyAccount.pointsBalance.
       */

      consumer.post<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/sync",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          const connection =
            await consumer.prisma.retailerConnection.findFirst({
              where: {
                loyaltyAccountId: account.id
              }
            });

          if (!connection) {
            return reply.code(404).send({
              error: "RETAILER_CONNECTION_NOT_FOUND",
              message:
                "This loyalty account is not connected to a retailer."
            });
          }

          try {
            const service = new LoyaltySnapshotSyncService(
              consumer.prisma
            );

            const result = await service.syncConnection(connection.id);

            return reply.send(result);
          } catch (error) {
            if (error instanceof Error) {
              switch (error.message) {
                case "RETAILER_CONNECTION_NOT_FOUND":
                  return reply.code(404).send({
                    error: "RETAILER_CONNECTION_NOT_FOUND",
                    message:
                      "This loyalty account is not connected to a retailer."
                  });

                case "RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED":
                  return reply.code(409).send({
                    error: "RETAILER_EXTERNAL_ACCOUNT_ID_REQUIRED",
                    message:
                      "The retailer connection does not have an external account identifier."
                  });
              }

              if (
                error.message.startsWith(
                  "RETAILER_CONNECTION_NOT_ACTIVE:"
                )
              ) {
                return reply.code(409).send({
                  error: "RETAILER_CONNECTION_NOT_ACTIVE",
                  message:
                    "The retailer connection is not currently active."
                });
              }
            }

            throw error;
          }
        }
      );

      /*
       * ------------------------------------------------------------------------
       * MARK REWARD/VOUCHER REDEEMED
       * ------------------------------------------------------------------------
       *
       * Idempotent (upsert) -- marking the same item redeemed twice is a
       * no-op, not an error. See redemption.service.ts for why this needs
       * its own table rather than mutating the synced snapshot directly.
       */

      consumer.post<{
        Params: { loyaltyAccountId: string };
        Body: { externalId: string; kind: string };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/redemptions",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const body = request.body ?? ({} as { externalId?: string; kind?: string });

          if (
            !body.externalId ||
            (body.kind !== "REWARD" && body.kind !== "VOUCHER")
          ) {
            return reply.code(400).send({
              error: "INVALID_REQUEST",
              message: "externalId and kind ('REWARD' or 'VOUCHER') are required.",
            });
          }

          try {
            const redemption = await markRedeemed(
              consumer.prisma,
              userId,
              request.params.loyaltyAccountId,
              body.externalId,
              body.kind,
            );
            return reply.code(201).send(redemption);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "LOYALTY_ACCOUNT_NOT_FOUND_OR_NOT_OWNER"
            ) {
              return reply.code(404).send({
                error: "LOYALTY_ACCOUNT_NOT_FOUND",
                message: "Loyalty account was not found.",
              });
            }
            throw error;
          }
        },
      );

      /*
       * ------------------------------------------------------------------------
       * CONNECT + SYNC IN ONE CALL (convenience)
       * ------------------------------------------------------------------------
       *
       * Wraps the existing connect + sync endpoints into a single call for
       * the "just added a card, try to load live points automatically"
       * flow. Best-effort: if the retailer has no ACTIVE integration, or
       * the connection already exists, this responds with a clear
       * `connected: false` result rather than an error — most retailers
       * won't have live integrations yet, and that's an expected, normal
       * outcome here, not a failure. Genuine errors (bad integration id,
       * ownership mismatch) still surface as errors.
       */

      consumer.post<{
        Params: {
          loyaltyAccountId: string;
        };
        Body: {
          integrationId: string;
          externalAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/connect-and-sync",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);
          const body = createRetailerConnectionSchema.parse(
            request.body ?? {}
          );

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          try {
            const connectionService = new RetailerConnectionService(
              consumer.prisma
            );

            const connection = await connectionService.connect({
              userId,
              loyaltyAccountId: account.id,
              integrationId: body.integrationId,
              externalAccountId: body.externalAccountId
            });

            const syncService = new LoyaltySnapshotSyncService(
              consumer.prisma
            );

            const result = await syncService.syncConnection(connection.id);

            return reply.code(201).send({
              connected: true,
              connection,
              sync: result
            });
          } catch (error) {
            if (error instanceof Error) {
              // A connection already existing isn't a failure worth
              // surfacing to the "just added a card" flow — the account
              // is already connected, which is the desired end state.
              // Attempt a sync against the existing connection instead
              // of giving up.
              if (error.message === "RETAILER_CONNECTION_ALREADY_EXISTS") {
                const existing =
                  await consumer.prisma.retailerConnection.findUnique({
                    where: {
                      loyaltyAccountId_integrationId: {
                        loyaltyAccountId: account.id,
                        integrationId: body.integrationId
                      }
                    }
                  });

                if (existing) {
                  try {
                    const syncService = new LoyaltySnapshotSyncService(
                      consumer.prisma
                    );
                    const result = await syncService.syncConnection(
                      existing.id
                    );
                    return reply.send({
                      connected: true,
                      alreadyConnected: true,
                      sync: result
                    });
                  } catch {
                    // Fall through to the generic "not connected" response
                    // below — the connection exists but couldn't sync
                    // right now, which is still not a hard error for this
                    // best-effort convenience endpoint.
                  }
                }

                return reply.send({
                  connected: true,
                  alreadyConnected: true,
                  sync: null
                });
              }

              if (
                error.message === "LOYALTY_INTEGRATION_NOT_FOUND" ||
                error.message.startsWith("LOYALTY_INTEGRATION_NOT_ACTIVE:") ||
                error.message === "LOYALTY_INTEGRATION_RETAILER_MISMATCH"
              ) {
                return reply.send({
                  connected: false,
                  reason: error.message
                });
              }
            }

            throw error;
          }
        }
      );

      /*
       * ------------------------------------------------------------------------
       * GET LATEST RETAILER SNAPSHOT
       * ------------------------------------------------------------------------
       *
       * This is BargaiNest's latest observed view of the retailer's state.
       * It is explicitly a snapshot, not the retailer's system of record.
       */

      consumer.get<{
        Params: {
          loyaltyAccountId: string;
        };
      }>(
        "/loyalty-accounts/:loyaltyAccountId/snapshot",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const account = await getOwnedLoyaltyAccount(
            consumer,
            userId,
            request.params.loyaltyAccountId
          );

          if (!account) {
            return reply.code(404).send({
              error: "LOYALTY_ACCOUNT_NOT_FOUND",
              message: "Loyalty account was not found."
            });
          }

          const snapshot =
            await consumer.prisma.loyaltySnapshot.findFirst({
              where: {
                loyaltyAccountId: account.id
              },
              orderBy: {
                observedAt: "desc"
              }
            });

          if (!snapshot) {
            return reply.code(404).send({
              error: "LOYALTY_SNAPSHOT_NOT_FOUND",
              message:
                "No retailer snapshot has been recorded for this loyalty account."
            });
          }

          return snapshot;
        }
      );
    },
    {
      prefix: "/me"
    }
  );
}
