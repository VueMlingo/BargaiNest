import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuth } from "../auth/auth.middleware.js";
import { browsePromotions } from "./promotions.service.js";
import { PROMOTION_RETAILER_CONFIGS } from "./promotions.config.js";

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

        const configs = parsed.data.retailer
          ? PROMOTION_RETAILER_CONFIGS.filter(
              (c) => c.retailerCode === parsed.data.retailer!.toUpperCase(),
            )
          : PROMOTION_RETAILER_CONFIGS;

        const errors: { sourceUrl: string; message: string }[] = [];

        const promotions = await browsePromotions(
          configs,
          parsed.data.q !== undefined ? { searchTerm: parsed.data.q } : {},
          (sourceUrl, error) => {
            request.log.warn({ sourceUrl, error }, "promotion source failed, skipped");
            errors.push({
              sourceUrl,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          },
        );

        return reply.send({ promotions, sourcesFailed: errors.length });
      });

      scope.get("/promotions/retailers", async (_request, reply) => {
        return reply.send(
          PROMOTION_RETAILER_CONFIGS.map((c) => ({
            code: c.retailerCode,
            name: c.retailerName,
          })),
        );
      });
  });
}
