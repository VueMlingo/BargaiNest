import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";

const createPriceObservationSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  price: z.coerce.number().nonnegative(),
  currency: z.string().trim().min(3).max(3).optional(),
  observedAt: z.coerce.date().optional(),
  source: z.string().trim().optional(),
});

export async function registerPriceObservationRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * ==========================================================================
   * BN-011: this module had no authentication at all -- same gap already
   * identified and fixed in reward.routes.ts / loyalty-activity.routes.ts,
   * extended here (and to retailer, loyalty-program, and product routes,
   * its three siblings with the identical gap).
   * ==========================================================================
   */
  await api.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);
  /*
   * --------------------------------------------------------------------------
   * CREATE PRICE OBSERVATION
   * --------------------------------------------------------------------------
   */

  scoped.post("/price-observations", async (request, reply) => {
    const body = createPriceObservationSchema.parse(request.body ?? {});

    /*
     * Verify product exists.
     */
    const product = await api.prisma.product.findUnique({
      where: {
        id: body.productId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      return reply.code(404).send({
        error: "PRODUCT_NOT_FOUND",
        message: "Product was not found",
      });
    }

    /*
     * Verify retailer exists.
     */
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

    /*
     * Verify that the product is actually associated
     * with this retailer.
     */
    const productRetailer = await api.prisma.productRetailer.findUnique({
      where: {
        productId_retailerId: {
          productId: body.productId,
          retailerId: body.retailerId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!productRetailer) {
      return reply.code(409).send({
        error: "PRODUCT_RETAILER_NOT_FOUND",
        message:
          "The product is not associated with the specified retailer",
      });
    }

    const observation = await api.prisma.priceObservation.create({
      data: {
        productId: body.productId,
        retailerId: body.retailerId,
        price: body.price,
        currency: body.currency ?? "ZAR",
        observedAt: body.observedAt ?? new Date(),
        source: body.source ?? null,
      },
      include: {
        product: true,
        retailer: true,
      },
    });

    return reply.code(201).send(observation);
  });

  /*
   * --------------------------------------------------------------------------
   * LIST PRICE OBSERVATIONS
   * --------------------------------------------------------------------------
   */

  scoped.get("/price-observations", async () => {
    return api.prisma.priceObservation.findMany({
      orderBy: {
        observedAt: "desc",
      },
      include: {
        product: true,
        retailer: true,
      },
    });
  });

  /*
   * --------------------------------------------------------------------------
   * GET PRICE OBSERVATION
   * --------------------------------------------------------------------------
   */

  scoped.get<{ Params: { priceObservationId: string } }>(
    "/price-observations/:priceObservationId",
    async (request, reply) => {
      const observation =
        await api.prisma.priceObservation.findUnique({
          where: {
            id: request.params.priceObservationId,
          },
          include: {
            product: true,
            retailer: true,
          },
        });

      if (!observation) {
        return reply.code(404).send({
          error: "PRICE_OBSERVATION_NOT_FOUND",
          message: "Price observation was not found",
        });
      }

      return observation;
    }
  );

  /*
   * --------------------------------------------------------------------------
   * LIST PRICE HISTORY FOR PRODUCT
   * --------------------------------------------------------------------------
   */

  scoped.get<{ Params: { productId: string } }>(
    "/products/:productId/price-observations",
    async (request, reply) => {
      const product = await api.prisma.product.findUnique({
        where: {
          id: request.params.productId,
        },
        select: {
          id: true,
        },
      });

      if (!product) {
        return reply.code(404).send({
          error: "PRODUCT_NOT_FOUND",
          message: "Product was not found",
        });
      }

      return api.prisma.priceObservation.findMany({
        where: {
          productId: request.params.productId,
        },
        orderBy: {
          observedAt: "desc",
        },
        include: {
          retailer: true,
        },
      });
    }
  );

  /*
   * --------------------------------------------------------------------------
   * LIST PRICE HISTORY FOR RETAILER
   * --------------------------------------------------------------------------
   */

  scoped.get<{ Params: { retailerId: string } }>(
    "/retailers/:retailerId/price-observations",
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

      return api.prisma.priceObservation.findMany({
        where: {
          retailerId: request.params.retailerId,
        },
        orderBy: {
          observedAt: "desc",
        },
        include: {
          product: true,
        },
      });
    }
  );
  });
}
