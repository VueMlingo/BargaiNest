import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { browsePromotions, browsePromotionsViaLiveSearch, type Promotion } from "./promotions.service.js";
import { PROMOTION_RETAILER_CONFIGS, buildLiveSearchPromotionConfigs } from "./promotions.config.js";

const querySchema = z.object({
  q: z.string().trim().max(191).optional(),
  retailer: z.string().trim().max(191).optional(),
});

export async function registerPromotionsRoutes(api: FastifyInstance): Promise<void> {
  api.register(async (scope) => {
    scope.addHook("preHandler", requireAuth);

      /*
       * Live fetch on every request -- no persistence/caching layer.
       * Each call to a retailer's specials page is a real network
       * request; this pilot has no scheduled ingest job to pre-fetch
       * and cache promotions the way it would for a production
       * "browse today's deals" feature. Acceptable for pilot scale,
       * worth revisiting (a cron-populated cache) if this sees real
       * traffic -- same honest caveat pattern as the reward-expiry
       * check needing an external scheduler.
       */
      scope.get("/promotions", async (request, reply) => {
        const parsed = querySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          return reply.code(400).send({ error: "INVALID_REQUEST", message: "Invalid query parameters." });
        }

        const requestedRetailer = parsed.data.retailer?.toUpperCase();

        const discoveryConfigs = requestedRetailer
          ? PROMOTION_RETAILER_CONFIGS.filter((c) => c.retailerCode === requestedRetailer)
          : PROMOTION_RETAILER_CONFIGS;

        const liveSearchConfigs = requestedRetailer
          ? buildLiveSearchPromotionConfigs().filter((c) => c.retailerCode === requestedRetailer)
          : buildLiveSearchPromotionConfigs();

        const browseOptions = parsed.data.q !== undefined ? { searchTerm: parsed.data.q } : {};
        const errors: { sourceUrl: string; message: string }[] = [];
        const onSourceError = (sourceUrl: string, error: unknown) => {
          request.log.warn({ sourceUrl, error }, "promotion source failed, skipped");
          errors.push({
            sourceUrl,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        };

        /*
         * BN-030: one retailer's source failing -- whichever path it
         * comes through -- must not prevent any other retailer's
         * promotions from being returned. Promise.all here is safe
         * precisely because each underlying browse function already
         * catches its own per-source errors internally (see
         * browsePromotionsForRetailer / browsePromotionsViaLiveSearch)
         * and reports them via onSourceError rather than rejecting.
         */
        const [discoveryPromotions, ...liveSearchResults] = await Promise.all([
          browsePromotions(discoveryConfigs, browseOptions, onSourceError),
          ...liveSearchConfigs.map((config) =>
            browsePromotionsViaLiveSearch(config, browseOptions, onSourceError),
          ),
        ]);

        const promotions: Promotion[] = [
          ...discoveryPromotions,
          ...liveSearchResults.flat(),
        ];

        return reply.send({ promotions, sourcesFailed: errors.length });
      });

      scope.get("/promotions/retailers", async (_request, reply) => {
        return reply.send(
          [...PROMOTION_RETAILER_CONFIGS, ...buildLiveSearchPromotionConfigs()].map((c) => ({
            code: c.retailerCode,
            name: c.retailerName,
          })),
        );
      });
  });
}
