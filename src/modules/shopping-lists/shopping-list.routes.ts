import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ShoppingListItemStatus,
  ShoppingListStatus,
} from "@prisma/client";

import { requireAuth } from "../auth/auth.middleware.js";

const createShoppingListSchema = z.object({
  name: z.string().trim().min(1).max(191),
});

const updateShoppingListSchema = z
  .object({
    name: z.string().trim().min(1).max(191).optional(),
    status: z.nativeEnum(ShoppingListStatus).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.status !== undefined,
    {
      message: "At least one shopping list field must be provided",
    }
  );

const createShoppingListItemSchema = z.object({
  description: z.string().trim().min(1).max(191),
  quantity: z.coerce.number().positive().int().optional(),
  targetPrice: z.coerce.number().nonnegative().optional(),
  productId: z.string().uuid().optional(),
  status: z.nativeEnum(ShoppingListItemStatus).optional(),
});

const updateShoppingListItemSchema = z
  .object({
    description: z.string().trim().min(1).max(191).optional(),
    quantity: z.coerce.number().positive().int().optional(),
    targetPrice: z.coerce.number().nonnegative().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
    status: z.nativeEnum(ShoppingListItemStatus).optional(),
  })
  .refine(
    (data) =>
      data.description !== undefined ||
      data.quantity !== undefined ||
      data.targetPrice !== undefined ||
      data.productId !== undefined ||
      data.status !== undefined,
    {
      message: "At least one shopping list item field must be provided",
    }
  );

function getAuthenticatedUserId(request: {
  currentUserId?: string;
}): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }

  return request.currentUserId;
}

function normalizeProductSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveShoppingListProduct(
  api: FastifyInstance,
  description: string,
): Promise<string | null> {
  const search = normalizeProductSearch(description);

  if (!search) {
    return null;
  }

  const products = await api.prisma.product.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      brand: true,
      unit: true,
    },
  });

  const exactMatches = products.filter(
    (product) =>
      normalizeProductSearch(product.name) === search,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0]!.id;
  }

  const containsMatches = products.filter((product) => {
    const normalizedName = normalizeProductSearch(product.name);

    return (
      normalizedName.includes(search) ||
      search.includes(normalizedName)
    );
  });

  if (containsMatches.length === 1) {
    return containsMatches[0]!.id;
  }

  return null;
}

async function getOwnedShoppingList(
  api: FastifyInstance,
  userId: string,
  shoppingListId: string
) {
  return api.prisma.shoppingList.findFirst({
    where: {
      id: shoppingListId,
      userId,
    },
  });
}

async function getOwnedShoppingListItem(
  api: FastifyInstance,
  userId: string,
  itemId: string
) {
  return api.prisma.shoppingListItem.findFirst({
    where: {
      id: itemId,
      shoppingList: {
        userId,
      },
    },
  });
}

async function getShoppingListResponse(
  api: FastifyInstance,
  userId: string,
  shoppingListId: string
) {
  return api.prisma.shoppingList.findFirst({
    where: {
      id: shoppingListId,
      userId,
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          product: true,
        },
      },
    },
  });
}

export async function registerShoppingListRoutes(
  api: FastifyInstance
): Promise<void> {
  api.register(
    async (shopping) => {
      shopping.addHook("preHandler", requireAuth);

      /*
       * ------------------------------------------------------------------------
       * LIST SHOPPING LISTS FOR AUTHENTICATED USER
       * ------------------------------------------------------------------------
       */

      shopping.get("/shopping-lists", async (request) => {
        const userId = getAuthenticatedUserId(request);

        return shopping.prisma.shoppingList.findMany({
          where: {
            userId,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
              include: {
                product: true,
              },
            },
          },
        });
      });

      /*
       * ------------------------------------------------------------------------
       * CREATE SHOPPING LIST
       * ------------------------------------------------------------------------
       */

      shopping.post("/shopping-lists", async (request, reply) => {
        const userId = getAuthenticatedUserId(request);

        const parsed = createShoppingListSchema.safeParse(
          request.body ?? {}
        );

        if (!parsed.success) {
          return reply.code(400).send({
            error: "INVALID_SHOPPING_LIST",
            message: "A valid shopping list name is required.",
          });
        }

        const shoppingList = await shopping.prisma.shoppingList.create({
          data: {
            userId,
            name: parsed.data.name,
          },
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
              include: {
                product: true,
              },
            },
          },
        });

        return reply.code(201).send(shoppingList);
      });

      /*
       * ------------------------------------------------------------------------
       * GET SHOPPING LIST
       * ------------------------------------------------------------------------
       */

      shopping.get<{ Params: { shoppingListId: string } }>(
        "/shopping-lists/:shoppingListId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const shoppingList = await getShoppingListResponse(
            shopping,
            userId,
            request.params.shoppingListId
          );

          if (!shoppingList) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_NOT_FOUND",
              message: "Shopping list was not found",
            });
          }

          return shoppingList;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * UPDATE SHOPPING LIST
       * ------------------------------------------------------------------------
       */

      shopping.patch<{ Params: { shoppingListId: string } }>(
        "/shopping-lists/:shoppingListId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const parsed = updateShoppingListSchema.safeParse(
            request.body ?? {}
          );

          if (!parsed.success) {
            return reply.code(400).send({
              error: "INVALID_SHOPPING_LIST",
              message:
                "At least one valid shopping list field must be provided.",
            });
          }

          const existing = await getOwnedShoppingList(
            shopping,
            userId,
            request.params.shoppingListId
          );

          if (!existing) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_NOT_FOUND",
              message: "Shopping list was not found",
            });
          }

          const completedAt =
            parsed.data.status === ShoppingListStatus.COMPLETED
              ? new Date()
              : parsed.data.status !== undefined
                ? null
                : undefined;

          await shopping.prisma.shoppingList.update({
            where: {
              id: existing.id,
            },
            data: {
              ...(parsed.data.name !== undefined
                ? { name: parsed.data.name }
                : {}),
              ...(parsed.data.status !== undefined
                ? { status: parsed.data.status }
                : {}),
              ...(completedAt !== undefined
                ? { completedAt }
                : {}),
            },
          });

          const updated = await getShoppingListResponse(
            shopping,
            userId,
            existing.id
          );

          return updated;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * DELETE SHOPPING LIST
       * ------------------------------------------------------------------------
       */

      shopping.delete<{ Params: { shoppingListId: string } }>(
        "/shopping-lists/:shoppingListId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const existing = await getOwnedShoppingList(
            shopping,
            userId,
            request.params.shoppingListId
          );

          if (!existing) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_NOT_FOUND",
              message: "Shopping list was not found",
            });
          }

          await shopping.prisma.shoppingList.delete({
            where: {
              id: existing.id,
            },
          });

          return reply.code(204).send();
        }
      );

      /*
       * ------------------------------------------------------------------------
       * ADD SHOPPING LIST ITEM
       * ------------------------------------------------------------------------
       */

      shopping.post<{ Params: { shoppingListId: string } }>(
        "/shopping-lists/:shoppingListId/items",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const parsed = createShoppingListItemSchema.safeParse(
            request.body ?? {}
          );

          if (!parsed.success) {
            return reply.code(400).send({
              error: "INVALID_SHOPPING_LIST_ITEM",
              message: "A valid shopping list item is required.",
            });
          }

          const shoppingList = await getOwnedShoppingList(
            shopping,
            userId,
            request.params.shoppingListId
          );

          if (!shoppingList) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_NOT_FOUND",
              message: "Shopping list was not found",
            });
          }

          let resolvedProductId = parsed.data.productId ?? null;

          if (parsed.data.productId) {
            const product = await shopping.prisma.product.findUnique({
              where: {
                id: parsed.data.productId,
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
          } else {
            resolvedProductId = await resolveShoppingListProduct(
              shopping,
              parsed.data.description,
            );
          }

          const item = await shopping.prisma.shoppingListItem.create({
            data: {
              shoppingListId: shoppingList.id,
              description: parsed.data.description,
              quantity: parsed.data.quantity ?? 1,
              targetPrice: parsed.data.targetPrice ?? null,
              productId: resolvedProductId,
              status:
                parsed.data.status ??
                ShoppingListItemStatus.ACTIVE,
            },
            include: {
              product: true,
              shoppingList: true,
            },
          });

          return reply.code(201).send(item);
        }
      );

      /*
       * ------------------------------------------------------------------------
       * UPDATE SHOPPING LIST ITEM
       * ------------------------------------------------------------------------
       */

      shopping.patch<{ Params: { itemId: string } }>(
        "/shopping-list-items/:itemId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const parsed = updateShoppingListItemSchema.safeParse(
            request.body ?? {}
          );

          if (!parsed.success) {
            return reply.code(400).send({
              error: "INVALID_SHOPPING_LIST_ITEM",
              message:
                "At least one valid shopping list item field must be provided.",
            });
          }

          const existing = await getOwnedShoppingListItem(
            shopping,
            userId,
            request.params.itemId
          );

          if (!existing) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_ITEM_NOT_FOUND",
              message: "Shopping list item was not found",
            });
          }

          if (parsed.data.productId) {
            const product = await shopping.prisma.product.findUnique({
              where: {
                id: parsed.data.productId,
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
          }

          const item = await shopping.prisma.shoppingListItem.update({
            where: {
              id: existing.id,
            },
            data: {
              ...(parsed.data.description !== undefined
                ? { description: parsed.data.description }
                : {}),
              ...(parsed.data.quantity !== undefined
                ? { quantity: parsed.data.quantity }
                : {}),
              ...(parsed.data.targetPrice !== undefined
                ? { targetPrice: parsed.data.targetPrice }
                : {}),
              ...(parsed.data.productId !== undefined
                ? { productId: parsed.data.productId }
                : {}),
              ...(parsed.data.status !== undefined
                ? { status: parsed.data.status }
                : {}),
            },
            include: {
              product: true,
              shoppingList: true,
            },
          });

          return item;
        }
      );

      /*
       * ------------------------------------------------------------------------
       * REMOVE SHOPPING LIST ITEM
       * ------------------------------------------------------------------------
       */

      shopping.delete<{ Params: { itemId: string } }>(
        "/shopping-list-items/:itemId",
        async (request, reply) => {
          const userId = getAuthenticatedUserId(request);

          const existing = await getOwnedShoppingListItem(
            shopping,
            userId,
            request.params.itemId
          );

          if (!existing) {
            return reply.code(404).send({
              error: "SHOPPING_LIST_ITEM_NOT_FOUND",
              message: "Shopping list item was not found",
            });
          }

          const item = await shopping.prisma.shoppingListItem.update({
            where: {
              id: existing.id,
            },
            data: {
              status: ShoppingListItemStatus.REMOVED,
            },
          });

          return item;
        }
      );
    },
    {
      prefix: "/me",
    }
  );
}
