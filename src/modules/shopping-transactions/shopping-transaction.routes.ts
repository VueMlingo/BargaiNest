import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TransactionStatus } from "@prisma/client";

const createTransactionItemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  totalPrice: z.coerce.number().nonnegative().optional(),
});

const createTransactionSchema = z.object({
  userId: z.string().uuid(),
  retailerId: z.string().uuid().optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  transactionReference: z.string().trim().optional(),
  subtotal: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  purchasedAt: z.coerce.date().optional(),
  items: z.array(createTransactionItemSchema).min(1),
});

export async function registerShoppingTransactionRoutes(
  api: FastifyInstance
): Promise<void> {

  /*
   * --------------------------------------------------------------------------
   * CREATE SHOPPING TRANSACTION
   * --------------------------------------------------------------------------
   */

  api.post("/shopping-transactions", async (request, reply) => {
    const body = createTransactionSchema.parse(request.body ?? {});

    /*
     * Verify user exists.
     */

    const user = await api.prisma.user.findUnique({
      where: {
        id: body.userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return reply.code(404).send({
        error: "USER_NOT_FOUND",
        message: "User was not found",
      });
    }

    /*
     * Verify retailer when supplied.
     */

    if (body.retailerId) {
      const retailer = await api.prisma.retailer.findUnique({
        where: {
          id: body.retailerId,
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
    }

    /*
     * Verify all supplied products exist.
     */

    const productIds = [
      ...new Set(
        body.items
          .map((item) => item.productId)
          .filter((id): id is string => id !== undefined)
      ),
    ];

    if (productIds.length > 0) {
      const products = await api.prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
        },
      });

      const existingProductIds = new Set(
        products.map((product) => product.id)
      );

      const missingProductId = productIds.find(
        (productId) => !existingProductIds.has(productId)
      );

      if (missingProductId) {
        return reply.code(404).send({
          error: "PRODUCT_NOT_FOUND",
          message: `Product was not found: ${missingProductId}`,
        });
      }
    }

    /*
     * Create transaction and transaction items atomically.
     */

    const transaction = await api.prisma.shoppingTransaction.create({
      data: {
        userId: body.userId,
        retailerId: body.retailerId ?? null,
        status: body.status ?? TransactionStatus.COMPLETED,
        transactionReference: body.transactionReference ?? null,
        subtotal: body.subtotal ?? null,
        discount: body.discount ?? null,
        total: body.total ?? null,
        currency: body.currency ?? "ZAR",
        purchasedAt: body.purchasedAt ?? new Date(),
        items: {
          create: body.items.map((item) => ({
            productId: item.productId ?? null,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? null,
            discount: item.discount ?? null,
            totalPrice: item.totalPrice ?? null,
          })),
        },
      },
      include: {
        user: {
          include: {
            identifiers: true,
          },
        },
        retailer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return reply.code(201).send(transaction);
  });

  /*
   * --------------------------------------------------------------------------
   * LIST SHOPPING TRANSACTIONS
   * --------------------------------------------------------------------------
   */

  api.get("/shopping-transactions", async () => {
    return api.prisma.shoppingTransaction.findMany({
      orderBy: {
        purchasedAt: "desc",
      },
      include: {
        retailer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * LIST SHOPPING TRANSACTIONS FOR USER
   * --------------------------------------------------------------------------
   */



  /*
   * --------------------------------------------------------------------------
   * GET SHOPPING TRANSACTION
   * --------------------------------------------------------------------------
   */

  api.get<{ Params: { transactionId: string } }>(
    "/shopping-transactions/:transactionId",
    async (request, reply) => {
      const transaction =
        await api.prisma.shoppingTransaction.findUnique({
          where: {
            id: request.params.transactionId,
          },
          include: {
            user: {
              include: {
                identifiers: true,
              },
            },
            retailer: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

      if (!transaction) {
        return reply.code(404).send({
          error: "SHOPPING_TRANSACTION_NOT_FOUND",
          message: "Shopping transaction was not found",
        });
      }

      return transaction;
    }
  );

  /*
   * --------------------------------------------------------------------------
   * LIST TRANSACTIONS FOR RETAILER
   * --------------------------------------------------------------------------
   */

  api.get<{ Params: { retailerId: string } }>(
    "/retailers/:retailerId/shopping-transactions",
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

      return api.prisma.shoppingTransaction.findMany({
        where: {
          retailerId: request.params.retailerId,
        },
        orderBy: {
          purchasedAt: "desc",
        },
        include: {
          user: {
            include: {
              identifiers: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }
  );
}
