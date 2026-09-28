import type { FastifyInstance } from "fastify";

import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";

import {
  ProductStatus,
  ProductIdentifierType,
} from "@prisma/client";

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  category: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  category: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

const createProductIdentifierSchema = z.object({
  type: z.nativeEnum(ProductIdentifierType),
  value: z.string().trim().min(1),
});

const createProductRetailerSchema = z.object({
  retailerSku: z.string().trim().optional(),
  currentPrice: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
});

const updateProductRetailerSchema = z.object({
  retailerSku: z.string().trim().optional(),
  currentPrice: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
});

export async function registerProductRoutes(
  api: FastifyInstance
): Promise<void> {
  /*
   * ==========================================================================
   * BN-011: this module had no authentication at all -- same gap already
   * identified and fixed in reward.routes.ts / loyalty-activity.routes.ts,
   * extended here (and to retailer, loyalty-program, and price-observation
   * routes, its three siblings with the identical gap).
   * ==========================================================================
   */
  await api.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

  /*
   * ==========================================================================
   * CREATE PRODUCT
   * ==========================================================================
   */

  scoped.post("/products", async (request, reply) => {
    const body = createProductSchema.parse(request.body ?? {});

    const product = await api.prisma.product.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        brand: body.brand ?? null,
        category: body.category ?? null,
        unit: body.unit ?? null,
        status: body.status ?? ProductStatus.ACTIVE,
      },
      include: {
        identifiers: true,
        retailers: {
          include: {
            retailer: true,
          },
        },
      },
    });

    return reply.code(201).send(product);
  });

  /*
   * ==========================================================================
   * LIST PRODUCTS
   * ==========================================================================
   */

  scoped.get("/products", async () => {
    return api.prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        identifiers: true,
        retailers: {
          include: {
            retailer: true,
          },
        },
      },
    });
  });

  /*
   * ==========================================================================
   * GET PRODUCT
   * ==========================================================================
   */

  scoped.get<{ Params: { productId: string } }>(
    "/products/:productId",
    async (request, reply) => {
      const product = await api.prisma.product.findUnique({
        where: {
          id: request.params.productId,
        },
        include: {
          identifiers: true,
          retailers: {
            include: {
              retailer: true,
            },
          },
          priceObservations: {
            orderBy: {
              observedAt: "desc",
            },
            include: {
              retailer: true,
            },
          },
        },
      });

      if (!product) {
        return reply.code(404).send({
          error: "PRODUCT_NOT_FOUND",
          message: "Product was not found",
        });
      }

      return product;
    }
  );

  /*
   * ==========================================================================
   * UPDATE PRODUCT
   * ==========================================================================
   */

  scoped.patch<{ Params: { productId: string } }>(
    "/products/:productId",
    async (request, reply) => {
      const body = updateProductSchema.parse(request.body ?? {});

      const existing = await api.prisma.product.findUnique({
        where: {
          id: request.params.productId,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "PRODUCT_NOT_FOUND",
          message: "Product was not found",
        });
      }

      const product = await api.prisma.product.update({
        where: {
          id: request.params.productId,
        },
        data: {
          ...(body.name !== undefined
            ? { name: body.name }
            : {}),

          ...(body.description !== undefined
            ? { description: body.description }
            : {}),

          ...(body.brand !== undefined
            ? { brand: body.brand }
            : {}),

          ...(body.category !== undefined
            ? { category: body.category }
            : {}),

          ...(body.unit !== undefined
            ? { unit: body.unit }
            : {}),

          ...(body.status !== undefined
            ? { status: body.status }
            : {}),
        },
        include: {
          identifiers: true,
          retailers: {
            include: {
              retailer: true,
            },
          },
        },
      });

      return product;
    }
  );

  /*
   * ==========================================================================
   * ADD PRODUCT IDENTIFIER
   * ==========================================================================
   */

  scoped.post<{ Params: { productId: string } }>(
    "/products/:productId/identifiers",
    async (request, reply) => {
      const body = createProductIdentifierSchema.parse(
        request.body ?? {}
      );

      const product = await api.prisma.product.findUnique({
        where: {
          id: request.params.productId,
        },
      });

      if (!product) {
        return reply.code(404).send({
          error: "PRODUCT_NOT_FOUND",
          message: "Product was not found",
        });
      }

      const identifier = await api.prisma.productIdentifier.create({
        data: {
          productId: request.params.productId,
          type: body.type,
          value: body.value,
        },
      });

      return reply.code(201).send(identifier);
    }
  );

  /*
   * ==========================================================================
   * LIST PRODUCT IDENTIFIERS
   * ==========================================================================
   */

  scoped.get<{ Params: { productId: string } }>(
    "/products/:productId/identifiers",
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

      return api.prisma.productIdentifier.findMany({
        where: {
          productId: request.params.productId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }
  );

  /*
   * ==========================================================================
   * ADD PRODUCT ↔ RETAILER ASSOCIATION
   * ==========================================================================
   *
   * This creates the ProductRetailer record required before a price
   * observation can be recorded for a product at a retailer.
   *
   * POST:
   * /products/:productId/retailers/:retailerId
   */

  scoped.post<{
    Params: {
      productId: string;
      retailerId: string;
    };
  }>(
    "/products/:productId/retailers/:retailerId",
    async (request, reply) => {
      const body = createProductRetailerSchema.parse(
        request.body ?? {}
      );

      /*
       * Verify product exists.
       */

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

      /*
       * Verify retailer exists.
       */

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

      /*
       * Prevent duplicate ProductRetailer records.
       */

      const existing = await api.prisma.productRetailer.findUnique({
        where: {
          productId_retailerId: {
            productId: request.params.productId,
            retailerId: request.params.retailerId,
          },
        },
      });

      if (existing) {
        return reply.code(409).send({
          error: "PRODUCT_RETAILER_ALREADY_EXISTS",
          message:
            "The product is already associated with this retailer",
        });
      }

      /*
       * Create ProductRetailer association.
       */

      const productRetailer =
        await api.prisma.productRetailer.create({
          data: {
            productId: request.params.productId,
            retailerId: request.params.retailerId,
            retailerSku: body.retailerSku ?? null,
            currentPrice: body.currentPrice ?? null,
            currency: body.currency ?? "ZAR",
          },
          include: {
            product: true,
            retailer: true,
          },
        });

      return reply.code(201).send(productRetailer);
    }
  );

  /*
   * ==========================================================================
   * LIST RETAILERS FOR PRODUCT
   * ==========================================================================
   */

  scoped.get<{ Params: { productId: string } }>(
    "/products/:productId/retailers",
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

      return api.prisma.productRetailer.findMany({
        where: {
          productId: request.params.productId,
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          retailer: true,
        },
      });
    }
  );

  /*
   * ==========================================================================
   * GET PRODUCT ↔ RETAILER ASSOCIATION
   * ==========================================================================
   */

  scoped.get<{
    Params: {
      productId: string;
      retailerId: string;
    };
  }>(
    "/products/:productId/retailers/:retailerId",
    async (request, reply) => {
      const productRetailer =
        await api.prisma.productRetailer.findUnique({
          where: {
            productId_retailerId: {
              productId: request.params.productId,
              retailerId: request.params.retailerId,
            },
          },
          include: {
            product: true,
            retailer: true,
          },
        });

      if (!productRetailer) {
        return reply.code(404).send({
          error: "PRODUCT_RETAILER_NOT_FOUND",
          message:
            "The product is not associated with this retailer",
        });
      }

      return productRetailer;
    }
  );

  /*
   * ==========================================================================
   * UPDATE PRODUCT ↔ RETAILER ASSOCIATION
   * ==========================================================================
   */

  scoped.patch<{
    Params: {
      productId: string;
      retailerId: string;
    };
  }>(
    "/products/:productId/retailers/:retailerId",
    async (request, reply) => {
      const body = updateProductRetailerSchema.parse(
        request.body ?? {}
      );

      const existing =
        await api.prisma.productRetailer.findUnique({
          where: {
            productId_retailerId: {
              productId: request.params.productId,
              retailerId: request.params.retailerId,
            },
          },
        });

      if (!existing) {
        return reply.code(404).send({
          error: "PRODUCT_RETAILER_NOT_FOUND",
          message:
            "The product is not associated with this retailer",
        });
      }

      const productRetailer =
        await api.prisma.productRetailer.update({
          where: {
            productId_retailerId: {
              productId: request.params.productId,
              retailerId: request.params.retailerId,
            },
          },
          data: {
            ...(body.retailerSku !== undefined
              ? { retailerSku: body.retailerSku }
              : {}),

            ...(body.currentPrice !== undefined
              ? { currentPrice: body.currentPrice }
              : {}),

            ...(body.currency !== undefined
              ? { currency: body.currency }
              : {}),
          },
          include: {
            product: true,
            retailer: true,
          },
        });

      return productRetailer;
    }
  );

  /*
   * ==========================================================================
   * REMOVE PRODUCT ↔ RETAILER ASSOCIATION
   * ==========================================================================
   */

  scoped.delete<{
    Params: {
      productId: string;
      retailerId: string;
    };
  }>(
    "/products/:productId/retailers/:retailerId",
    async (request, reply) => {
      const existing =
        await api.prisma.productRetailer.findUnique({
          where: {
            productId_retailerId: {
              productId: request.params.productId,
              retailerId: request.params.retailerId,
            },
          },
        });

      if (!existing) {
        return reply.code(404).send({
          error: "PRODUCT_RETAILER_NOT_FOUND",
          message:
            "The product is not associated with this retailer",
        });
      }

      await api.prisma.productRetailer.delete({
        where: {
          productId_retailerId: {
            productId: request.params.productId,
            retailerId: request.params.retailerId,
          },
        },
      });

      return reply.code(204).send();
    }
  );
  });
}
