import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";

import { env } from "../config/env.js";
import { GLOBAL_RATE_LIMIT } from "../config/rate-limit.config.js";
import prismaPlugin from "../plugins/prisma.js";
import loggerPlugin from "../plugins/logger.js";

import { registerRoutes } from "./routes.js";
import { registerErrorHandler } from "../middleware/error-handler.js";
import { registerRequestContext } from "../middleware/request-context.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    },
    pluginTimeout: 30000
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });

  app.register(cookie);

  /*
   * Global baseline (100 req/min per IP) -- individual sensitive
   * routes (login, registration, password reset, support) set their
   * own stricter limits via route-level `config.rateLimit`, which
   * @fastify/rate-limit applies on top of this global registration.
   */
  app.register(rateLimit, GLOBAL_RATE_LIMIT);

  app.register(loggerPlugin);
  app.register(prismaPlugin);

  registerRequestContext(app);
  registerErrorHandler(app);

  app.register(registerRoutes);

  return app;
}
