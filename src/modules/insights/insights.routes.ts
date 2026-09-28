import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/auth.middleware.js";
import { LoyaltyConsumerReadService } from "../../integrations/loyalty/read/loyalty-consumer-read.service.js";
import { buildLoyaltyInsights } from "./insights.service.js";

function getAuthenticatedUserId(request: { currentUserId?: string }): string {
  if (!request.currentUserId) {
    throw new Error("AUTHENTICATED_USER_ID_MISSING");
  }
  return request.currentUserId;
}

export async function registerInsightsRoutes(api: FastifyInstance): Promise<void> {
  api.register(
    async (scope) => {
      scope.addHook("preHandler", requireAuth);

      /*
       * Reuses the same read service every other loyalty endpoint
       * already uses -- no new queries, purely an aggregation over data
       * that's already fetched elsewhere in the app.
       */
      scope.get("/insights", async (request) => {
        const userId = getAuthenticatedUserId(request);
        const readService = new LoyaltyConsumerReadService(scope.prisma);
        const accounts = await readService.getAccountsForUser(userId);
        return buildLoyaltyInsights(accounts);
      });
    },
    { prefix: "/me" },
  );
}
