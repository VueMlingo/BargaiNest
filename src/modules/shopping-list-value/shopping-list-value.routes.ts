import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/auth.middleware.js";

import type { CataloguePriceLookupRegistry } from "../retail-catalogue/retail-catalogue.price-lookup.registry.js";

import { evaluateShoppingListValue } from "./shopping-list-value.service.js";

function getAuthenticatedUserId(request: {
  currentUserId?: string;
}): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }

  return request.currentUserId;
}

export interface ShoppingListValueRouteOptions {
  cataloguePriceLookupRegistry:
    CataloguePriceLookupRegistry;
}

export async function registerShoppingListValueRoutes(
  api: FastifyInstance,
  options: ShoppingListValueRouteOptions,
): Promise<void> {
  api.register(
    async (shoppingValue) => {
      shoppingValue.addHook(
        "preHandler",
        requireAuth,
      );

      shoppingValue.get<{
        Params: {
          shoppingListId: string;
        };
        Querystring: {
          /**
           * The shopper's own South African province, when the
           * frontend's location service has resolved one (e.g. from
           * a delivery address or postal code). Optional -- when
           * omitted, retailer adapters fall back to their own
           * configured default (see CONSTRUCTOR-IO-PRICE-LOOKUP.md
           * for why this matters specifically for Woolworths).
           */
          province?: string;
          /**
           * The shopper's specific Pick n Pay store code (e.g.
           * "WC21"), when the frontend's location service has
           * resolved one. Optional -- when omitted, falls back to
           * PICK_N_PAY_DEFAULT_STORE_CODE. See
           * PNP-HYBRIS-PRICE-LOOKUP.md.
           */
          pnpStoreCode?: string;
        };
      }>(
        "/shopping-lists/:shoppingListId/value",
        async (request, reply) => {
          const userId =
            getAuthenticatedUserId(
              request,
            );

          const hasExplicitProvince =
            Boolean(request.query.province);

          const hasExplicitStoreCode =
            Boolean(request.query.pnpStoreCode);

          const profile =
            hasExplicitProvince &&
            hasExplicitStoreCode
              ? null
              : await shoppingValue.prisma.userProfile.findUnique({
                  where: { userId },
                  select: {
                    province: true,
                    latitude: true,
                    longitude: true,
                    pnpStoreCode: true,
                  },
                });

          const province =
            request.query.province ??
            profile?.province ??
            undefined;

          const storeCode =
            request.query.pnpStoreCode ??
            profile?.pnpStoreCode ??
            undefined;

          const result =
            await evaluateShoppingListValue(
              shoppingValue,
              userId,
              request.params.shoppingListId,
              options.cataloguePriceLookupRegistry,
              {
                ...(province ? { province } : {}),
                ...(storeCode ? { storeCode } : {}),
                ...(profile?.latitude !== null &&
                profile?.latitude !== undefined
                  ? { latitude: profile.latitude }
                  : {}),
                ...(profile?.longitude !== null &&
                profile?.longitude !== undefined
                  ? { longitude: profile.longitude }
                  : {}),
              },
            );

          if (!result) {
            return reply.code(404).send({
              error:
                "SHOPPING_LIST_NOT_FOUND",
              message:
                "Shopping list was not found",
            });
          }

          return reply.send(result);
        },
      );
    },
    {
      prefix: "/me",
    },
  );
}
